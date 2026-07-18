import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { IS_EDGE, IS_CENTRAL, LOJA_ID, FISCAL_HABILITADO } from '../config.js';
import { getSaldo, aplicarMovimento } from '../sync/estoque.js';
import { enfileirar } from '../sync/outbox.js';
import { enfileirarNfce } from '../fiscal/fila.js';
import { resolverSeriePadrao } from '../fiscal/parametrosFiscais.js';
import { creditarRecebiveisSemConta } from '../lib/creditarContaPrincipal.js';
import { toCents, fromCents, totalItem, calcularTaxa, ratearParcelas } from '../lib/money.js';

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
  vendedorId: z.string().optional().nullable(),
  caixaId: z.string().optional().nullable(),
  lojaId: z.string().optional().nullable(),
  pdvTerminalId: z.string().optional().nullable(),
  desconto: z.coerce.number().nonnegative().optional(),
  acrescimo: z.coerce.number().nonnegative().optional(),
  observacao: z.string().optional().nullable(),
  itens: z.array(itemSchema).min(1),
  pagamentos: z.array(pagamentoSchema).min(1),
  aprovadorId: z.string().optional().nullable(),
});

// Confere que aprovadorId é um usuário ativo com role ADMIN/GERENTE — usado
// para as aprovações de gerente (desconto, cancelamento, fechamento).
async function validarAprovador(tx, aprovadorId) {
  if (!aprovadorId) {
    throw Object.assign(new Error('Aprovação de gerente é obrigatória'), { status: 400 });
  }
  const aprovador = await tx.user.findUnique({ where: { id: aprovadorId } });
  if (!aprovador || !aprovador.ativo || !['ADMIN', 'GERENTE'].includes(aprovador.role)) {
    throw Object.assign(new Error('Aprovador inválido'), { status: 400 });
  }
  return aprovador;
}

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

  // Toda a matemática em centavos inteiros (lib/money.js), espelhando o
  // pdvMath.js do PDV — front e back chegam ao mesmo resultado exato.
  const { taxaValor, valorLiquido } = calcularTaxa(pag.valor, taxaPercentual, taxaFixa);

  // Gera N parcelas a receber (crédito parcelado espaça de 30 em 30 dias).
  // O rateio joga o resíduo do arredondamento na última parcela.
  const recebiveis = ratearParcelas(pag.valor, taxaValor, parcelas).map((p) => ({
    ...p,
    totalParcelas: parcelas,
    dataPrevista: addDias(new Date(), prazo + (p.parcelaNumero - 1) * 30),
    status: pag.forma === 'DINHEIRO' ? 'RECEBIDO' : 'PENDENTE',
    recebidoEm: pag.forma === 'DINHEIRO' ? new Date() : null,
    adquirenteId: pag.adquirenteId || null,
  }));

  return { parcelas, taxaPercentual, taxaValor, valorLiquido, prazo, recebiveis };
}

