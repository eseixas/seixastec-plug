import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const router = Router();

const schema = z.object({
  contaOrigemId: z.string().min(1),
  contaDestinoId: z.string().min(1),
  valor: z.coerce.number().positive(),
  data: z.coerce.date().optional(),
  descricao: z.string().optional().nullable(),
});

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);

  if (data.contaOrigemId === data.contaDestinoId) {
    throw Object.assign(new Error('A conta de origem e destino não podem ser a mesma'), { status: 400 });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const transferencia = await tx.transferenciaContas.create({
      data: {
        contaOrigemId: data.contaOrigemId,
        contaDestinoId: data.contaDestinoId,
        valor: data.valor,
        data: data.data ?? new Date(),
        descricao: data.descricao ?? null,
      },
    });

    await tx.contaBancaria.update({
      where: { id: data.contaOrigemId },
      data: { saldo: { decrement: data.valor } },
    });

    await tx.contaBancaria.update({
      where: { id: data.contaDestinoId },
      data: { saldo: { increment: data.valor } },
    });

    return transferencia;
  });

  res.status(201).json(resultado);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.$transaction(async (tx) => {
    const transferencia = await tx.transferenciaContas.findUniqueOrThrow({ where: { id: req.params.id } });

    await tx.contaBancaria.update({
      where: { id: transferencia.contaOrigemId },
      data: { saldo: { increment: transferencia.valor } },
    });

    await tx.contaBancaria.update({
      where: { id: transferencia.contaDestinoId },
      data: { saldo: { decrement: transferencia.valor } },
    });

    await tx.transferenciaContas.delete({ where: { id: req.params.id } });
  });

  res.status(204).end();
}));

export default router;
