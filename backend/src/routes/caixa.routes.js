import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { IS_EDGE, LOJA_ID } from '../config.js';
import { enfileirar } from '../sync/outbox.js';
import { toCents, fromCents } from '../lib/money.js';

const router = Router();

// No edge, o caixa pertence à loja fixa; na central usa o que veio no corpo.
const resolverLoja = (lojaId) => (IS_EDGE ? LOJA_ID : lojaId || null);

// Retorna o caixa aberto do usuário logado (ou null).
router.get('/atual', asyncHandler(async (req, res) => {
  const caixa = await prisma.caixa.findFirst({
    where: { usuarioId: req.user.sub, aberto: true },
    include: { movimentos: true },
  });
  res.json(caixa);
}));

router.post('/abrir', asyncHandler(async (req, res) => {
  const { valorAbertura, lojaId, pdvTerminalId } = z
    .object({
      valorAbertura: z.coerce.number().nonnegative(),
      lojaId: z.string().optional().nullable(),
      pdvTerminalId: z.string().optional().nullable(),
    })
    .parse(req.body);
  const existente = await prisma.caixa.findFirst({
    where: { usuarioId: req.user.sub, aberto: true },
  });
  if (existente) throw Object.assign(new Error('Já existe um caixa aberto'), { status: 400 });
  const caixa = await prisma.$transaction(async (tx) => {
    const c = await tx.caixa.create({
      data: { usuarioId: req.user.sub, valorAbertura, lojaId: resolverLoja(lojaId), pdvTerminalId: pdvTerminalId || null },
    });
    await enfileirar(tx, 'caixa', c.id, c);
    return c;
  });
  res.status(201).json(caixa);
}));

router.post('/:id/movimento', asyncHandler(async (req, res) => {
  const { tipo, valor, motivo } = z
    .object({
      tipo: z.enum(['SUPRIMENTO', 'SANGRIA']),
      valor: z.coerce.number().positive(),
      motivo: z.string().optional().nullable(),
    })
    .parse(req.body);
  const mov = await prisma.$transaction(async (tx) => {
    const caixa = await tx.caixa.findUniqueOrThrow({ where: { id: req.params.id } });
    if (!caixa.aberto) {
      throw Object.assign(new Error('Caixa já está fechado'), { status: 400 });
    }
    const m = await tx.movimentoCaixa.create({
      data: { caixaId: req.params.id, tipo, valor, motivo: motivo || null },
    });
    await enfileirar(tx, 'movimento_caixa', m.id, m);
    return m;
  });
  res.status(201).json(mov);
}));

// Confere que aprovadorId é um usuário ativo com role ADMIN/GERENTE.
async function validarAprovador(aprovadorId) {
  if (!aprovadorId) {
    throw Object.assign(new Error('Aprovação de gerente é obrigatória'), { status: 400 });
  }
  const aprovador = await prisma.user.findUnique({ where: { id: aprovadorId } });
  if (!aprovador || !aprovador.ativo || !['ADMIN', 'GERENTE'].includes(aprovador.role)) {
    throw Object.assign(new Error('Aprovador inválido'), { status: 400 });
  }
  return aprovador;
}

// Fecha o caixa e retorna o resumo (esperado x informado).
router.post('/:id/fechar', asyncHandler(async (req, res) => {
  const { valorFechamento, observacao, aprovadorId } = z
    .object({
      valorFechamento: z.coerce.number().nonnegative(),
      observacao: z.string().optional().nullable(),
      aprovadorId: z.string().optional().nullable(),
    })
    .parse(req.body);

  const cfgPdv = await prisma.configuracaoPdv.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  if (cfgPdv.exigirAprovacaoFechamento) {
    await validarAprovador(aprovadorId);
  }

  const caixa = await prisma.caixa.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      movimentos: true,
      vendas: { include: { pagamentos: true } },
    },
  });
  if (!caixa.aberto) {
    throw Object.assign(new Error('Caixa já está fechado'), { status: 400 });
  }

  // Somas em centavos inteiros para o resumo fechar exato.
  const dinheiroVendasCents = caixa.vendas
    .filter((v) => v.status === 'FINALIZADA')
    .flatMap((v) => v.pagamentos)
    .filter((p) => p.forma === 'DINHEIRO')
    .reduce((acc, p) => acc + toCents(p.valor), 0);
  const suprimentosCents = caixa.movimentos
    .filter((m) => m.tipo === 'SUPRIMENTO')
    .reduce((acc, m) => acc + toCents(m.valor), 0);
  const sangriasCents = caixa.movimentos
    .filter((m) => m.tipo === 'SANGRIA')
    .reduce((acc, m) => acc + toCents(m.valor), 0);

  const esperadoCents =
    toCents(caixa.valorAbertura) + dinheiroVendasCents + suprimentosCents - sangriasCents;
  const dinheiroVendas = fromCents(dinheiroVendasCents);
  const suprimentos = fromCents(suprimentosCents);
  const sangrias = fromCents(sangriasCents);
  const esperadoDinheiro = fromCents(esperadoCents);

  const atualizado = await prisma.$transaction(async (tx) => {
    const c = await tx.caixa.update({
      where: { id: caixa.id },
      data: { aberto: false, fechamentoEm: new Date(), valorFechamento, observacao: observacao || null },
    });
    // Estado final do caixa sobe para a central (upsert por id).
    await enfileirar(tx, 'caixa', c.id, c);
    return c;
  });

  res.json({
    caixa: atualizado,
    resumo: {
      valorAbertura: Number(caixa.valorAbertura),
      dinheiroVendas,
      suprimentos,
      sangrias,
      esperadoDinheiro,
      informado: valorFechamento,
      diferenca: fromCents(toCents(valorFechamento) - esperadoCents),
    },
  });
}));

export default router;
