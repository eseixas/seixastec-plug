import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { IS_EDGE, IS_CENTRAL, LOJA_ID, FISCAL_HABILITADO } from '../config.js';
import { getSaldo, aplicarMovimento } from '../sync/estoque.js';
import { enfileirar } from '../sync/outbox.js';
import { enfileirarNfce } from '../fiscal/fila.js';
import { creditarRecebiveisSemConta } from '../lib/creditarContaPrincipal.js';

const router = Router();

const itemSchema = z.object({
  variacaoId: z.string().min(1),
  quantidade: z.coerce.number().int().positive(),
  precoUnit: z.coerce.number().nonnegative(),
  desconto: z.coerce.number().nonnegative().optional(),
});

const pagamentoSchema = z.object({
  forma: z.enum(['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'DEPOSITO', 'LINK']),
  valor: z.coerce.number().nonnegative(),
  parcelas: z.coerce.number().int().positive().optional(),
  adquirenteId: z.string().optional().nullable(),
});

const vendaSchema = z.object({
  clienteId: z.string().optional().nullable(),
  caixaId: z.string().optional().nullable(),
  lojaId: z.string().optional().nullable(),
  pdvTerminalId: z.string().optional().nullable(),
  desconto: z.coerce.number().nonnegative().optional(),
  acrescimo: z.coerce.number().nonnegative().optional(),
  observacao: z.string().optional().nullable(),
  itens: z.array(itemSchema).min(1),
  pagamentos: z.array(pagamentoSchema).min(1),
});

const round2 = (n) => Math.round(n * 100) / 100;
const addDias = (base, dias) => {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d;
};

// Resolve taxa/prazo do pagamento e monta as parcelas a receber.
async function calcularPagamento(tx, pag) {
  const parcelas = pag.forma === 'CREDITO' ? (pag.parcelas || 1) : 1;
  let taxaPercentual = 0;
  let taxaFixa = 0;
  let prazo = 0;

  if (pag.adquirenteId && pag.forma !== 'DINHEIRO') {
    const taxa = await tx.taxaAdquirente.findUnique({
      where: {
        adquirenteId_forma_parcelas: {
          adquirenteId: pag.adquirenteId,
          forma: pag.forma,
          parcelas,
        },
      },
    });
    if (taxa) {
      taxaPercentual = Number(taxa.taxaPercentual);
      taxaFixa = Number(taxa.taxaFixa);
      prazo = taxa.prazoRecebimentoDias;
    }
  }

  const taxaValor = round2((pag.valor * taxaPercentual) / 100 + taxaFixa);
  const valorLiquido = round2(pag.valor - taxaValor);

  // Gera N parcelas a receber (crédito parcelado espaça de 30 em 30 dias).
  const recebiveis = [];
  const brutoParcela = round2(pag.valor / parcelas);
  const taxaParcela = round2(taxaValor / parcelas);
  let somaBruto = 0;
  let somaTaxa = 0;
  for (let i = 1; i <= parcelas; i++) {
    const ultimo = i === parcelas;
    const bruto = ultimo ? round2(pag.valor - somaBruto) : brutoParcela;
    const tx_ = ultimo ? round2(taxaValor - somaTaxa) : taxaParcela;
    somaBruto = round2(somaBruto + bruto);
    somaTaxa = round2(somaTaxa + tx_);
    recebiveis.push({
      parcelaNumero: i,
      totalParcelas: parcelas,
      valorBruto: bruto,
      taxaValor: tx_,
      valorLiquido: round2(bruto - tx_),
      dataPrevista: addDias(new Date(), prazo + (i - 1) * 30),
      status: pag.forma === 'DINHEIRO' ? 'RECEBIDO' : 'PENDENTE',
      recebidoEm: pag.forma === 'DINHEIRO' ? new Date() : null,
      adquirenteId: pag.adquirenteId || null,
    });
  }

  return { parcelas, taxaPercentual, taxaValor, valorLiquido, prazo, recebiveis };
}

router.get('/', asyncHandler(async (req, res) => {
  const { status, de, ate } = req.query;
  const where = {
    ...(status ? { status: String(status) } : {}),
    ...(de || ate
      ? {
          createdAt: {
            ...(de ? { gte: new Date(String(de)) } : {}),
            ...(ate ? { lte: new Date(String(ate) + 'T23:59:59') } : {}),
          },
        }
      : {}),
  };
  const vendas = await prisma.venda.findMany({
    where,
    include: {
      cliente: { select: { nome: true } },
      usuario: { select: { nome: true } },
      loja: { select: { nome: true } },
      pagamentos: true,
      _count: { select: { itens: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(vendas);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const venda = await prisma.venda.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      cliente: true,
      usuario: { select: { nome: true } },
      loja: true,
      pagamentos: { include: { adquirente: true } },
      recebiveis: { include: { adquirente: true } },
      itens: { include: { variacao: { include: { produto: true } } } },
    },
  });
  res.json(venda);
}));

// Serializa a venda completa para o evento de sync (JSON puro, determinístico).
function serializarVenda(v) {
  return JSON.parse(JSON.stringify(v));
}

router.post('/', asyncHandler(async (req, res) => {
  const dados = vendaSchema.parse(req.body);

  // No edge a loja é fixa (LOJA_ID); na central vem do corpo ou, na falta, da
  // loja do usuário logado (útil no modo nó-único). É obrigatória porque estoque
  // e numeração são por loja.
  let lojaId = IS_EDGE ? LOJA_ID : dados.lojaId || null;
  if (!lojaId && !IS_EDGE) {
    const u = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { lojaId: true } });
    lojaId = u?.lojaId || null;
  }
  if (!lojaId) {
    throw Object.assign(new Error('lojaId é obrigatório para registrar a venda'), { status: 400 });
  }

  const subtotal = dados.itens.reduce(
    (acc, i) => acc + i.precoUnit * i.quantidade - (i.desconto || 0),
    0
  );
  const total = round2(subtotal - (dados.desconto || 0) + (dados.acrescimo || 0));
  const totalPago = dados.pagamentos.reduce((acc, p) => acc + p.valor, 0);
  if (Math.abs(totalPago - total) > 0.01) {
    throw Object.assign(new Error('Soma dos pagamentos difere do total da venda'), { status: 400 });
  }

  const venda = await prisma.$transaction(async (tx) => {
    // Valida saldo por loja (EstoqueLocal) antes de debitar.
    for (const item of dados.itens) {
      const variacao = await tx.variacao.findUniqueOrThrow({ where: { id: item.variacaoId } });
      const saldo = await getSaldo(tx, lojaId, item.variacaoId);
      if (saldo < item.quantidade) {
        throw Object.assign(new Error(`Estoque insuficiente para SKU ${variacao.sku}`), { status: 400 });
      }
    }

    // Numeração POR LOJA, gerada localmente (contador max+1 da loja).
    const agg = await tx.venda.aggregate({ where: { lojaId }, _max: { numero: true } });
    const numero = (agg._max.numero || 0) + 1;

    const novaVenda = await tx.venda.create({
      data: {
        numero,
        clienteId: dados.clienteId || null,
        caixaId: dados.caixaId || null,
        lojaId,
        pdvTerminalId: dados.pdvTerminalId || null,
        usuarioId: req.user.sub,
        status: 'FINALIZADA',
        finalizadaEm: new Date(),
        subtotal: round2(subtotal),
        desconto: dados.desconto || 0,
        acrescimo: dados.acrescimo || 0,
        total,
        observacao: dados.observacao || null,
        itens: {
          create: dados.itens.map((i) => ({
            variacaoId: i.variacaoId,
            quantidade: i.quantidade,
            precoUnit: i.precoUnit,
            desconto: i.desconto || 0,
            total: round2(i.precoUnit * i.quantidade - (i.desconto || 0)),
          })),
        },
      },
    });

    // Pagamentos + recebíveis (com taxa/prazo da adquirente).
    for (const pag of dados.pagamentos) {
      const calc = await calcularPagamento(tx, pag);
      const pagamento = await tx.pagamento.create({
        data: {
          vendaId: novaVenda.id,
          forma: pag.forma,
          adquirenteId: pag.adquirenteId || null,
          valor: pag.valor,
          parcelas: calc.parcelas,
          taxaPercentual: calc.taxaPercentual,
          taxaValor: calc.taxaValor,
          valorLiquido: calc.valorLiquido,
          prazoRecebimentoDias: calc.prazo,
        },
      });
      await tx.recebivel.createMany({
        data: calc.recebiveis.map((r) => ({
          pagamentoId: pagamento.id,
          vendaId: novaVenda.id,
          adquirenteId: r.adquirenteId,
          parcelaNumero: r.parcelaNumero,
          totalParcelas: r.totalParcelas,
          valorBruto: r.valorBruto,
          taxaValor: r.taxaValor,
          valorLiquido: r.valorLiquido,
          dataPrevista: r.dataPrevista,
          status: r.status,
          recebidoEm: r.recebidoEm,
        })),
      });
    }

    // Baixa de estoque por loja (movimentos de SAÍDA, aplicados ao EstoqueLocal).
    // Os movimentos viajam DENTRO do evento 'venda' — não enfileiramos separado.
    for (const i of dados.itens) {
      await aplicarMovimento(
        tx,
        {
          id: crypto.randomUUID(),
          variacaoId: i.variacaoId,
          lojaId,
          tipo: 'SAIDA',
          quantidade: i.quantidade,
          motivo: `Venda #${numero}`,
          categoria: 'VENDA',
          vendaId: novaVenda.id,
          usuarioId: req.user.sub,
        },
        { enqueue: false }
      );
    }

    // ContaBancaria é central-only: no edge a tabela local é irrelevante/desconectada
    // da central, então o crédito automático só roda quando a venda é criada na central.
    if (IS_CENTRAL) {
      const recebiveisCriados = await tx.recebivel.findMany({ where: { vendaId: novaVenda.id } });
      await creditarRecebiveisSemConta(tx, recebiveisCriados);
    }

    // Re-lê o grafo completo para retornar e para o evento de sync.
    const completa = await tx.venda.findUnique({
      where: { id: novaVenda.id },
      include: {
        cliente: true,
        pagamentos: { include: { adquirente: true } },
        recebiveis: true,
        itens: { include: { variacao: { include: { produto: true } } } },
        movimentacoes: true,
      },
    });

    // Enfileira o evento de venda para subir à central (no-op na central).
    await enfileirar(tx, 'venda', novaVenda.id, serializarVenda(completa));

    // Enfileira a emissão da NFC-e (fila fiscal, independente do outbox de
    // sync). Escrita local só — não bloqueia a venda se a SEFAZ estiver fora
    // do ar; o worker fiscal processa depois, de forma assíncrona.
    if (IS_EDGE && FISCAL_HABILITADO) {
      const cfgFiscal = await tx.configuracaoFiscal.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton' },
      });
      const nota = await enfileirarNfce(tx, {
        lojaId,
        vendaId: novaVenda.id,
        ambiente: cfgFiscal.ambiente,
        serie: cfgFiscal.serieNfce,
      });
      await enfileirar(tx, 'nota_fiscal', nota.id, nota);
    }

    return completa;
  });

  res.status(201).json(venda);
}));

