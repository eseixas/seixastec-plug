// Rotas fiscais — só registradas no edge (é lá que a venda e a NFC-e
// acontecem). Consulta de status por venda, reenvio manual e DANFCE mínima.
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import archiver from 'archiver';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { enfileirar } from '../sync/outbox.js';
import { IS_EDGE, LOJA_ID, FISCAL_CERT_PATH } from '../config.js';
import { cancelarNfce } from '../fiscal/soap/cancelamento.js';
import { inutilizarNumeracao } from '../fiscal/soap/inutilizacao.js';
import { statusCertificado, recarregarCertificado } from '../fiscal/certificado.js';
import { proximoNumero } from '../fiscal/numeracao.js';
import { montarXmlProc, nomeArquivoXml } from '../fiscal/xml/procNfe.js';

const router = Router();

const uploadCertificado = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.pfx$|\.p12$/i.test(file.originalname)) cb(null, true);
    else cb(Object.assign(new Error('O arquivo deve ser .pfx ou .p12'), { status: 400 }));
  },
});

// Prazo usual de cancelamento por UF (a maioria, incl. SVRS/RJ, usa 24h) —
// checagem "soft" no nosso lado; a SEFAZ é a fonte de verdade e pode
// rejeitar mesmo dentro dessa janela (ex. período de apuração encerrado).
const PRAZO_CANCELAMENTO_HORAS = 24;

// Status do certificado configurado (validade, ou erro se ausente/inválido)
// — evita precisar entrar no container pra checar.
router.get('/certificado/status', asyncHandler(async (req, res) => {
  if (!IS_EDGE) {
    return res.status(400).json({ erro: 'Certificado só existe no edge da loja.' });
  }
  res.json(statusCertificado());
}));

// Upload do certificado A1 (.pfx). Só a senha/CSC continuam vindo de env
// (FISCAL_CERT_SENHA/FISCAL_CSC/FISCAL_ID_CSC em .env.edge) — trocar esses
// ainda exige reiniciar o container; o arquivo em si já fica ativo na hora.
router.post('/certificado', uploadCertificado.single('certificado'), asyncHandler(async (req, res) => {
  if (!IS_EDGE) {
    return res.status(400).json({ erro: 'Upload de certificado só pode ser feito no edge da loja.' });
  }
  if (!req.file) {
    return res.status(400).json({ erro: 'Nenhum arquivo enviado (campo "certificado").' });
  }
  const destino = FISCAL_CERT_PATH || '/app/certs/certificado.pfx';
  await fs.promises.mkdir(path.dirname(destino), { recursive: true }).catch(() => {});
  await fs.promises.writeFile(destino, req.file.buffer);
  recarregarCertificado();
  const status = statusCertificado();
  if (!status.ok) {
    return res.status(422).json({ erro: `Certificado salvo, mas não pôde ser lido: ${status.erro}. Confira a senha em FISCAL_CERT_SENHA.` });
  }
  res.json({ ok: true, validade: status.validade });
}));

router.get('/notas/venda/:vendaId', asyncHandler(async (req, res) => {
  const nota = await prisma.notaFiscal.findFirst({
    where: { vendaId: req.params.vendaId, modelo: '65' },
    orderBy: { createdAt: 'desc' },
  });
  if (!nota) return res.status(404).json({ erro: 'Nenhuma NFC-e para esta venda.' });
  res.json(nota);
}));

router.get('/notas', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const notas = await prisma.notaFiscal.findMany({
    where: status ? { status: String(status) } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(notas);
}));

// Força reprocessamento de uma nota REJEITADA/em ERRO (volta para PENDENTE;
// o worker fiscal pega no próximo ciclo). Só existe worker fiscal no edge —
// na central, isso deixaria a nota presa em PENDENTE até a próxima sync.
router.post('/notas/:id/reenviar', asyncHandler(async (req, res) => {
  if (!IS_EDGE) {
    return res.status(400).json({ erro: 'Reenvio só pode ser feito no edge da loja (onde o worker fiscal roda).' });
  }
  const nota = await prisma.notaFiscal.update({
    where: { id: req.params.id },
    data: { status: 'PENDENTE', tentativas: 0, motivoRejeicao: null },
  });
  await enfileirar(prisma, 'nota_fiscal', nota.id, nota);
  res.json(nota);
}));

