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
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  limiteCredito: z.coerce.number().optional(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const clientes = await prisma.cliente.findMany({
    where: q
      ? {
          OR: [
            { nome: { contains: String(q), mode: 'insensitive' } },
            { cpfCnpj: { contains: String(q) } },
          ],
        }
      : undefined,
    orderBy: { nome: 'asc' },
    take: 100,
  });
  res.json(clientes);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json(cliente);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  if (data.email === '') data.email = null;
  const cliente = await prisma.cliente.create({ data });
  res.status(201).json(cliente);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  if (data.email === '') data.email = null;
  const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data });
  res.json(cliente);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.cliente.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
