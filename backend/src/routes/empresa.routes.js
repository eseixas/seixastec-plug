// Dados da empresa: logotipo e certificado digital A1 (upload feito no admin
// central; desce para o edge via sync — ver sync.routes.js/sync/worker.js).
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import forge from 'node-forge';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { encrypt } from '../lib/cryptoSenha.js';
import { UPLOAD_DIR } from './produtos.routes.js';

const router = Router();

// Diretório do certificado — FORA de UPLOAD_DIR (que é servido publicamente
// em /uploads via express.static no server.js). Nunca registrar rota estática
// apontando para cá.
export const CERTS_DIR = process.env.CERTS_DIR || '/app/certs';
fs.mkdirSync(CERTS_DIR, { recursive: true });

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Arquivo deve ser uma imagem'), { status: 400 }));
  },
});

const uploadCertificado = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(pfx|p12)$/i.test(file.originalname)) cb(null, true);
    else cb(Object.assign(new Error('O arquivo deve ser .pfx ou .p12'), { status: 400 }));
  },
});

async function getSingleton() {
  return prisma.configuracaoEmpresa.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

// Extrai a validade do .pfx, se a senha estiver correta. Retorna null em vez
// de lançar — extração de validade é auxiliar, não deve bloquear o upload.
function extrairValidade(pfxBuffer, senha) {
  try {
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
    return certBag?.cert?.validity?.notAfter || null;
  } catch {
    return null;
  }
}

function serializar(cfg) {
  return {
    logoUrl: cfg.logoUrl,
    temCertificado: Boolean(cfg.certificadoArquivo),
    temSenha: Boolean(cfg.certificadoSenha),
    certificadoNome: cfg.certificadoNome,
    certificadoValidade: cfg.certificadoValidade,
    updatedAt: cfg.updatedAt,
    // NUNCA incluir certificadoSenha (nem criptografada) na resposta.
  };
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(serializar(await getSingleton()));
}));

// ---- Logotipo ----------------------------------------------------------

router.put('/logo', uploadLogo.single('logo'), asyncHandler(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Nenhum arquivo enviado'), { status: 400 });
  const anterior = await getSingleton();
  const filename = `empresa-logo-${crypto.randomUUID()}.png`;
  await sharp(req.file.buffer)
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 90 })
    .toFile(path.join(UPLOAD_DIR, filename));
  const logoUrl = `/uploads/${filename}`;
  const cfg = await prisma.configuracaoEmpresa.update({ where: { id: 'singleton' }, data: { logoUrl } });
  if (anterior?.logoUrl) {
    fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(anterior.logoUrl))).catch(() => {});
  }
  res.json(serializar(cfg));
}));

router.delete('/logo', asyncHandler(async (req, res) => {
  const atual = await getSingleton();
  const cfg = await prisma.configuracaoEmpresa.update({ where: { id: 'singleton' }, data: { logoUrl: null } });
  if (atual?.logoUrl) {
    fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(atual.logoUrl))).catch(() => {});
  }
  res.json(serializar(cfg));
}));

// ---- Certificado digital A1 --------------------------------------------

const senhaSchema = z.object({ senha: z.string().min(1).optional() });

router.put('/certificado', uploadCertificado.single('certificado'), asyncHandler(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Nenhum arquivo enviado (campo "certificado")'), { status: 400 });
  const { senha } = senhaSchema.parse(req.body);

  const anterior = await getSingleton();
  const filename = `empresa-certificado-${crypto.randomUUID()}.pfx`;
  const destino = path.join(CERTS_DIR, filename);
  await fs.promises.writeFile(destino, req.file.buffer);

  const validade = senha ? extrairValidade(req.file.buffer, senha) : null;

  const cfg = await prisma.configuracaoEmpresa.update({
    where: { id: 'singleton' },
    data: {
      certificadoArquivo: destino,
      certificadoNome: req.file.originalname,
      ...(senha ? { certificadoSenha: encrypt(senha) } : {}),
      certificadoValidade: validade,
    },
  });

  if (anterior?.certificadoArquivo && anterior.certificadoArquivo !== destino) {
    fs.promises.unlink(anterior.certificadoArquivo).catch(() => {});
  }
  res.json(serializar(cfg));
}));

// Atualiza só a senha (ex.: reenviar depois de errar na primeira tentativa,
// sem reenviar o arquivo).
router.put('/certificado/senha', asyncHandler(async (req, res) => {
  const { senha } = z.object({ senha: z.string().min(1) }).parse(req.body);
  const atual = await getSingleton();
  let validade = atual.certificadoValidade;
  if (atual.certificadoArquivo && fs.existsSync(atual.certificadoArquivo)) {
    const buf = await fs.promises.readFile(atual.certificadoArquivo);
    validade = extrairValidade(buf, senha) || validade;
  }
  const cfg = await prisma.configuracaoEmpresa.update({
    where: { id: 'singleton' },
    data: { certificadoSenha: encrypt(senha), certificadoValidade: validade },
  });
  res.json(serializar(cfg));
}));

router.delete('/certificado', asyncHandler(async (req, res) => {
  const atual = await getSingleton();
  const cfg = await prisma.configuracaoEmpresa.update({
    where: { id: 'singleton' },
    data: { certificadoArquivo: null, certificadoNome: null, certificadoSenha: null, certificadoValidade: null },
  });
  if (atual?.certificadoArquivo) {
    fs.promises.unlink(atual.certificadoArquivo).catch(() => {});
  }
  res.json(serializar(cfg));
}));

export default router;
