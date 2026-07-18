import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { hashApiKey, requireRole } from '../middleware/auth.js';

const router = Router();

// Leitura fica aberta a qualquer autenticado (PDV usa lojas/terminais);
// escrita e provisionamento de edge são administrativos.
const adminOuGerente = requireRole('ADMIN', 'GERENTE');

const lojaSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().optional().nullable(),
  ie: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  matriz: z.boolean().optional(),
  ativo: z.boolean().optional(),
  crt: z.coerce.number().int().min(1).max(3).optional().nullable(),
  inscricaoMunicipal: z.string().optional().nullable(),
  codigoMunicipioIbge: z.string().optional().nullable(),
});

const terminalSchema = z.object({
  lojaId: z.string().min(1),
  nome: z.string().min(1),
  identificador: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const lojas = await prisma.loja.findMany({
    include: { terminais: true },
    orderBy: [{ matriz: 'desc' }, { nome: 'asc' }],
  });
  res.json(lojas);
}));

router.post('/', adminOuGerente, asyncHandler(async (req, res) => {
  const data = lojaSchema.parse(req.body);
  const loja = await prisma.loja.create({ data });
  res.status(201).json(loja);
}));

router.put('/:id', adminOuGerente, asyncHandler(async (req, res) => {
  const data = lojaSchema.partial().parse(req.body);
  const loja = await prisma.loja.update({ where: { id: req.params.id }, data });
  res.json(loja);
}));

router.delete('/:id', adminOuGerente, asyncHandler(async (req, res) => {
  await prisma.loja.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// --- Edges (servidores locais das lojas) ---
// Status de sincronização de cada loja/edge, para o painel do admin.
router.get('/edges', asyncHandler(async (req, res) => {
  const [edges, lojas] = await Promise.all([
    prisma.edgeNode.findMany({ orderBy: { nome: 'asc' } }),
    prisma.loja.findMany({ select: { id: true, nome: true } }),
  ]);
  const nomePorLoja = Object.fromEntries(lojas.map((l) => [l.id, l.nome]));
  res.json(
    edges.map((e) => ({
      lojaId: e.id,
      nome: nomePorLoja[e.id] || e.nome,
      versao: e.versao,
      ultimoPush: e.ultimoPush,
      ultimoPull: e.ultimoPull,
    }))
  );
}));

// Provisiona (ou regenera o token de) um edge para uma loja. Retorna o token
// BRUTO uma única vez — configure-o no EDGE_SYNC_TOKEN do edge daquela loja.
// Gerar/regenerar token dá acesso total ao canal de sync (inclusive hashes de
// senha dos usuários que descem ao edge) — restrito a ADMIN.
router.post('/edges', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { lojaId } = z.object({ lojaId: z.string().min(1) }).parse(req.body);
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: lojaId } });
  const token = `edge_${crypto.randomBytes(24).toString('hex')}`;
  await prisma.edgeNode.upsert({
    where: { id: lojaId },
    update: { nome: loja.nome, tokenHash: hashApiKey(token) },
    create: { id: lojaId, nome: loja.nome, tokenHash: hashApiKey(token) },
  });
  res.status(201).json({ lojaId, nome: loja.nome, token });
}));

// --- Terminais de PDV ---
router.get('/terminais/todos', asyncHandler(async (req, res) => {
  const terminais = await prisma.pDVTerminal.findMany({
    include: { loja: { select: { nome: true } } },
    orderBy: { nome: 'asc' },
  });
  res.json(terminais);
}));

router.post('/terminais', adminOuGerente, asyncHandler(async (req, res) => {
  const data = terminalSchema.parse(req.body);
  const terminal = await prisma.pDVTerminal.create({ data });
  res.status(201).json(terminal);
}));

router.put('/terminais/:id', adminOuGerente, asyncHandler(async (req, res) => {
  const data = terminalSchema.partial().parse(req.body);
  const terminal = await prisma.pDVTerminal.update({ where: { id: req.params.id }, data });
  res.json(terminal);
}));

router.delete('/terminais/:id', adminOuGerente, asyncHandler(async (req, res) => {
  await prisma.pDVTerminal.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
