import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

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

export default router;
