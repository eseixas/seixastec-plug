import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

// Lançamento manual de recebível (sem venda associada — ex.: aluguel, reembolso).
const manualSchema = z.object({
  descricao: z.string().min(1),
  categoriaId: z.string().min(1),
  valorBruto: z.coerce.number().positive(),
  dataPrevista: z.coerce.date(),
  clienteId: z.string().optional().nullable(),
  contaBancariaId: z.string().optional().nullable(),
  adquirenteId: z.string().optional().nullable(),
});

const receberSchema = z.object({
  contaBancariaId: z.string().optional().nullable(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { status, de, ate, adquirenteId, categoriaId, contaBancariaId, clienteId } = req.query;
  const where = {
    ...(status ? { status: String(status) } : {}),
    ...(adquirenteId ? { adquirenteId: String(adquirenteId) } : {}),
    ...(categoriaId ? { categoriaId: String(categoriaId) } : {}),
    ...(contaBancariaId ? { contaBancariaId: String(contaBancariaId) } : {}),
    ...(clienteId ? { clienteId: String(clienteId) } : {}),
    ...(de || ate
      ? {
          dataPrevista: {
            ...(de ? { gte: new Date(String(de)) } : {}),
            ...(ate ? { lte: new Date(String(ate) + 'T23:59:59') } : {}),
          },
        }
      : {}),
  };
  const [itens, resumo] = await Promise.all([
    prisma.recebivel.findMany({
      where,
      include: {
        adquirente: { select: { nome: true } },
        venda: { select: { numero: true } },
        pagamento: { select: { forma: true } },
      },
      orderBy: { dataPrevista: 'asc' },
      take: 500,
    }),
    prisma.recebivel.groupBy({
      by: ['status'],
      where,
      _sum: { valorLiquido: true, valorBruto: true, taxaValor: true },
    }),
  ]);
  res.json({ itens, resumo });
}));

// Lançamento manual de recebível (sem venda/pagamento associados).
router.post('/', asyncHandler(async (req, res) => {
  const data = manualSchema.parse(req.body);
  const recebivel = await prisma.recebivel.create({
    data: {
      vendaId: null,
      pagamentoId: null,
      descricao: data.descricao,
      categoriaId: data.categoriaId,
      valorBruto: data.valorBruto,
      valorLiquido: data.valorBruto,
      taxaValor: 0,
      dataPrevista: data.dataPrevista,
      clienteId: data.clienteId ?? null,
      contaBancariaId: data.contaBancariaId ?? null,
      adquirenteId: data.adquirenteId ?? null,
      status: 'PENDENTE',
      parcelaNumero: 1,
      totalParcelas: 1,
    },
  });
  res.status(201).json(recebivel);
}));

// Marca um recebível como recebido e credita a conta bancária (se houver).
router.post('/:id/receber', asyncHandler(async (req, res) => {
  const body = receberSchema.parse(req.body ?? {});

  const resultado = await prisma.$transaction(async (tx) => {
    const recebivel = await tx.recebivel.findUniqueOrThrow({ where: { id: req.params.id } });
    // Só recebíveis pendentes: receber duas vezes creditaria a conta em dobro.
    if (recebivel.status !== 'PENDENTE') {
      throw Object.assign(
        new Error(`Recebível não está pendente (status atual: ${recebivel.status})`),
        { status: 400 }
      );
    }
    const contaBancariaId = body.contaBancariaId || recebivel.contaBancariaId;

    const atualizado = await tx.recebivel.update({
      where: { id: recebivel.id },
      data: {
        status: 'RECEBIDO',
        recebidoEm: new Date(),
        ...(body.contaBancariaId ? { contaBancariaId: body.contaBancariaId } : {}),
      },
    });

    if (contaBancariaId) {
      await tx.contaBancaria.update({
        where: { id: contaBancariaId },
        data: { saldo: { increment: Number(recebivel.valorLiquido) } },
      });
    }

    return atualizado;
  });

  res.json(resultado);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = manualSchema.partial().parse(req.body);
  const existente = await prisma.recebivel.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existente.vendaId != null) {
    throw Object.assign(new Error('Recebível originado de venda não pode ser editado diretamente'), { status: 400 });
  }
  // Recebível manual não tem taxa: o líquido acompanha o bruto (como na criação).
  const recebivel = await prisma.recebivel.update({
    where: { id: req.params.id },
    data: data.valorBruto !== undefined ? { ...data, valorLiquido: data.valorBruto } : data,
  });
  res.json(recebivel);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existente = await prisma.recebivel.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existente.vendaId != null) {
    throw Object.assign(new Error('Recebível originado de venda não pode ser excluído diretamente'), { status: 400 });
  }
  await prisma.recebivel.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
