// Configurações Fiscais granulares (inspiradas nas telas do ConnectPlug,
// adequadas ao Simples Nacional): grupos de tributação reutilizáveis, múltiplas
// séries de NF e naturezas de operação. Leitura liberada a qualquer autenticado
// (o edge/PDV precisa consultar); escrita restrita a ADMIN/GERENTE.
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const escrita = requireRole('ADMIN', 'GERENTE');

// Filtro ?ativo=false traz também os inativos (soft-deletados); por padrão,
// só os ativos.
function whereAtivo(req) {
  return req.query.ativo === 'false' ? {} : { ativo: true };
}

// --- GrupoTributacao ---
const grupoSchema = z.object({
  nome: z.string().min(1),
  origemMercadoria: z.string().min(1).optional(),
  csosn: z.string().min(1).optional(),
  cfop: z.string().min(1).optional(),
  ncm: z.string().optional().nullable(),
  cest: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.get('/grupos-tributacao', asyncHandler(async (req, res) => {
  const grupos = await prisma.grupoTributacao.findMany({ where: whereAtivo(req), orderBy: { nome: 'asc' } });
  res.json(grupos);
}));

router.get('/grupos-tributacao/:id', asyncHandler(async (req, res) => {
  const grupo = await prisma.grupoTributacao.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json(grupo);
}));

router.post('/grupos-tributacao', escrita, asyncHandler(async (req, res) => {
  const data = grupoSchema.parse(req.body);
  const grupo = await prisma.grupoTributacao.create({ data });
  res.status(201).json(grupo);
}));

router.put('/grupos-tributacao/:id', escrita, asyncHandler(async (req, res) => {
  const data = grupoSchema.partial().parse(req.body);
  const grupo = await prisma.grupoTributacao.update({ where: { id: req.params.id }, data });
  res.json(grupo);
}));

// Delete soft: preserva o histórico (produtos podem referenciar o grupo).
router.delete('/grupos-tributacao/:id', escrita, asyncHandler(async (req, res) => {
  await prisma.grupoTributacao.update({ where: { id: req.params.id }, data: { ativo: false } });
  res.status(204).end();
}));

// --- SerieNotaFiscal ---
const serieSchema = z.object({
  modelo: z.enum(['65', '55']),
  serie: z.coerce.number().int().nonnegative(),
  descricao: z.string().optional().nullable(),
  padrao: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

router.get('/series', asyncHandler(async (req, res) => {
  const series = await prisma.serieNotaFiscal.findMany({
    where: whereAtivo(req),
    orderBy: [{ modelo: 'asc' }, { serie: 'asc' }],
  });
  res.json(series);
}));

router.get('/series/:id', asyncHandler(async (req, res) => {
  const serie = await prisma.serieNotaFiscal.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json(serie);
}));

router.post('/series', escrita, asyncHandler(async (req, res) => {
  const data = serieSchema.parse(req.body);
  const serie = await prisma.$transaction(async (tx) => {
    // Só uma série padrão por modelo: ao marcar esta, desmarca as demais.
    if (data.padrao) {
      await tx.serieNotaFiscal.updateMany({ where: { modelo: data.modelo }, data: { padrao: false } });
    }
    return tx.serieNotaFiscal.create({ data });
  });
  res.status(201).json(serie);
}));

router.put('/series/:id', escrita, asyncHandler(async (req, res) => {
  const data = serieSchema.partial().parse(req.body);
  const serie = await prisma.$transaction(async (tx) => {
    const atual = await tx.serieNotaFiscal.findUniqueOrThrow({ where: { id: req.params.id } });
    if (data.padrao) {
      const modelo = data.modelo || atual.modelo;
      await tx.serieNotaFiscal.updateMany({ where: { modelo, id: { not: req.params.id } }, data: { padrao: false } });
    }
    return tx.serieNotaFiscal.update({ where: { id: req.params.id }, data });
  });
  res.json(serie);
}));

router.delete('/series/:id', escrita, asyncHandler(async (req, res) => {
  await prisma.serieNotaFiscal.update({ where: { id: req.params.id }, data: { ativo: false } });
  res.status(204).end();
}));

// --- NaturezaOperacao ---
const naturezaSchema = z.object({
  descricao: z.string().min(1),
  cfop: z.string().min(1),
  padrao: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

router.get('/naturezas-operacao', asyncHandler(async (req, res) => {
  const naturezas = await prisma.naturezaOperacao.findMany({ where: whereAtivo(req), orderBy: { descricao: 'asc' } });
  res.json(naturezas);
}));

router.get('/naturezas-operacao/:id', asyncHandler(async (req, res) => {
  const natureza = await prisma.naturezaOperacao.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json(natureza);
}));

router.post('/naturezas-operacao', escrita, asyncHandler(async (req, res) => {
  const data = naturezaSchema.parse(req.body);
  const natureza = await prisma.$transaction(async (tx) => {
    if (data.padrao) await tx.naturezaOperacao.updateMany({ where: {}, data: { padrao: false } });
    return tx.naturezaOperacao.create({ data });
  });
  res.status(201).json(natureza);
}));

router.put('/naturezas-operacao/:id', escrita, asyncHandler(async (req, res) => {
  const data = naturezaSchema.partial().parse(req.body);
  const natureza = await prisma.$transaction(async (tx) => {
    if (data.padrao) await tx.naturezaOperacao.updateMany({ where: { id: { not: req.params.id } }, data: { padrao: false } });
    return tx.naturezaOperacao.update({ where: { id: req.params.id }, data });
  });
  res.json(natureza);
}));

router.delete('/naturezas-operacao/:id', escrita, asyncHandler(async (req, res) => {
  await prisma.naturezaOperacao.update({ where: { id: req.params.id }, data: { ativo: false } });
  res.status(204).end();
}));

export default router;
