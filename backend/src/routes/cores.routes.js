import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const schema = z.object({
  nome: z.string().min(1),
  hex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor hex inválida'),
  ordem: z.coerce.number().int().optional(),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const cores = await prisma.cor.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] });
  res.json(cores);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  const cor = await prisma.cor.create({ data });
  res.status(201).json(cor);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  const cor = await prisma.cor.update({ where: { id: req.params.id }, data });
  res.json(cor);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.cor.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
