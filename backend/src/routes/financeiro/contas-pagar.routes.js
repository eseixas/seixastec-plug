import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const router = Router();

const schema = z.object({
  descricao: z.string().min(1),
  categoriaId: z.string().min(1),
  fornecedorId: z.string().optional().nullable(),
  contaBancariaId: z.string().optional().nullable(),
  valor: z.coerce.number().positive(),
  desconto: z.coerce.number().optional().default(0),
  juros: z.coerce.number().optional().default(0),
  vencimento: z.coerce.date(),
  observacoes: z.string().optional().nullable(),
  anexoUrl: z.string().optional().nullable(),
});

const pagarSchema = z.object({
  contaBancariaId: z.string().optional().nullable(),
  dataPagamento: z.coerce.date().optional(),
  valorPago: z.coerce.number().optional(),
});

const includeContaPagar = {
  categoria: { select: { nome: true, grupo: true } },
  fornecedor: { select: { nome: true } },
  contaBancaria: { select: { nome: true } },
};

router.get('/', asyncHandler(async (req, res) => {
  const {
    q, pago, categoriaId, fornecedorId, contaBancariaId,
    vencDe, vencAte, page = '1', limit = '20',
  } = req.query;
  const where = {
    ...(q ? { descricao: { contains: String(q), mode: 'insensitive' } } : {}),
    ...(pago === 'true' ? { pago: true } : pago === 'false' ? { pago: false } : {}),
    ...(categoriaId ? { categoriaId: String(categoriaId) } : {}),
    ...(fornecedorId ? { fornecedorId: String(fornecedorId) } : {}),
    ...(contaBancariaId ? { contaBancariaId: String(contaBancariaId) } : {}),
    ...(vencDe || vencAte
      ? {
          vencimento: {
            ...(vencDe ? { gte: new Date(String(vencDe)) } : {}),
            ...(vencAte ? { lte: new Date(String(vencAte) + 'T23:59:59') } : {}),
          },
        }
      : {}),
  };
  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const [total, data] = await Promise.all([
    prisma.contaPagar.count({ where }),
    prisma.contaPagar.findMany({
      where,
      include: includeContaPagar,
      orderBy: { vencimento: 'asc' },
      take,
      skip,
    }),
  ]);
  res.json({ total, page: Number(page), limit: take, data });
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  const conta = await prisma.contaPagar.create({
    data: { ...data, pago: false },
    include: includeContaPagar,
  });
  res.status(201).json(conta);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  const existente = await prisma.contaPagar.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existente.compraId != null) {
    throw Object.assign(new Error('Conta a pagar originada de compra não pode ser editada diretamente'), { status: 400 });
  }
  const conta = await prisma.contaPagar.update({
    where: { id: req.params.id },
    data,
    include: includeContaPagar,
  });
  res.json(conta);
}));

router.post('/:id/pagar', asyncHandler(async (req, res) => {
  const body = pagarSchema.parse(req.body);

  const resultado = await prisma.$transaction(async (tx) => {
    const contaPagar = await tx.contaPagar.findUniqueOrThrow({ where: { id: req.params.id } });

    if (contaPagar.pago === true) {
      throw Object.assign(new Error('Conta já está paga'), { status: 400 });
    }

    const valorPagoFinal = body.valorPago ?? (Number(contaPagar.valor) - Number(contaPagar.desconto) + Number(contaPagar.juros));
    const contaBancariaId = body.contaBancariaId || contaPagar.contaBancariaId;

    const atualizado = await tx.contaPagar.update({
      where: { id: contaPagar.id },
      data: {
        pago: true,
        dataPagamento: body.dataPagamento ?? new Date(),
        valorPago: valorPagoFinal,
        ...(body.contaBancariaId ? { contaBancariaId: body.contaBancariaId } : {}),
      },
      include: includeContaPagar,
    });

    if (contaBancariaId) {
      await tx.contaBancaria.update({
        where: { id: contaBancariaId },
        data: { saldo: { decrement: valorPagoFinal } },
      });
    }

    return atualizado;
  });

  res.json(resultado);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existente = await prisma.contaPagar.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existente.compraId != null) {
    throw Object.assign(new Error('Conta a pagar originada de compra não pode ser excluída diretamente'), { status: 400 });
  }
  await prisma.contaPagar.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
