import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const router = Router();

// `saldo` nunca é aceito do cliente — é derivado de `saldoInicial` na criação e
// mantido via increment/decrement atômico pelas rotas de pagar/receber.
const schema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(['DINHEIRO', 'CONTA_CORRENTE', 'CONTA_POUPANCA', 'CARTEIRA_DIGITAL']).default('CONTA_CORRENTE'),
  banco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  numeroConta: z.string().optional().nullable(),
  saldoInicial: z.coerce.number().optional().default(0),
  ativo: z.boolean().optional(),
  principal: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { q, ativo } = req.query;
  const where = {
    ...(q ? { nome: { contains: String(q), mode: 'insensitive' } } : {}),
    ...(ativo === 'true' ? { ativo: true } : ativo === 'false' ? { ativo: false } : {}),
  };
  const contas = await prisma.contaBancaria.findMany({
    where,
    orderBy: { nome: 'asc' },
  });
  res.json(contas);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  const conta = await prisma.$transaction(async (tx) => {
    // Só uma conta pode ser a principal por vez — desmarca as demais antes de criar.
    if (data.principal === true) {
      await tx.contaBancaria.updateMany({ where: { principal: true }, data: { principal: false } });
    }
    return tx.contaBancaria.create({ data: { ...data, saldo: data.saldoInicial } });
  });
  res.status(201).json(conta);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  const conta = await prisma.$transaction(async (tx) => {
    // Só uma conta pode ser a principal por vez — desmarca as demais antes de atualizar.
    if (data.principal === true) {
      await tx.contaBancaria.updateMany({ where: { principal: true }, data: { principal: false } });
    }
    return tx.contaBancaria.update({ where: { id: req.params.id }, data });
  });
  res.json(conta);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.contaBancaria.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
