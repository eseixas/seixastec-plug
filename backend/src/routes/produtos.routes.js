import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { gerarCodigoBarras } from '../lib/codigoBarras.js';
import { IS_EDGE, LOJA_ID } from '../config.js';

const router = Router();

// Upload de imagens dos produtos (processadas e servidas em /uploads).
export const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Recebe o arquivo em memória para processar com sharp.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Arquivo deve ser uma imagem'), { status: 400 }));
  },
});

// Converte para JPEG 300x300 (corte nas bordas, centralizado) a 96 DPI.
async function processarFoto(buffer, dest) {
  await sharp(buffer)
    .resize(300, 300, { fit: 'cover', position: 'centre' })
    .withMetadata({ density: 96 })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(dest);
}

const variacaoSchema = z.object({
  id: z.string().optional(),
  tamanho: z.string().min(1),
  cor: z.string().min(1),
  precoVenda: z.coerce.number().optional().nullable(),
});

const produtoSchema = z.object({
  referencia: z.string().optional().nullable(),
  nome: z.string().min(1),
  descricao: z.string().optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  marcaId: z.string().optional().nullable(),
  fornecedorPadraoId: z.string().optional().nullable(),
  escalaId: z.string().optional().nullable(),
  genero: z.string().optional().nullable(),
  colecao: z.string().optional().nullable(),
  estacao: z.string().optional().nullable(),
  ncm: z.string().optional().nullable(),
  cest: z.string().optional().nullable(),
  origemMercadoria: z.string().optional().nullable(),
  csosn: z.string().optional().nullable(),
  cfop: z.string().optional().nullable(),
  precoCusto: z.coerce.number().optional(),
  precoVenda: z.coerce.number().optional(),
  ativo: z.boolean().optional(),
  variacoes: z.array(variacaoSchema).optional(),
});

const slug = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

