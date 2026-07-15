import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { aplicarMovimento } from '../sync/estoque.js';

const router = Router();

const itemSchema = z.object({
  variacaoId: z.string().min(1),
  lojaId: z.string().min(1),
  quantidade: z.coerce.number().int().positive(),
  custoUnitario: z.coerce.number().nonnegative(),
  valorVenda: z.coerce.number().optional().nullable(),
  previsaoChegada: z.coerce.date().optional().nullable(),
});

const parcelaSchema = z.object({
  valor: z.coerce.number().positive(),
  vencimento: z.coerce.date(),
  categoriaId: z.string().min(1),
  contaBancariaId: z.string().optional().nullable(),
});

const compraSchema = z.object({
  fornecedorId: z.string().min(1),
  numeroNota: z.string().optional().nullable(),
  serie: z.string().optional().nullable(),
  dataCompra: z.coerce.date(),
  observacoes: z.string().optional().nullable(),
  anexoUrl: z.string().optional().nullable(),
  itens: z.array(itemSchema).min(1),
  parcelas: z.array(parcelaSchema).optional().default([]),
});

const statusItemSchema = z.object({
  status: z.enum(['AGUARDANDO', 'ENTREGUE', 'CANCELADO', 'EXTRAVIADO']),
  lojaId: z.string().optional(),
});

const includeCompra = {
  fornecedor: { select: { nome: true } },
  itens: {
    include: {
      variacao: { include: { produto: { select: { nome: true } } } },
      loja: { select: { nome: true } },
    },
  },
  contasPagar: {
    select: { id: true, descricao: true, valor: true, vencimento: true, pago: true },
  },
};

// Deriva o status agregado da Compra a partir do status de cada item.
// CANCELADO e EXTRAVIADO contam como "nada pendente" para efeito de
// considerar a compra encerrada (RECEBIDA) — um item extraviado não vai
// chegar, então não deve travar a compra em PARCIAL para sempre, mesma
// lógica de "não há mais nada aguardando" que já vale para CANCELADO.
function statusCompra(itens) {
  if (itens.length === 0) return 'ABERTA';
  if (itens.every((i) => i.status === 'CANCELADO')) return 'CANCELADA';
  if (itens.every((i) => i.status === 'ENTREGUE' || i.status === 'CANCELADO' || i.status === 'EXTRAVIADO')) return 'RECEBIDA';
  if (itens.some((i) => i.status === 'ENTREGUE')) return 'PARCIAL';
  return 'ABERTA';
}

router.get('/', asyncHandler(async (req, res) => {
  const { fornecedorId, dataDe, dataAte, q, page = '1', limit = '20' } = req.query;
  const where = {
    ...(fornecedorId ? { fornecedorId: String(fornecedorId) } : {}),
    ...(q ? { numeroNota: { contains: String(q), mode: 'insensitive' } } : {}),
    ...(dataDe || dataAte
      ? {
          dataCompra: {
            ...(dataDe ? { gte: new Date(String(dataDe)) } : {}),
            ...(dataAte ? { lte: new Date(String(dataAte) + 'T23:59:59') } : {}),
          },
        }
      : {}),
  };
  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const [total, data] = await Promise.all([
    prisma.compra.count({ where }),
    prisma.compra.findMany({
      where,
      include: includeCompra,
      orderBy: { dataCompra: 'desc' },
      take,
      skip,
    }),
  ]);
  res.json({
    total,
    page: Number(page),
    limit: take,
    data: data.map((c) => ({ ...c, status: statusCompra(c.itens) })),
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const compra = await prisma.compra.findUniqueOrThrow({
    where: { id: req.params.id },
    include: includeCompra,
  });
  res.json({ ...compra, status: statusCompra(compra.itens) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = compraSchema.parse(req.body);

  const resultado = await prisma.$transaction(async (tx) => {
    const agg = await tx.compra.aggregate({ _max: { numero: true } });
    const numero = (agg._max.numero || 0) + 1;

    const compra = await tx.compra.create({
      data: {
        fornecedorId: data.fornecedorId,
        numero,
        numeroNota: data.numeroNota ?? null,
        serie: data.serie ?? null,
        dataCompra: data.dataCompra,
        observacoes: data.observacoes ?? null,
        anexoUrl: data.anexoUrl ?? null,
        itens: {
          create: data.itens.map((i) => ({
            variacaoId: i.variacaoId,
            lojaId: i.lojaId,
            quantidade: i.quantidade,
            custoUnitario: i.custoUnitario,
            valorVenda: i.valorVenda ?? null,
            previsaoChegada: i.previsaoChegada ?? null,
          })),
        },
      },
      include: { fornecedor: true },
    });

    if (data.parcelas.length > 0) {
      for (const parcela of data.parcelas) {
        await tx.contaPagar.create({
          data: {
            descricao: `Compra #${numero} - ${compra.fornecedor.nome}`,
            categoriaId: parcela.categoriaId,
            fornecedorId: data.fornecedorId,
            contaBancariaId: parcela.contaBancariaId ?? null,
            valor: parcela.valor,
            vencimento: parcela.vencimento,
            compraId: compra.id,
            pago: false,
          },
        });
      }
    }

    return tx.compra.findUniqueOrThrow({
      where: { id: compra.id },
      include: includeCompra,
    });
  });

  res.status(201).json({ ...resultado, status: statusCompra(resultado.itens) });
}));

router.post('/:id/itens/:itemId/status', asyncHandler(async (req, res) => {
  const body = statusItemSchema.parse(req.body);

  const resultado = await prisma.$transaction(async (tx) => {
    const item = await tx.compraItem.findUniqueOrThrow({
      where: { id: req.params.itemId },
      include: { compra: true },
    });

    if (item.compraId !== req.params.id) {
      throw Object.assign(new Error('Item não pertence a esta compra'), { status: 400 });
    }

    if (body.status === 'ENTREGUE') {
      if (item.movimentacaoId) {
        throw Object.assign(new Error('Item já foi recebido'), { status: 400 });
      }

      const lojaId = body.lojaId || item.lojaId;
      const movId = crypto.randomUUID();

      await aplicarMovimento(tx, {
        id: movId,
        variacaoId: item.variacaoId,
        lojaId,
        tipo: 'ENTRADA',
        quantidade: item.quantidade,
        custoUnit: item.custoUnitario,
        categoria: 'COMPRA',
        fornecedorId: item.compra.fornecedorId,
        motivo: `Recebimento Compra #${item.compra.numero}`,
        usuarioId: req.user.sub,
      }, { enqueue: true });

      await tx.compraItem.update({
        where: { id: item.id },
        data: {
          status: 'ENTREGUE',
          movimentacaoId: movId,
          ...(body.lojaId ? { lojaId: body.lojaId } : {}),
        },
      });

      if (item.valorVenda !== null) {
        await tx.variacao.update({
          where: { id: item.variacaoId },
          data: { precoVenda: item.valorVenda },
        });
      }
    } else {
      await tx.compraItem.update({
        where: { id: item.id },
        data: { status: body.status },
      });
    }

    return tx.compra.findUniqueOrThrow({
      where: { id: req.params.id },
      include: includeCompra,
    });
  });

  res.json({ ...resultado, status: statusCompra(resultado.itens) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const compra = await prisma.compra.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { itens: true },
  });

  if (compra.itens.some((i) => i.movimentacaoId)) {
    throw Object.assign(new Error('Não é possível excluir uma compra com itens já recebidos'), { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.contaPagar.deleteMany({ where: { compraId: req.params.id } });
    await tx.compra.delete({ where: { id: req.params.id } });
  });

  res.status(204).end();
}));

export default router;
