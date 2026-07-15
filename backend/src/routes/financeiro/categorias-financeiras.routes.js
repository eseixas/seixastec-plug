import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const router = Router();

const GRUPOS = [
  'RECEITA_OPERACIONAL',
  'DEDUCAO_RECEITA',
  'CUSTO_OPERACIONAL',
  'DESPESA_OPERACIONAL',
  'DESPESA_FINANCEIRA',
  'OUTRAS_RECEITAS',
  'OUTRAS_DESPESAS',
];

// `tipo` nunca é aceito do cliente — é derivado de `grupo` no servidor.
const schema = z.object({
  nome: z.string().min(1),
  grupo: z.enum(GRUPOS),
  ativo: z.boolean().optional(),
});

function tipoDoGrupo(grupo) {
  return ['RECEITA_OPERACIONAL', 'OUTRAS_RECEITAS'].includes(grupo) ? 'RECEITA' : 'DESPESA';
}

router.get('/', asyncHandler(async (req, res) => {
  const { q, grupo, tipo, ativo } = req.query;
  const where = {
    ...(q ? { nome: { contains: String(q), mode: 'insensitive' } } : {}),
    ...(grupo ? { grupo: String(grupo) } : {}),
    ...(tipo ? { tipo: String(tipo) } : {}),
    ...(ativo === 'true' ? { ativo: true } : ativo === 'false' ? { ativo: false } : {}),
  };
  const categorias = await prisma.categoriaFinanceira.findMany({
    where,
    orderBy: [{ grupo: 'asc' }, { nome: 'asc' }],
  });
  res.json(categorias);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  const categoria = await prisma.categoriaFinanceira.create({
    data: { ...data, tipo: tipoDoGrupo(data.grupo) },
  });
  res.status(201).json(categoria);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  if (data.grupo) data.tipo = tipoDoGrupo(data.grupo);
  const categoria = await prisma.categoriaFinanceira.update({ where: { id: req.params.id }, data });
  res.json(categoria);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.categoriaFinanceira.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
