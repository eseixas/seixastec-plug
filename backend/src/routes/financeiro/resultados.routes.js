import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const router = Router();

const GRUPOS_RECEITA = ['RECEITA_OPERACIONAL', 'OUTRAS_RECEITAS'];
const GRUPOS_DESPESA = ['DEDUCAO_RECEITA', 'CUSTO_OPERACIONAL', 'DESPESA_OPERACIONAL', 'DESPESA_FINANCEIRA', 'OUTRAS_DESPESAS'];

function mesKey(data) {
  const d = new Date(data);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

router.get('/', asyncHandler(async (req, res) => {
  const hoje = new Date();
  const inicioAno = new Date(Date.UTC(hoje.getUTCFullYear(), 0, 1));
  const de = req.query.de ? new Date(String(req.query.de)) : inicioAno;
  const ate = req.query.ate ? new Date(String(req.query.ate) + 'T23:59:59') : hoje;

  const [despesasPagas, receitasRecebidas] = await Promise.all([
    prisma.$queryRaw`
      SELECT date_trunc('month', cp."dataPagamento") as mes, cf.grupo as grupo, SUM(cp."valorPago") as total
      FROM "ContaPagar" cp
      JOIN "CategoriaFinanceira" cf ON cf.id = cp."categoriaId"
      WHERE cp.pago = true AND cp."dataPagamento" >= ${de} AND cp."dataPagamento" <= ${ate}
      GROUP BY 1, 2
    `,
    prisma.$queryRaw`
      SELECT date_trunc('month', r."recebidoEm") as mes, COALESCE(cf.grupo, 'RECEITA_OPERACIONAL') as grupo, SUM(r."valorLiquido") as total
      FROM "Recebivel" r
      LEFT JOIN "CategoriaFinanceira" cf ON cf.id = r."categoriaId"
      WHERE r.status = 'RECEBIDO' AND r."recebidoEm" >= ${de} AND r."recebidoEm" <= ${ate}
      GROUP BY 1, 2
    `,
  ]);

  const grupos = {};
  const mesesSet = new Set();

  for (const linha of [...despesasPagas, ...receitasRecebidas]) {
    const mes = mesKey(linha.mes);
    const grupo = String(linha.grupo);
    const total = Number(linha.total);
    mesesSet.add(mes);
    grupos[grupo] ??= {};
    grupos[grupo][mes] = (grupos[grupo][mes] ?? 0) + total;
  }

  const meses = Array.from(mesesSet).sort();

  const totais = {};
  for (const mes of meses) {
    const receitas = GRUPOS_RECEITA.reduce((soma, g) => soma + (grupos[g]?.[mes] ?? 0), 0);
    const despesas = GRUPOS_DESPESA.reduce((soma, g) => soma + (grupos[g]?.[mes] ?? 0), 0);
    totais[mes] = { receitas, despesas, resultado: receitas - despesas };
  }

  res.json({ de, ate, meses, grupos, totais });
}));

export default router;
