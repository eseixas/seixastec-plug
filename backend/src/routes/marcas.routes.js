import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const schema = z.object({
  nome: z.string().min(1),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const marcas = await prisma.marca.findMany({
    where: q ? { nome: { contains: String(q), mode: 'insensitive' } } : undefined,
    orderBy: { nome: 'asc' },
  });
  res.json(marcas);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  const marca = await prisma.marca.create({ data });
  res.status(201).json(marca);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  const marca = await prisma.marca.update({ where: { id: req.params.id }, data });
  res.json(marca);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.marca.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