function gerarSku(base, tamanho, cor) {
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${slug(base)}-${slug(tamanho)}-${slug(cor)}-${rand}`;
}

// Aplica a grade desejada (lista de {tamanho, cor, precoVenda?}):
// cria as novas, reativa as existentes e inativa as que saíram.
// SKUs nunca são excluídos; o código de barras é preservado.
async function aplicarGrade(tx, produtoId, base, desejadas) {
  const existentes = await tx.variacao.findMany({ where: { produtoId } });
  const chave = (t, c) => `${t}||${c}`;
  const mapEx = new Map(existentes.map((v) => [chave(v.tamanho, v.cor), v]));
  const setDesej = new Set(desejadas.map((d) => chave(d.tamanho, d.cor)));
  let novos = 0, reativados = 0, inativados = 0;

  for (const d of desejadas) {
    const ex = mapEx.get(chave(d.tamanho, d.cor));
    if (ex) {
      await tx.variacao.update({
        where: { id: ex.id },
        data: { ativo: true, precoVenda: d.precoVenda ?? null },
      });
      if (!ex.ativo) reativados++;
    } else {
      await tx.variacao.create({
        data: {
          produtoId,
          tamanho: d.tamanho,
          cor: d.cor,
          sku: gerarSku(base, d.tamanho, d.cor),
          codigoBarras: null,
          precoVenda: d.precoVenda ?? null,
        },
      });
      novos++;
    }
  }
  for (const ex of existentes) {
    if (ex.ativo && !setDesej.has(chave(ex.tamanho, ex.cor))) {
      await tx.variacao.update({ where: { id: ex.id }, data: { ativo: false } });
      inativados++;
    }
  }
  return { novos, reativados, inativados };
}

// Lista com busca por nome e paginação simples.
router.get('/', asyncHandler(async (req, res) => {
  const { q, categoriaId, ativo, page = '1', limit = '20' } = req.query;
  const where = {
    ...(q ? { nome: { contains: String(q), mode: 'insensitive' } } : {}),
    ...(categoriaId ? { categoriaId: String(categoriaId) } : {}),
    // ativo: 'true' | 'false' | ausente (todos)
    ...(ativo === 'true' ? { ativo: true } : ativo === 'false' ? { ativo: false } : {}),
  };
  const take = Math.min(Number(limit) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const [total, produtos] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      include: includeProduto,
      orderBy: { nome: 'asc' },
      take,
      skip,
    }),
  ]);
  res.json({ total, page: Number(page), limit: take, data: produtos });
}));

// Busca rápida para o PDV: por nome do produto, referência, sku ou código de
// barras. Retorna sempre o produto principal (sem repetir uma linha por
// variação); a escolha de tamanho/cor é feita depois, no PDV.
router.get('/busca', asyncHandler(async (req, res) => {
  const termo = String(req.query.q || '').trim();
  if (!termo) return res.json([]);

  const lojaId = IS_EDGE ? LOJA_ID : null; // edge: saldo da loja; central: todas
  const filtroLoja = lojaId ? { lojaId } : {};

  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      OR: [
        { nome: { contains: termo, mode: 'insensitive' } },
        { referencia: { contains: termo, mode: 'insensitive' } },
        {
          variacoes: {
            some: {
              ativo: true,
              OR: [
                { sku: { equals: termo, mode: 'insensitive' } },
                { codigoBarras: { equals: termo } },
              ],
            },
          },
        },
      ],
    },
    include: {
      variacoes: {
        where: { ativo: true, estoques: { some: { estoqueAtual: { gt: 0 }, ...filtroLoja } } },
        include: { estoques: { where: filtroLoja, select: { estoqueAtual: true } } },
        orderBy: [{ tamanho: 'asc' }, { cor: 'asc' }],
      },
    },
    orderBy: { nome: 'asc' },
    take: 20,
  });

  const data = produtos
    .filter((p) => p.variacoes.length > 0)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      precoVenda: p.precoVenda,
      fotoUrl: p.fotoUrl,
      variacoes: p.variacoes.map((v) => ({
        ...v,
        estoqueAtual: v.estoques.reduce((s, e) => s + e.estoqueAtual, 0),
      })),
    }));
  res.json(data);
}));

// Vitrine do PDV: produtos COM estoque, ordenados pelos últimos vendidos.
// Paginação por offset para scroll infinito.
router.get('/vitrine', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 24, 60);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const lojaId = IS_EDGE ? LOJA_ID : null; // edge: só a loja; central: todas somadas

  // Saldo por loja vem de EstoqueLocal; "últimos vendidos" pela loja em questão.
  // A última venda é uma SUBQUERY (não um JOIN) para não multiplicar as linhas de
  // estoque no SUM — um JOIN em VendaItem faria o saldo contar N vezes (N = nº de
  // itens de venda daquela variação).
  const produtos = await prisma.$queryRaw`
    SELECT p.id, p.nome, p."precoVenda"::float AS "precoVenda", p."fotoUrl",
           SUM(el."estoqueAtual")::int AS "estoqueTotal",
           (
             SELECT MAX(vd."finalizadaEm")
             FROM "Venda" vd
             JOIN "VendaItem" vi ON vi."vendaId" = vd.id
             JOIN "Variacao" vv ON vv.id = vi."variacaoId"
             WHERE vv."produtoId" = p.id AND vd.status = 'FINALIZADA'
               AND (${lojaId}::text IS NULL OR vd."lojaId" = ${lojaId})
           ) AS "ultimaVenda"
    FROM "Produto" p
    JOIN "Variacao" v ON v."produtoId" = p.id AND v.ativo = true
    JOIN "EstoqueLocal" el ON el."variacaoId" = v.id
      AND (${lojaId}::text IS NULL OR el."lojaId" = ${lojaId})
    WHERE p.ativo = true
    GROUP BY p.id
    HAVING SUM(el."estoqueAtual") > 0
    ORDER BY "ultimaVenda" DESC NULLS LAST, p.nome ASC
    LIMIT ${limit} OFFSET ${offset}`;

  const ids = produtos.map((p) => p.id);
  const filtroLoja = lojaId ? { lojaId } : {};
  const estoques = ids.length
    ? await prisma.estoqueLocal.findMany({
        where: { estoqueAtual: { gt: 0 }, ...filtroLoja, variacao: { produtoId: { in: ids }, ativo: true } },
        select: {
          estoqueAtual: true,
          variacao: { select: { id: true, produtoId: true, tamanho: true, cor: true, sku: true, precoVenda: true, codigoBarras: true } },
        },
      })
    : [];

  // Mescla por variação (soma se houver múltiplas lojas na visão central).
  const porVariacao = new Map();
  for (const e of estoques) {
    const v = e.variacao;
    const cur = porVariacao.get(v.id);
    if (cur) cur.estoqueAtual += e.estoqueAtual;
    else porVariacao.set(v.id, { ...v, estoqueAtual: e.estoqueAtual });
  }
  const porProduto = {};
  for (const v of porVariacao.values()) (porProduto[v.produtoId] ||= []).push(v);
  for (const lista of Object.values(porProduto)) {
    lista.sort((a, b) => a.tamanho.localeCompare(b.tamanho) || a.cor.localeCompare(b.cor));
  }

  const data = produtos.map((p) => ({ ...p, variacoes: porProduto[p.id] || [] }));
  res.json({ data, nextOffset: produtos.length === limit ? offset + limit : null });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const produto = await prisma.produto.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { categoria: true, marca: true, variacoes: true },
  });
  res.json(produto);
}));

// Upload/troca da foto do produto (multipart, campo "foto").
router.post('/:id/foto', upload.single('foto'), asyncHandler(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Nenhum arquivo enviado'), { status: 400 });
  const anterior = await prisma.produto.findUnique({ where: { id: req.params.id }, select: { fotoUrl: true } });
  const filename = `${crypto.randomUUID()}.jpg`;
  await processarFoto(req.file.buffer, path.join(UPLOAD_DIR, filename));
  const fotoUrl = `/uploads/${filename}`;
  const produto = await prisma.produto.update({ where: { id: req.params.id }, data: { fotoUrl } });
  // Remove o arquivo antigo, se houver.
  if (anterior?.fotoUrl) {
    const p = path.join(UPLOAD_DIR, path.basename(anterior.fotoUrl));
    fs.promises.unlink(p).catch(() => {});
  }
  res.json(produto);
}));

router.delete('/:id/foto', asyncHandler(async (req, res) => {
  const atual = await prisma.produto.findUnique({ where: { id: req.params.id }, select: { fotoUrl: true } });
  await prisma.produto.update({ where: { id: req.params.id }, data: { fotoUrl: null } });
  if (atual?.fotoUrl) {
    fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(atual.fotoUrl))).catch(() => {});
  }
  res.status(204).end();
}));

const includeProduto = {
  variacoes: true, categoria: true, marca: true, escala: true, fornecedorPadrao: true,
};

router.post('/', asyncHandler(async (req, res) => {
  const { variacoes = [], ...data } = produtoSchema.parse(req.body);

  // Preenche dados fiscais faltantes com os padrões das configurações.
  const cfg = await prisma.configuracaoFiscal.findUnique({ where: { id: 'singleton' } });
  data.origemMercadoria = data.origemMercadoria ?? cfg?.origemMercadoria ?? null;
  data.csosn = data.csosn ?? cfg?.csosn ?? null;
  data.cfop = data.cfop ?? cfg?.cfop ?? null;
  data.ncm = data.ncm ?? cfg?.ncmPadrao ?? null;
  data.cest = data.cest ?? cfg?.cest ?? null;

  const produto = await prisma.$transaction(async (tx) => {
    const criado = await tx.produto.create({ data });
    await aplicarGrade(tx, criado.id, data.referencia || data.nome, variacoes);
    return tx.produto.findUnique({ where: { id: criado.id }, include: includeProduto });
  });
  res.status(201).json(produto);
}));

// Atualiza o produto e aplica a grade (a escala NÃO muda após a criação).
router.put('/:id', asyncHandler(async (req, res) => {
  const { variacoes, escalaId, ...data } = produtoSchema.partial().parse(req.body);
  const produto = await prisma.$transaction(async (tx) => {
    await tx.produto.update({ where: { id: req.params.id }, data });
    if (variacoes) {
      const atual = await tx.produto.findUnique({
        where: { id: req.params.id },
        select: { referencia: true, nome: true },
      });
      await aplicarGrade(tx, req.params.id, atual.referencia || atual.nome, variacoes);
    }
    return tx.produto.findUnique({ where: { id: req.params.id }, include: includeProduto });
  });
  res.json(produto);
}));

const codigoBarrasSchema = z.object({
  codigoBarras: z.string().regex(/^\d{8,14}$/, 'Código de barras deve ter entre 8 e 14 dígitos numéricos.').optional(),
});

// Gera (ou define manualmente) o código de barras de uma variação, substituindo o atual se já houver.
router.post('/:produtoId/variacoes/:variacaoId/codigo-barras', asyncHandler(async (req, res) => {
  const { produtoId, variacaoId } = req.params;
  const { codigoBarras } = codigoBarrasSchema.parse(req.body || {});
  const variacao = await prisma.variacao.findUnique({ where: { id: variacaoId } });
  if (!variacao || variacao.produtoId !== produtoId) {
    throw Object.assign(new Error('Variação não encontrada'), { status: 404 });
  }
  const atualizada = await prisma.$transaction(async (tx) => {
    let codigo = codigoBarras;
    if (codigo) {
      const existente = await tx.variacao.findUnique({ where: { codigoBarras: codigo } });
      if (existente && existente.id !== variacaoId) {
        throw Object.assign(new Error('Este código de barras já está em uso por outra variação.'), { status: 409 });
      }
    } else {
      codigo = await gerarCodigoBarras(tx);
    }
    return tx.variacao.update({ where: { id: variacaoId }, data: { codigoBarras: codigo } });
  });
  res.json(atualizada);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.produto.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
