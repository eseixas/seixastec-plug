import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const schema = z.object({
  nome: z.string().min(1),
  tamanhos: z.array(z.string().min(1)).min(1),
  ordem: z.coerce.number().int().optional(),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const escalas = await prisma.escalaTamanho.findMany({
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
  res.json(escalas);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  const escala = await prisma.escalaTamanho.create({ data });
  res.status(201).json(escala);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  const escala = await prisma.escalaTamanho.update({ where: { id: req.params.id }, data });
  res.json(escala);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.escalaTamanho.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
