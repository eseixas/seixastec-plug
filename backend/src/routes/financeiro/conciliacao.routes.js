import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { parseOfx } from '../../lib/ofxParser.js';
import { parseCsvExtrato } from '../../lib/csvExtratoParser.js';
import { buscarCandidatos, valorEfetivoContaPagar } from '../../lib/conciliacaoMatch.js';

const router = Router();

// Extrato bancário chega em memória (arquivo texto pequeno: OFX/CSV).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const tipoEnum = z.enum(['RECEBIVEL', 'CONTA_PAGAR']);
const vinculoSchema = z.object({ tipo: tipoEnum, id: z.string().min(1) });

// Erro de negócio padrão (mesmo padrão dos outros arquivos de financeiro).
function erro(status, message) {
  return Object.assign(new Error(message), { status });
}

// ---------------------------------------------------------------------------
// GET /pendentes — Recebiveis RECEBIDO e ContasPagar pagas ainda não
// conciliados, em formato unificado ordenado por data.
// ---------------------------------------------------------------------------
router.get('/pendentes', asyncHandler(async (req, res) => {
  const { contaBancariaId, de, ate } = req.query;
  if (!contaBancariaId) throw erro(400, 'contaBancariaId é obrigatório');

  const periodo = (de || ate)
    ? {
        ...(de ? { gte: new Date(String(de)) } : {}),
        ...(ate ? { lte: new Date(String(ate) + 'T23:59:59.999') } : {}),
      }
    : undefined;

  const [recebiveis, contasPagar] = await Promise.all([
    prisma.recebivel.findMany({
      where: {
        status: 'RECEBIDO',
        conciliado: false,
        contaBancariaId: String(contaBancariaId),
        ...(periodo ? { recebidoEm: periodo } : {}),
      },
      include: { cliente: { select: { nome: true } } },
    }),
    prisma.contaPagar.findMany({
      where: {
        pago: true,
        conciliado: false,
        contaBancariaId: String(contaBancariaId),
        ...(periodo ? { dataPagamento: periodo } : {}),
      },
      include: { fornecedor: { select: { nome: true } } },
    }),
  ]);

  const itens = [
    ...recebiveis.map((r) => ({
      tipo: 'RECEBIVEL',
      id: r.id,
      data: r.recebidoEm,
      valor: Number(r.valorLiquido),
      descricao: r.descricao || r.cliente?.nome || 'Recebível',
    })),
    ...contasPagar.map((c) => ({
      tipo: 'CONTA_PAGAR',
      id: c.id,
      data: c.dataPagamento,
      valor: -valorEfetivoContaPagar(c),
      descricao: c.descricao || c.fornecedor?.nome || 'Conta a pagar',
    })),
  ].sort((a, b) => new Date(a.data) - new Date(b.data));

  res.json(itens);
}));

// ---------------------------------------------------------------------------
// POST /manual — marca um Recebivel/ContaPagar como conciliado (MANUAL).
// ---------------------------------------------------------------------------
router.post('/manual', asyncHandler(async (req, res) => {
  const { tipo, id } = vinculoSchema.parse(req.body);
  const dados = { conciliado: true, dataConciliacao: new Date(), origemConciliacao: 'MANUAL' };

  if (tipo === 'RECEBIVEL') {
    const r = await prisma.recebivel.update({ where: { id }, data: dados });
    return res.json({ tipo, id: r.id, conciliado: r.conciliado });
  }
  const c = await prisma.contaPagar.update({ where: { id }, data: dados });
  res.json({ tipo, id: c.id, conciliado: c.conciliado });
}));

