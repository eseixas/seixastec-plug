import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { MotivoMovimentacao } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { IS_EDGE, LOJA_ID } from '../config.js';
import { getSaldo, aplicarMovimento } from '../sync/estoque.js';

const router = Router();

const movSchema = z.object({
  variacaoId: z.string().min(1),
  lojaId: z.string().optional().nullable(), // ignorado no edge (usa LOJA_ID)
  tipo: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE']),
  quantidade: z.coerce.number().int().positive(),
  custoUnit: z.coerce.number().optional().nullable(),
  motivo: z.string().optional().nullable(),
  categoria: z.nativeEnum(MotivoMovimentacao).optional().nullable(),
  fornecedorId: z.string().optional().nullable(),
});

router.get('/movimentacoes', asyncHandler(async (req, res) => {
  const { variacaoId, lojaId } = req.query;
  const movs = await prisma.movimentacaoEstoque.findMany({
    where: {
      ...(variacaoId ? { variacaoId: String(variacaoId) } : {}),
      ...(lojaId ? { lojaId: String(lojaId) } : {}),
    },
    include: {
      variacao: { include: { produto: true } },
      loja: { select: { nome: true } },
      fornecedor: true,
      usuario: { select: { nome: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(movs);
}));

// Produtos com estoque abaixo do mínimo, por loja (EstoqueLocal).
// No edge, escopa à própria loja; na central pode filtrar por ?lojaId.
router.get('/baixo', asyncHandler(async (req, res) => {
  const lojaId = IS_EDGE ? LOJA_ID : (req.query.lojaId ? String(req.query.lojaId) : null);
  const rows = await prisma.$queryRaw`
    SELECT el.id, el."lojaId", l.nome AS loja, v.id AS "variacaoId", v.sku, v.tamanho, v.cor,
           el."estoqueAtual", el."estoqueMinimo", p.nome AS produto
    FROM "EstoqueLocal" el
    JOIN "Variacao" v ON v.id = el."variacaoId"
    JOIN "Produto" p ON p.id = v."produtoId"
    JOIN "Loja" l ON l.id = el."lojaId"
    WHERE v.ativo = true
      AND el."estoqueAtual" <= el."estoqueMinimo"
      AND (${lojaId}::text IS NULL OR el."lojaId" = ${lojaId})
    ORDER BY l.nome ASC, p.nome ASC`;
  res.json(rows);
}));

// Lista estática dos motivos padronizados, para o frontend popular o Select.
router.get('/motivos', asyncHandler(async (req, res) => {
  res.json(Object.values(MotivoMovimentacao));
}));

// Saldo consolidado por variação (soma de todas as lojas) + detalhamento por loja.
router.get('/saldos', asyncHandler(async (req, res) => {
  const { variacaoId } = req.query;
  const rows = await prisma.estoqueLocal.findMany({
    where: variacaoId ? { variacaoId: String(variacaoId) } : undefined,
    include: {
      loja: { select: { id: true, nome: true } },
      variacao: { select: { id: true, sku: true, tamanho: true, cor: true, produto: { select: { nome: true } } } },
    },
    orderBy: [{ variacaoId: 'asc' }, { lojaId: 'asc' }],
  });
  res.json(rows);
}));

router.post('/movimentacoes', asyncHandler(async (req, res) => {
  const data = movSchema.parse(req.body);
  let lojaId = IS_EDGE ? LOJA_ID : data.lojaId || null;
  if (!lojaId && !IS_EDGE) {
    const u = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { lojaId: true } });
    lojaId = u?.lojaId || null;
  }
  if (!lojaId) {
    throw Object.assign(new Error('lojaId é obrigatório (loja de destino do estoque)'), { status: 400 });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    await tx.variacao.findUniqueOrThrow({ where: { id: data.variacaoId } });
    if (data.tipo === 'SAIDA') {
      const saldo = await getSaldo(tx, lojaId, data.variacaoId);
      if (saldo - data.quantidade < 0) {
        throw Object.assign(new Error('Estoque insuficiente'), { status: 400 });
      }
    }
    const mov = {
      id: crypto.randomUUID(),
      variacaoId: data.variacaoId,
      lojaId,
      tipo: data.tipo,
      quantidade: data.quantidade,
      custoUnit: data.custoUnit ?? null,
      motivo: data.motivo ?? null,
      categoria: data.categoria ?? null,
      fornecedorId: data.fornecedorId ?? null,
      usuarioId: req.user.sub,
    };
    // enqueue: no edge sobe pelo outbox; na central desce ao edge via pull.
    await aplicarMovimento(tx, mov, { enqueue: true });
    return tx.movimentacaoEstoque.findUnique({ where: { id: mov.id } });
  });
  res.status(201).json(resultado);
}));

export default router;
