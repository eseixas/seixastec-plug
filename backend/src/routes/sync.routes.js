import { Router } from 'express';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { edgeAuthRequired } from '../middleware/auth.js';
import { aplicarEventoPush } from '../sync/apply.js';
import { decrypt } from '../lib/cryptoSenha.js';

// Rotas de sincronização, ATIVAS SOMENTE NA CENTRAL. O edge é cliente destas.
const router = Router();
router.use(edgeAuthRequired);

// Entidades que descem (central -> edge), com o delegate Prisma e o cursor.
// A ordem importa: dependências (ex.: produto antes de variação) primeiro.
const ENTIDADES_PULL = [
  { nome: 'loja', delegate: 'loja', cursor: 'updatedAt' },
  { nome: 'pdvTerminal', delegate: 'pDVTerminal', cursor: 'updatedAt' },
  { nome: 'user', delegate: 'user', cursor: 'updatedAt' },
  { nome: 'categoria', delegate: 'categoria', cursor: 'updatedAt' },
  { nome: 'marca', delegate: 'marca', cursor: 'updatedAt' },
  { nome: 'escalaTamanho', delegate: 'escalaTamanho', cursor: 'updatedAt' },
  { nome: 'cor', delegate: 'cor', cursor: 'updatedAt' },
  { nome: 'configuracaoFiscal', delegate: 'configuracaoFiscal', cursor: 'updatedAt' },
  { nome: 'configuracaoEmpresa', delegate: 'configuracaoEmpresa', cursor: 'updatedAt' },
  { nome: 'configuracaoPdv', delegate: 'configuracaoPdv', cursor: 'updatedAt' },
  { nome: 'configuracaoCliente', delegate: 'configuracaoCliente', cursor: 'updatedAt' },
  { nome: 'modeloEtiqueta', delegate: 'modeloEtiqueta', cursor: 'updatedAt' },
  { nome: 'serieNotaFiscal', delegate: 'serieNotaFiscal', cursor: 'updatedAt' },
  { nome: 'naturezaOperacao', delegate: 'naturezaOperacao', cursor: 'updatedAt' },
  { nome: 'adquirente', delegate: 'adquirente', cursor: 'updatedAt' },
  { nome: 'taxaAdquirente', delegate: 'taxaAdquirente', cursor: 'updatedAt' },
  { nome: 'fornecedor', delegate: 'fornecedor', cursor: 'updatedAt' },
  // grupoTributacao ANTES de produto: produto referencia o grupo.
  { nome: 'grupoTributacao', delegate: 'grupoTributacao', cursor: 'updatedAt' },
  { nome: 'produto', delegate: 'produto', cursor: 'updatedAt' },
  { nome: 'variacao', delegate: 'variacao', cursor: 'updatedAt' },
  { nome: 'cliente', delegate: 'cliente', cursor: 'updatedAt' },
];

const PAGE = 500;