// Cancela uma NFC-e/NF-e autorizada. Só no edge (é lá que o certificado e o
// contexto da SEFAZ existem).
router.post('/notas/:id/cancelar', asyncHandler(async (req, res) => {
  if (!IS_EDGE) {
    return res.status(400).json({ erro: 'Cancelamento só pode ser feito no edge da loja.' });
  }
  const { justificativa } = z.object({ justificativa: z.string().min(15) }).parse(req.body);

  const nota = await prisma.notaFiscal.findUniqueOrThrow({ where: { id: req.params.id }, include: { loja: true } });
  if (nota.status !== 'AUTORIZADA') {
    return res.status(409).json({ erro: `Só é possível cancelar notas autorizadas (status atual: ${nota.status}).` });
  }
  const horasDesdeAutorizacao = (Date.now() - new Date(nota.autorizadaEm).getTime()) / 3_600_000;
  if (horasDesdeAutorizacao > PRAZO_CANCELAMENTO_HORAS) {
    return res.status(409).json({
      erro: `Prazo usual de cancelamento (${PRAZO_CANCELAMENTO_HORAS}h) já passou — a SEFAZ pode rejeitar mesmo assim.`,
    });
  }

  const resultado = await cancelarNfce({
    chaveAcesso: nota.chaveAcesso,
    cnpj: nota.loja.cnpj,
    protocolo: nota.protocolo,
    justificativa,
    ambiente: nota.ambiente,
    uf: nota.loja.uf,
  });

  if (!resultado.cancelado) {
    return res.status(422).json({ erro: `SEFAZ rejeitou o cancelamento: ${resultado.cStat} - ${resultado.xMotivo}` });
  }

  const atualizada = await prisma.notaFiscal.update({
    where: { id: nota.id },
    data: { status: 'CANCELADA', canceladaEm: new Date(), motivoRejeicao: null },
  });
  await enfileirar(prisma, 'nota_fiscal', atualizada.id, atualizada);
  res.json(atualizada);
}));

// Inutiliza uma faixa de numeração nunca usada (ex.: erro de sistema pulou
// um número). Só no edge. Reserva os números como NotaFiscal INUTILIZADA
// para que proximoNumero() nunca os reutilize.
router.post('/inutilizar', asyncHandler(async (req, res) => {
  if (!IS_EDGE) {
    return res.status(400).json({ erro: 'Inutilização só pode ser feita no edge da loja.' });
  }
  const dados = z.object({
    modelo: z.enum(['65', '55']),
    serie: z.coerce.number().int().positive(),
    numeroInicial: z.coerce.number().int().positive(),
    numeroFinal: z.coerce.number().int().positive(),
    justificativa: z.string().min(15),
  }).parse(req.body);
  if (dados.numeroFinal < dados.numeroInicial) {
    return res.status(400).json({ erro: 'numeroFinal não pode ser menor que numeroInicial.' });
  }
  if (dados.numeroFinal - dados.numeroInicial > 100) {
    return res.status(400).json({ erro: 'Faixa grande demais para inutilizar de uma vez (máx. 100 números).' });
  }

  const cfgFiscal = await prisma.configuracaoFiscal.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
  const loja = await prisma.loja.findUniqueOrThrow({ where: { id: LOJA_ID } });

  const resultado = await inutilizarNumeracao({
    cnpj: loja.cnpj,
    modelo: dados.modelo,
    serie: dados.serie,
    numeroInicial: dados.numeroInicial,
    numeroFinal: dados.numeroFinal,
    justificativa: dados.justificativa,
    ambiente: cfgFiscal.ambiente,
    uf: loja.uf,
  });

  if (!resultado.inutilizada) {
    return res.status(422).json({ erro: `SEFAZ rejeitou a inutilização: ${resultado.cStat} - ${resultado.xMotivo}` });
  }

  // Reserva cada número da faixa como NotaFiscal INUTILIZADA (idempotente:
  // se já existir uma nota real com esse número, não sobrescreve).
  const criadas = [];
  for (let n = dados.numeroInicial; n <= dados.numeroFinal; n++) {
    const existente = await prisma.notaFiscal.findUnique({
      where: { lojaId_modelo_serie_numero: { lojaId: loja.id, modelo: dados.modelo, serie: dados.serie, numero: n } },
    });
    if (existente) continue;
    const nota = await prisma.notaFiscal.create({
      data: {
        modelo: dados.modelo,
        serie: dados.serie,
        numero: n,
        lojaId: loja.id,
        ambiente: cfgFiscal.ambiente,
        status: 'INUTILIZADA',
        protocolo: resultado.protocolo,
        motivoRejeicao: dados.justificativa,
      },
    });
    await enfileirar(prisma, 'nota_fiscal', nota.id, nota);
    criadas.push(nota);
  }

  res.json({ protocolo: resultado.protocolo, numerosInutilizados: criadas.map((n) => n.numero) });
}));

const itemManualSchema = z.object({
  nome: z.string().min(1),
  ncm: z.string().min(4),
  cfop: z.string().min(4),
  quantidade: z.coerce.number().positive(),
  valorUnitario: z.coerce.number().nonnegative(),
  unidade: z.string().optional(),
});

