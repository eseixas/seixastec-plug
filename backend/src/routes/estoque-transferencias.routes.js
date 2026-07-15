import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getSaldo, aplicarMovimento } from '../sync/estoque.js';

const router = Router();

const transferenciaSchema = z.object({
  lojaOrigemId: z.string().min(1),
  lojaDestinoId: z.string().min(1),
  observacao: z.string().optional().nullable(),
  itens: z.array(z.object({
    variacaoId: z.string().min(1),
    quantidade: z.coerce.number().int().positive(),
  })).min(1),
});

router.get('/', asyncHandler(async (req, res) => {
  const transferencias = await prisma.transferenciaEstoque.findMany({
    include: {
      lojaOrigem: { select: { id: true, nome: true } },
      lojaDestino: { select: { id: true, nome: true } },
      usuario: { select: { nome: true } },
      movimentacoes: {
        include: { variacao: { include: { produto: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(transferencias);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = transferenciaSchema.parse(req.body);
  if (data.lojaOrigemId === data.lojaDestinoId) {
    throw Object.assign(new Error('Loja de origem e destino devem ser diferentes'), { status: 400 });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const transferencia = await tx.transferenciaEstoque.create({
      data: {
        lojaOrigemId: data.lojaOrigemId,
        lojaDestinoId: data.lojaDestinoId,
        usuarioId: req.user.sub,
        observacao: data.observacao ?? null,
      },
    });

    for (const item of data.itens) {
      await tx.variacao.findUniqueOrThrow({ where: { id: item.variacaoId } });
      const saldo = await getSaldo(tx, data.lojaOrigemId, item.variacaoId);
      if (saldo - item.quantidade < 0) {
        throw Object.assign(new Error(`Estoque insuficiente na loja de origem para a variação ${item.variacaoId}`), { status: 400 });
      }

      const movSaidaId = crypto.randomUUID();
      const movEntradaId = crypto.randomUUID();

      await aplicarMovimento(tx, {
        id: movSaidaId,
        variacaoId: item.variacaoId,
        lojaId: data.lojaOrigemId,
        tipo: 'SAIDA',
        quantidade: item.quantidade,
        categoria: 'TRANSFERENCIA',
        transferenciaId: transferencia.id,
        motivo: `Transferência para loja destino`,
        usuarioId: req.user.sub,
      }, { enqueue: true });

      await aplicarMovimento(tx, {
        id: movEntradaId,
        variacaoId: item.variacaoId,
        lojaId: data.lojaDestinoId,
        tipo: 'ENTRADA',
        quantidade: item.quantidade,
        categoria: 'TRANSFERENCIA',
        transferenciaId: transferencia.id,
        motivo: `Transferência de loja origem`,
        usuarioId: req.user.sub,
      }, { enqueue: true });
    }

    return tx.transferenciaEstoque.findUnique({
      where: { id: transferencia.id },
      include: {
        lojaOrigem: { select: { id: true, nome: true } },
        lojaDestino: { select: { id: true, nome: true } },
        movimentacoes: { include: { variacao: { include: { produto: true } } } },
      },
    });
  });

  res.status(201).json(resultado);
}));

export default router;