router.post('/:id/cancelar', asyncHandler(async (req, res) => {
  const venda = await prisma.$transaction(async (tx) => {
    const v = await tx.venda.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { itens: true },
    });
    if (v.status === 'CANCELADA') {
      throw Object.assign(new Error('Venda já cancelada'), { status: 400 });
    }
    // Estorna o estoque com movimentos de ENTRADA na loja da venda. Se a operação
    // roda na central (admin), o movimento desce ao edge via pull; no edge, sobe
    // pelo outbox (enqueue). Idempotente por id nos dois lados.
    for (const item of v.itens) {
      await aplicarMovimento(
        tx,
        {
          id: crypto.randomUUID(),
          variacaoId: item.variacaoId,
          lojaId: v.lojaId,
          tipo: 'ENTRADA',
          quantidade: item.quantidade,
          motivo: `Cancelamento venda #${v.numero}`,
          categoria: 'DEVOLUCAO',
          vendaId: v.id,
          usuarioId: req.user.sub,
        },
        { enqueue: true }
      );
    }
    // Cancela recebíveis pendentes da venda.
    await tx.recebivel.updateMany({
      where: { vendaId: v.id, status: 'PENDENTE' },
      data: { status: 'CANCELADO' },
    });
    const atualizada = await tx.venda.update({ where: { id: v.id }, data: { status: 'CANCELADA' } });
    // Propaga o cancelamento (no-op na central; usado se um edge cancelar).
    await enfileirar(tx, 'venda_cancelada', v.id, { id: v.id });
    return atualizada;
  });
  res.json(venda);
}));

export default router;