const destinatarioSchema = z.object({
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  nome: z.string().min(1),
  ie: z.string().optional(),
  indIEDest: z.enum(['1', '2', '9']).optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  codigoMunicipioIbge: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().length(2).optional(),
  cep: z.string().optional(),
}).refine((d) => d.cnpj || d.cpf, { message: 'Informe CNPJ ou CPF do destinatário.' });

// Lança uma NF-e (55) manual — transferência entre lojas, devolução a
// fornecedor, venda B2B — sem Venda associada. Só no edge (mesma fila/worker
// da NFC-e, só muda o XML montado).
router.post('/notas/nfe-manual', asyncHandler(async (req, res) => {
  if (!IS_EDGE) {
    return res.status(400).json({ erro: 'Emissão de NF-e só pode ser feita no edge da loja.' });
  }
  const dados = z.object({
    naturezaOperacao: z.string().min(1),
    destinatario: destinatarioSchema,
    itens: z.array(itemManualSchema).min(1),
  }).parse(req.body);

  const cfgFiscal = await prisma.configuracaoFiscal.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });

  const nota = await prisma.$transaction(async (tx) => {
    const numero = await proximoNumero(tx, { lojaId: LOJA_ID, modelo: '55', serie: cfgFiscal.serieNfe });
    return tx.notaFiscal.create({
      data: {
        modelo: '55',
        serie: cfgFiscal.serieNfe,
        numero,
        lojaId: LOJA_ID,
        ambiente: cfgFiscal.ambiente,
        status: 'PENDENTE',
        dadosManual: dados,
      },
    });
  });
  await enfileirar(prisma, 'nota_fiscal', nota.id, nota);
  res.status(201).json(nota);
}));

// DANFCE mínima: dados da nota + QR Code (sem impressão térmica nesta leva).
router.get('/notas/:id/danfce', asyncHandler(async (req, res) => {
  const nota = await prisma.notaFiscal.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { venda: { include: { itens: { include: { variacao: { include: { produto: true } } } } } }, loja: true },
  });
  if (nota.status !== 'AUTORIZADA' || !nota.qrCodeUrl) {
    return res.status(409).json({ erro: `NFC-e ainda não autorizada (status atual: ${nota.status}).` });
  }
  const qrCodeDataUrl = await QRCode.toDataURL(nota.qrCodeUrl);
  res.json({
    chaveAcesso: nota.chaveAcesso,
    protocolo: nota.protocolo,
    numero: nota.numero,
    serie: nota.serie,
    ambiente: nota.ambiente,
    autorizadaEm: nota.autorizadaEm,
    qrCodeUrl: nota.qrCodeUrl,
    qrCodeDataUrl,
    loja: { nome: nota.loja.nome, cnpj: nota.loja.cnpj },
    itens: nota.venda?.itens?.map((i) => ({
      nome: i.variacao.produto.nome,
      quantidade: i.quantidade,
      precoUnit: i.precoUnit,
      total: i.total,
    })) || [],
    total: nota.venda?.total,
  });
}));

// Exportação em .zip dos XMLs de um período (filtros opcionais de modelo/status).
router.get('/notas/exportar-zip', asyncHandler(async (req, res) => {
  const { de, ate, modelo, status } = req.query;
  const where = {
    xmlAssinado: { not: null },
    ...(modelo ? { modelo: String(modelo) } : {}),
    ...(status ? { status: String(status) } : {}),
    ...(de || ate
      ? {
          autorizadaEm: {
            ...(de ? { gte: new Date(String(de)) } : {}),
            ...(ate ? { lte: new Date(String(ate) + 'T23:59:59') } : {}),
          },
        }
      : {}),
  };
  const notas = await prisma.notaFiscal.findMany({ where, orderBy: { autorizadaEm: 'asc' } });
  if (notas.length === 0) {
    return res.status(404).json({ erro: 'Nenhuma nota com XML disponível no período/filtros informados.' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="notas-fiscais-${de || 'inicio'}_a_${ate || 'fim'}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => { throw err; });
  archive.pipe(res);

  for (const nota of notas) {
    const xml = montarXmlProc(nota);
    if (xml) archive.append(xml, { name: nomeArquivoXml(nota) });
  }

  await archive.finalize();
}));

// Download do XML padrão nfeProc (NFe + protocolo) de uma nota específica.
router.get('/notas/:id/xml', asyncHandler(async (req, res) => {
  const nota = await prisma.notaFiscal.findUniqueOrThrow({ where: { id: req.params.id } });
  const xml = montarXmlProc(nota);
  if (!xml) return res.status(404).json({ erro: 'Esta nota ainda não tem XML disponível.' });
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivoXml(nota)}"`);
  res.send(xml);
}));

export default router;