// ---------------------------------------------------------------------------
// POST /desconciliar — reverte a conciliação; se houver LancamentoExtrato
// vinculado, desvincula e volta o lançamento para PENDENTE.
// ---------------------------------------------------------------------------
router.post('/desconciliar', asyncHandler(async (req, res) => {
  const { tipo, id } = vinculoSchema.parse(req.body);
  const reverter = { conciliado: false, dataConciliacao: null, origemConciliacao: null };

  await prisma.$transaction(async (tx) => {
    if (tipo === 'RECEBIVEL') {
      await tx.recebivel.update({ where: { id }, data: reverter });
      await tx.lancamentoExtrato.updateMany({
        where: { recebivelId: id },
        data: { recebivelId: null, status: 'PENDENTE' },
      });
    } else {
      await tx.contaPagar.update({ where: { id }, data: reverter });
      await tx.lancamentoExtrato.updateMany({
        where: { contaPagarId: id },
        data: { contaPagarId: null, status: 'PENDENTE' },
      });
    }
  });

  res.json({ tipo, id, conciliado: false });
}));

// ---------------------------------------------------------------------------
// POST /importar — upload de extrato (OFX/CSV), parse, matching automático.
// ---------------------------------------------------------------------------
router.post('/importar', upload.single('arquivo'), asyncHandler(async (req, res) => {
  const contaBancariaId = req.body?.contaBancariaId;
  const formato = req.body?.formato;
  if (!contaBancariaId) throw erro(400, 'contaBancariaId é obrigatório');
  if (formato !== 'OFX' && formato !== 'CSV') throw erro(400, "formato deve ser 'OFX' ou 'CSV'");
  if (!req.file) throw erro(400, 'Arquivo (campo "arquivo") é obrigatório');

  const conta = await prisma.contaBancaria.findUnique({ where: { id: contaBancariaId } });
  if (!conta) throw erro(404, 'Conta bancária não encontrada');

  const conteudo = req.file.buffer.toString('utf8');
  const linhas = formato === 'OFX' ? parseOfx(conteudo) : parseCsvExtrato(conteudo);

  const usuarioId = req.user?.id || req.user?.sub || null;

  const resultado = await prisma.$transaction(async (tx) => {
    const importacao = await tx.importacaoExtrato.create({
      data: {
        contaBancariaId,
        formato,
        nomeArquivo: req.file.originalname || `extrato.${formato.toLowerCase()}`,
        usuarioId: usuarioId || undefined,
        totalLinhas: linhas.length,
      },
    });

    let conciliadosAuto = 0;
    let pendentesRevisao = 0;

    for (const linha of linhas) {
      // Passa `tx` para que os registros já conciliados nesta importação
      // sejam naturalmente excluídos dos candidatos das linhas seguintes.
      const { match, id } = await buscarCandidatos(linha, contaBancariaId, tx);

      if (match === 'RECEBIVEL' && id) {
        await tx.recebivel.update({
          where: { id },
          data: { conciliado: true, dataConciliacao: new Date(), origemConciliacao: 'IMPORTADA' },
        });
        await tx.lancamentoExtrato.create({
          data: {
            importacaoId: importacao.id,
            data: linha.data,
            valor: linha.valor,
            descricao: linha.descricao || null,
            fitId: linha.fitId || null,
            recebivelId: id,
            status: 'CONCILIADO',
          },
        });
        conciliadosAuto++;
      } else if (match === 'CONTA_PAGAR' && id) {
        await tx.contaPagar.update({
          where: { id },
          data: { conciliado: true, dataConciliacao: new Date(), origemConciliacao: 'IMPORTADA' },
        });
        await tx.lancamentoExtrato.create({
          data: {
            importacaoId: importacao.id,
            data: linha.data,
            valor: linha.valor,
            descricao: linha.descricao || null,
            fitId: linha.fitId || null,
            contaPagarId: id,
            status: 'CONCILIADO',
          },
        });
        conciliadosAuto++;
      } else {
        await tx.lancamentoExtrato.create({
          data: {
            importacaoId: importacao.id,
            data: linha.data,
            valor: linha.valor,
            descricao: linha.descricao || null,
            fitId: linha.fitId || null,
            status: 'PENDENTE',
          },
        });
        pendentesRevisao++;
      }
    }

    return {
      importacaoId: importacao.id,
      total: linhas.length,
      conciliadosAuto,
      pendentesRevisao,
    };
  }, { timeout: 30000 });

  res.status(201).json(resultado);
}));

