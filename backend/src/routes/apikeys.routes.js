import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { hashApiKey } from '../middleware/auth.js';

const router = Router();

// Lista as chaves (sem expor o valor bruto, que só aparece na criação).
router.get('/', asyncHandler(async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    select: {
      id: true, nome: true, prefixo: true, ativo: true, ultimoUso: true, createdAt: true,
      usuario: { select: { nome: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(keys);
}));

// Gera uma nova chave. Retorna o valor bruto UMA ÚNICA VEZ.
router.post('/', asyncHandler(async (req, res) => {
  const { nome, usuarioId } = z
    .object({ nome: z.string().min(1), usuarioId: z.string().optional().nullable() })
    .parse(req.body);

  const bruto = 'sk_' + crypto.randomBytes(24).toString('hex');
  const registro = await prisma.apiKey.create({
    data: {
      nome,
      prefixo: bruto.slice(0, 10),
      chaveHash: hashApiKey(bruto),
      usuarioId: usuarioId || req.user.sub,
    },
  });
  res.status(201).json({ id: registro.id, nome: registro.nome, chave: bruto, prefixo: registro.prefixo });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { ativo } = z.object({ ativo: z.boolean() }).parse(req.body);
  const registro = await prisma.apiKey.update({ where: { id: req.params.id }, data: { ativo } });
  res.json({ id: registro.id, ativo: registro.ativo });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.apiKey.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