// GET /api/sync/pull?cursors={"produto":"ISO", ...}
// Retorna, por entidade, as linhas alteradas desde o cursor + o novo cursor.
// MovimentacaoEstoque desce escopado à loja do edge (entradas lançadas no admin).
router.get('/pull', asyncHandler(async (req, res) => {
  let cursors = {};
  try {
    cursors = req.query.cursors ? JSON.parse(String(req.query.cursors)) : {};
  } catch {
    cursors = {};
  }

  const resultado = {};
  for (const ent of ENTIDADES_PULL) {
    const desde = cursors[ent.nome] ? new Date(cursors[ent.nome]) : null;
    const where = desde ? { [ent.cursor]: { gt: desde } } : {};
    let rows = await prisma[ent.delegate].findMany({
      where,
      orderBy: { [ent.cursor]: 'asc' },
      take: PAGE,
    });
    // ConfiguracaoEmpresa: o caminho do certificado é local à central e a
    // senha vem criptografada com a chave da central (pode divergir da chave
    // do edge — JWT_SECRET não é garantidamente igual nos dois lados). Ambos
    // descem por um endpoint dedicado (GET /api/sync/certificado) em vez do
    // pull genérico — ver worker.js do edge.
    if (ent.nome === 'configuracaoEmpresa') {
      rows = rows.map(({ certificadoArquivo, certificadoSenha, ...resto }) => resto);
    }
    const maxCursor = rows.length ? rows[rows.length - 1][ent.cursor] : null;
    resultado[ent.nome] = { rows, cursor: maxCursor };
  }

  // Movimentos de estoque desta loja (para descer entradas/ajustes feitos no admin).
  const desdeMov = cursors['movimentacaoEstoque'] ? new Date(cursors['movimentacaoEstoque']) : null;
  const movs = await prisma.movimentacaoEstoque.findMany({
    where: {
      lojaId: req.edge.lojaId,
      ...(desdeMov ? { createdAt: { gt: desdeMov } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: PAGE,
  });
  resultado['movimentacaoEstoque'] = {
    rows: movs,
    cursor: movs.length ? movs[movs.length - 1].createdAt : null,
  };

  await prisma.edgeNode.update({
    where: { id: req.edge.lojaId },
    data: { ultimoPull: new Date() },
  }).catch(() => {});

  res.json(resultado);
}));

// POST /api/sync/push  body: { eventos: [{ id, tipo, entidadeId, payload, createdAt }] }
// Ingestão idempotente. Processa em ordem (createdAt asc); cada evento em sua
// própria transação. Reenvio é seguro. Retorna ids confirmados e falhas.
router.post('/push', asyncHandler(async (req, res) => {
  const eventos = Array.isArray(req.body?.eventos) ? req.body.eventos : [];
  const acked = [];
  const falhas = [];

  for (const ev of eventos) {
    try {
      await prisma.$transaction((tx) => aplicarEventoPush(tx, ev));
      acked.push(ev.id);
    } catch (err) {
      falhas.push({ id: ev.id, erro: err.message });
    }
  }

  await prisma.edgeNode.update({
    where: { id: req.edge.lojaId },
    data: { ultimoPush: new Date(), versao: req.body?.versao || undefined },
  }).catch(() => {});

  res.json({ acked, falhas });
}));

// Entrega o arquivo .pfx + a senha do certificado (DESCRIPTOGRAFADA aqui,
// via TLS/rede interna da central para o edge) para o worker do edge baixar
// e recriptografar com a SUA própria chave local. Não reaproveitamos a senha
// criptografada com a chave da central porque JWT_SECRET não é garantido ser
// o mesmo em docker-compose.central.yml e docker-compose.edge.yml — cada um
// lê de ${JWT_SECRET} do seu próprio .env, que podem divergir.
router.get('/certificado', asyncHandler(async (req, res) => {
  const cfg = await prisma.configuracaoEmpresa.findUnique({ where: { id: 'singleton' } });
  if (!cfg?.certificadoArquivo || !fs.existsSync(cfg.certificadoArquivo)) {
    return res.status(404).json({ erro: 'Nenhum certificado configurado na central.' });
  }
  const senha = decrypt(cfg.certificadoSenha);
  res.setHeader('x-certificado-nome', encodeURIComponent(cfg.certificadoNome || 'certificado.pfx'));
  res.setHeader('x-certificado-senha', senha ? encodeURIComponent(senha) : '');
  res.setHeader('x-certificado-updated-at', cfg.updatedAt.toISOString());
  res.setHeader('Content-Type', 'application/x-pkcs12');
  fs.createReadStream(cfg.certificadoArquivo).pipe(res);
}));

// Handshake opcional: o edge se apresenta (útil para diagnóstico).
router.post('/registrar', asyncHandler(async (req, res) => {
  res.json({ ok: true, lojaId: req.edge.lojaId, nome: req.edge.nome, serverTime: new Date().toISOString() });
}));

export default router;
