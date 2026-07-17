import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const fiscalSchema = z.object({
  origemMercadoria: z.string().min(1),
  csosn: z.string().min(1),
  cfop: z.string().min(1),
  ncmPadrao: z.string().optional().nullable(),
  cest: z.string().optional().nullable(),
  ambiente: z.enum(['homologacao', 'producao']).optional(),
  serieNfce: z.coerce.number().int().positive().optional(),
  serieNfe: z.coerce.number().int().positive().optional(),
  idCsc: z.string().optional().nullable(),
});

// Retorna (criando se preciso) a configuração fiscal padrão.
router.get('/fiscal', asyncHandler(async (req, res) => {
  const cfg = await prisma.configuracaoFiscal.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  res.json(cfg);
}));

router.put('/fiscal', asyncHandler(async (req, res) => {
  const data = fiscalSchema.parse(req.body);
  const cfg = await prisma.configuracaoFiscal.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
  res.json(cfg);
}));

const pdvSchema = z.object({
  exigirGerenteCancelamento: z.boolean().optional(),
  exigirGerenteDesconto: z.boolean().optional(),
  descontoHabilitado: z.boolean().optional(),
  descontoMaximoPercentual: z.coerce.number().min(0).max(100).optional().nullable(),
  bloquearVendaSemEstoque: z.boolean().optional(),
  exigirAprovacaoFechamento: z.boolean().optional(),
});

// Leitura liberada a qualquer usuário autenticado (o PDV precisa consultar
// as regras antes de vender). Escrita restrita a ADMIN/GERENTE, abaixo.
router.get('/pdv', asyncHandler(async (req, res) => {
  const cfg = await prisma.configuracaoPdv.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  res.json(cfg);
}));

router.put('/pdv', requireRole('ADMIN', 'GERENTE'), asyncHandler(async (req, res) => {
  const data = pdvSchema.parse(req.body);
  const cfg = await prisma.configuracaoPdv.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
  res.json(cfg);
}));

const CAMPOS_VALIDOS = ['cpfCnpj', 'email', 'telefone', 'endereco'];
const clienteConfigSchema = z.object({
  camposObrigatoriosPF: z.array(z.enum(CAMPOS_VALIDOS)).optional(),
  camposObrigatoriosPJ: z.array(z.enum(CAMPOS_VALIDOS)).optional(),
  aplicarNoPdv: z.boolean().optional(),
});

router.get('/cliente', asyncHandler(async (req, res) => {
  const cfg = await prisma.configuracaoCliente.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  res.json(cfg);
}));

router.put('/cliente', requireRole('ADMIN', 'GERENTE'), asyncHandler(async (req, res) => {
  const data = clienteConfigSchema.parse(req.body);
  const cfg = await prisma.configuracaoCliente.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  });
  res.json(cfg);
}));

export default router;
