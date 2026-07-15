import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const adquirenteSchema = z.object({
  nome: z.string().min(1),
  ativo: z.boolean().optional(),
});

const taxaSchema = z.object({
  forma: z.enum(['PIX', 'DEBITO', 'CREDITO', 'DEPOSITO', 'LINK']),
  parcelas: z.coerce.number().int().positive().default(1),
  taxaPercentual: z.coerce.number().nonnegative(),
  taxaFixa: z.coerce.number().nonnegative().optional(),
  prazoRecebimentoDias: z.coerce.number().int().nonnegative().optional(),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const adquirentes = await prisma.adquirente.findMany({
    include: { taxas: { orderBy: [{ forma: 'asc' }, { parcelas: 'asc' }] } },
    orderBy: { nome: 'asc' },
  });
  res.json(adquirentes);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = adquirenteSchema.parse(req.body);
  const adquirente = await prisma.adquirente.create({ data });
  res.status(201).json(adquirente);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = adquirenteSchema.partial().parse(req.body);
  const adquirente = await prisma.adquirente.update({ where: { id: req.params.id }, data });
  res.json(adquirente);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.adquirente.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// --- Taxas do adquirente ---
router.post('/:id/taxas', asyncHandler(async (req, res) => {
  const data = taxaSchema.parse(req.body);
  const taxa = await prisma.taxaAdquirente.create({
    data: { ...data, taxaFixa: data.taxaFixa ?? 0, prazoRecebimentoDias: data.prazoRecebimentoDias ?? 0, adquirenteId: req.params.id },
  });
  res.status(201).json(taxa);
}));

router.put('/taxas/:taxaId', asyncHandler(async (req, res) => {
  const data = taxaSchema.partial().parse(req.body);
  const taxa = await prisma.taxaAdquirente.update({ where: { id: req.params.taxaId }, data });
  res.json(taxa);
}));

router.delete('/taxas/:taxaId', asyncHandler(async (req, res) => {
  await prisma.taxaAdquirente.delete({ where: { id: req.params.taxaId } });
  res.status(204).end();
}));

export default router;
