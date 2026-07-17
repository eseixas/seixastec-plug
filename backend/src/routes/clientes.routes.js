import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const schema = z.object({
  nome: z.string().min(1),
  cpfCnpj: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  telefone: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  limiteCredito: z.coerce.number().optional(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const clientes = await prisma.cliente.findMany({
    where: q
      ? {
          OR: [
            { nome: { contains: String(q), mode: 'insensitive' } },
            { cpfCnpj: { contains: String(q) } },
          ],
        }
      : undefined,
    orderBy: { nome: 'asc' },
    take: 100,
  });
  res.json(clientes);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: req.params.id } });
  res.json(cliente);
}));

// Valida os campos obrigatórios configurados em ConfiguracaoCliente. `dados`
// é o payload já mesclado com o registro existente (para PUT parcial).
async function validarCamposObrigatorios(req, dados) {
  const origemPdv = req.headers['x-origem'] === 'pdv';
  const cfg = await prisma.configuracaoCliente.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  if (origemPdv && !cfg.aplicarNoPdv) return;

  const digitos = (dados.cpfCnpj || '').replace(/\D/g, '');
  const ehPJ = digitos.length === 14;
  const lista = ehPJ ? cfg.camposObrigatoriosPJ : cfg.camposObrigatoriosPF;

  const faltando = [];
  for (const campo of lista) {
    if (campo === 'endereco') {
      const completo = dados.cep && dados.logradouro && dados.numero && dados.cidade && dados.uf;
      if (!completo) faltando.push('endereco');
    } else if (!dados[campo]) {
      faltando.push(campo);
    }
  }
  if (faltando.length) {
    throw Object.assign(
      new Error(`Campos obrigatórios não preenchidos: ${faltando.join(', ')}`),
      { status: 400 }
    );
  }
}

router.post('/', asyncHandler(async (req, res) => {
  const data = schema.parse(req.body);
  if (data.email === '') data.email = null;
  await validarCamposObrigatorios(req, data);
  const cliente = await prisma.cliente.create({ data });
  res.status(201).json(cliente);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = schema.partial().parse(req.body);
  if (data.email === '') data.email = null;
  const existente = await prisma.cliente.findUniqueOrThrow({ where: { id: req.params.id } });
  await validarCamposObrigatorios(req, { ...existente, ...data });
  const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data });
  res.json(cliente);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.cliente.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
