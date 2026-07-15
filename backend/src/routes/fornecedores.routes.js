import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const schema = z.object({
  nome: z.string().min(1),
  cpfCnpj: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  telefone: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const fornecedores = await prisma.fornecedor.findMany({
    where: q ? { nome: { contains: String(q), mode: 'insensitive' } } : undefined,
    orderBy: { nome: 'asc' },
    take: 100,
  });
  res.json(fornecedores);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  if (data.email === '') data.email = null;
  const fornecedor = await prisma.fornecedor.create({ data });
  res.status(201).json(fornecedor);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  if (data.email === '') data.email = null;
  const fornecedor = await prisma.fornecedor.update({ where: { id: req.params.id }, data });
  res.json(fornecedor);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.fornecedor.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
