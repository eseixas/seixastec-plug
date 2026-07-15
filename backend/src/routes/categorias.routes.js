import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const schema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const categorias = await prisma.categoria.findMany({
    where: q ? { nome: { contains: String(q), mode: 'insensitive' } } : undefined,
    orderBy: { nome: 'asc' },
  });
  res.json(categorias);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  const categoria = await prisma.categoria.create({ data });
  res.status(201).json(categoria);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  const categoria = await prisma.categoria.update({ where: { id: req.params.id }, data });
  res.json(categoria);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.categoria.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