router.get('/', asyncHandler(async (req, res) => {
  const { status, de, ate, caixaId } = req.query;
  const where = {
    ...(status ? { status: String(status) } : {}),
    ...(caixaId ? { caixaId: String(caixaId) } : {}),
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
      vendedor: { select: { nome: true } },
      loja: { select: { nome: true } },
      pagamentos: true,
      _count: { select: { itens: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(vendas);
}));

// Lista de usuários ativos disponíveis para seleção como vendedor no PDV.
// Precisa vir antes de '/:id' para não colidir com o parâmetro de rota.
router.get('/vendedores', asyncHandler(async (req, res) => {
  const vendedores = await prisma.user.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, role: true },
  });
  res.json(vendedores);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const venda = await prisma.venda.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      cliente: true,
      usuario: { select: { nome: true } },
      vendedor: { select: { nome: true } },
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

  if (dados.vendedorId) {
    const vendedor = await prisma.user.findUnique({ where: { id: dados.vendedorId } });
    if (!vendedor || !vendedor.ativo) {
      throw Object.assign(new Error('Vendedor inválido'), { status: 400 });
    }
  }

  // Totais em centavos inteiros (mesma matemática do pdvMath.js do PDV).
  for (const i of dados.itens) {
    if (toCents(i.desconto || 0) > toCents(i.precoUnit) * i.quantidade) {
      throw Object.assign(new Error('Desconto do item maior que o valor do item'), { status: 400 });
    }
  }
  const subtotalCents = dados.itens.reduce(
    (acc, i) => acc + toCents(i.precoUnit) * i.quantidade - toCents(i.desconto || 0),
    0
  );
  const totalCents = subtotalCents - toCents(dados.desconto || 0) + toCents(dados.acrescimo || 0);
  if (totalCents < 0) {
    throw Object.assign(new Error('Desconto maior que o valor da venda'), { status: 400 });
  }
  const totalPagoCents = dados.pagamentos.reduce((acc, p) => acc + toCents(p.valor), 0);
  if (totalPagoCents !== totalCents) {
    throw Object.assign(new Error('Soma dos pagamentos difere do total da venda'), { status: 400 });
  }
  const subtotal = fromCents(subtotalCents);
  const total = fromCents(totalCents);

  // Enforcement das regras de comportamento do PDV — não confiar só no front.
  const descontoTotalCents =
    toCents(dados.desconto || 0) + dados.itens.reduce((acc, i) => acc + toCents(i.desconto || 0), 0);
  const descontoTotal = fromCents(descontoTotalCents);
  const cfgPdv = await prisma.configuracaoPdv.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  if (descontoTotal > 0) {
    if (!cfgPdv.descontoHabilitado) {
      throw Object.assign(new Error('Desconto desabilitado nas configurações do PDV'), { status: 400 });
    }
    if (cfgPdv.descontoMaximoPercentual != null) {
      const percentualDesconto = subtotal > 0 ? (descontoTotal / subtotal) * 100 : 0;
      if (percentualDesconto > Number(cfgPdv.descontoMaximoPercentual)) {
        throw Object.assign(
          new Error(`Desconto acima do limite permitido (${Number(cfgPdv.descontoMaximoPercentual)}%)`),
          { status: 400 }
        );
      }
    }
    if (cfgPdv.exigirGerenteDesconto) {
      await validarAprovador(prisma, dados.aprovadorId);
    }
  }

  const venda = await prisma.$transaction(async (tx) => {
    // Valida preço e saldo por loja (EstoqueLocal) antes de debitar.
    const semEstoque = [];
    for (const item of dados.itens) {
      const variacao = await tx.variacao.findUniqueOrThrow({
        where: { id: item.variacaoId },
        include: { produto: { select: { precoVenda: true } } },
      });
      // O preço unitário é o do catálogo — o cliente não define preço, só
      // desconto (que passa pelas regras de limite/aprovação abaixo).
      const precoCatalogo = variacao.precoVenda ?? variacao.produto.precoVenda;
      if (toCents(item.precoUnit) !== toCents(precoCatalogo)) {
        throw Object.assign(
          new Error(`Preço do item ${variacao.sku} difere do preço de catálogo`),
          { status: 400 }
        );
      }
      // bloquearVendaSemEstoque=false permite finalizar mesmo sem saldo
      // (estoque fica negativo e é acertado depois) — mesmo comportamento do PDV.
      if (cfgPdv.bloquearVendaSemEstoque) {
        const saldo = await getSaldo(tx, lojaId, item.variacaoId);
        if (saldo < item.quantidade) {
          semEstoque.push({ variacaoId: item.variacaoId, sku: variacao.sku, saldo, solicitado: item.quantidade });
        }
      }
    }
    if (semEstoque.length) {
      throw Object.assign(new Error('Itens sem estoque suficiente'), { status: 400, itens: semEstoque });
    }

    // Numeração POR LOJA, gerada localmente (contador max+1 da loja).
    const agg = await tx.venda.aggregate({ where: { lojaId }, _max: { numero: true } });
    const numero = (agg._max.numero || 0) + 1;

    const novaVenda = await tx.venda.create({
      data: {
        numero,
        clienteId: dados.clienteId || null,
        vendedorId: dados.vendedorId || null,
        caixaId: dados.caixaId || null,
        lojaId,
        pdvTerminalId: dados.pdvTerminalId || null,
        usuarioId: req.user.sub,
        status: 'FINALIZADA',
        finalizadaEm: new Date(),
        subtotal,
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
            total: totalItem(i.precoUnit, i.quantidade, i.desconto),
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
      const serie = await resolverSeriePadrao(tx, { modelo: '65', fallback: cfgFiscal.serieNfce });
      const nota = await enfileirarNfce(tx, {
        lojaId,
        vendaId: novaVenda.id,
        ambiente: cfgFiscal.ambiente,
        serie,
      });
      await enfileirar(tx, 'nota_fiscal', nota.id, nota);
    }

    return completa;
  });

  res.status(201).json(venda);
}));

const cancelarSchema = z.object({
  aprovadorId: z.string().optional().nullable(),
});

router.post('/:id/cancelar', asyncHandler(async (req, res) => {
  const { aprovadorId } = cancelarSchema.parse(req.body || {});
  const cfgPdv = await prisma.configuracaoPdv.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  if (cfgPdv.exigirGerenteCancelamento) {
    await validarAprovador(prisma, aprovadorId);
  }

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