// ---------------------------------------------------------------------------
// GET /importacoes/:id — detalhe da importação com seus lançamentos.
// ---------------------------------------------------------------------------
router.get('/importacoes/:id', asyncHandler(async (req, res) => {
  const importacao = await prisma.importacaoExtrato.findUnique({
    where: { id: req.params.id },
    include: {
      contaBancaria: { select: { nome: true } },
      lancamentos: {
        orderBy: { data: 'asc' },
        include: {
          recebivel: { select: { id: true, descricao: true, valorLiquido: true } },
          contaPagar: { select: { id: true, descricao: true, valor: true } },
        },
      },
    },
  });
  if (!importacao) throw erro(404, 'Importação não encontrada');
  res.json(importacao);
}));

// ---------------------------------------------------------------------------
// POST /importacoes/:importacaoId/lancamentos/:lancamentoId/casar
// Pareamento manual: vincula o lançamento ao Recebivel/ContaPagar.
// ---------------------------------------------------------------------------
router.post(
  '/importacoes/:importacaoId/lancamentos/:lancamentoId/casar',
  asyncHandler(async (req, res) => {
    const { tipo, id } = vinculoSchema.parse(req.body);
    const { importacaoId, lancamentoId } = req.params;

    const resultado = await prisma.$transaction(async (tx) => {
      const lanc = await tx.lancamentoExtrato.findUnique({ where: { id: lancamentoId } });
      if (!lanc || lanc.importacaoId !== importacaoId) throw erro(404, 'Lançamento não encontrado');
      if (lanc.status === 'CONCILIADO') throw erro(400, 'Lançamento já está conciliado');

      const dadosConc = { conciliado: true, dataConciliacao: new Date(), origemConciliacao: 'IMPORTADA' };

      if (tipo === 'RECEBIVEL') {
        const r = await tx.recebivel.findUnique({ where: { id } });
        if (!r) throw erro(404, 'Recebível não encontrado');
        if (r.conciliado) throw erro(400, 'Recebível já está conciliado');
        await tx.recebivel.update({ where: { id }, data: dadosConc });
        return tx.lancamentoExtrato.update({
          where: { id: lancamentoId },
          data: { recebivelId: id, contaPagarId: null, status: 'CONCILIADO' },
        });
      }

      const c = await tx.contaPagar.findUnique({ where: { id } });
      if (!c) throw erro(404, 'Conta a pagar não encontrada');
      if (c.conciliado) throw erro(400, 'Conta a pagar já está conciliada');
      await tx.contaPagar.update({ where: { id }, data: dadosConc });
      return tx.lancamentoExtrato.update({
        where: { id: lancamentoId },
        data: { contaPagarId: id, recebivelId: null, status: 'CONCILIADO' },
      });
    });

    res.json(resultado);
  })
);

// ---------------------------------------------------------------------------
// POST /importacoes/:importacaoId/lancamentos/:lancamentoId/ignorar
// Marca o lançamento como IGNORADO (sem contrapartida no sistema).
// ---------------------------------------------------------------------------
router.post(
  '/importacoes/:importacaoId/lancamentos/:lancamentoId/ignorar',
  asyncHandler(async (req, res) => {
    const { importacaoId, lancamentoId } = req.params;
    const lanc = await prisma.lancamentoExtrato.findUnique({ where: { id: lancamentoId } });
    if (!lanc || lanc.importacaoId !== importacaoId) throw erro(404, 'Lançamento não encontrado');
    if (lanc.status === 'CONCILIADO') throw erro(400, 'Desvincule o lançamento antes de ignorá-lo');

    const atualizado = await prisma.lancamentoExtrato.update({
      where: { id: lancamentoId },
      data: { status: 'IGNORADO', recebivelId: null, contaPagarId: null },
    });
    res.json(atualizado);
  })
);

export default router;
