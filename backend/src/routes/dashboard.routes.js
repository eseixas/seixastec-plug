import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

// Resumo para a home: faturamento do dia/mês, ticket médio, nº de vendas,
// produtos com estoque baixo e série dos últimos 14 dias.
router.get('/resumo', asyncHandler(async (req, res) => {
  const hoje = new Date();
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const catorzeDias = new Date(inicioDia);
  catorzeDias.setDate(catorzeDias.getDate() - 13);

  const [vendasHoje, vendasMes, totalClientes, totalProdutos] = await Promise.all([
    prisma.venda.aggregate({
      _sum: { total: true },
      _count: true,
      where: { status: 'FINALIZADA', finalizadaEm: { gte: inicioDia } },
    }),
    prisma.venda.aggregate({
      _sum: { total: true },
      _count: true,
      where: { status: 'FINALIZADA', finalizadaEm: { gte: inicioMes } },
    }),
    prisma.cliente.count({ where: { ativo: true } }),
    prisma.produto.count({ where: { ativo: true } }),
  ]);

  const serie = await prisma.$queryRaw`
    SELECT to_char(date_trunc('day', "finalizadaEm"), 'YYYY-MM-DD') AS dia,
           COALESCE(SUM(total), 0)::float AS total
    FROM "Venda"
    WHERE status = 'FINALIZADA' AND "finalizadaEm" >= ${catorzeDias}
    GROUP BY 1 ORDER BY 1 ASC`;

  const estoqueBaixo = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n
    FROM "Variacao"
    WHERE ativo = true AND "estoqueAtual" <= "estoqueMinimo"`;

  const faturamentoMes = Number(vendasMes._sum.total || 0);
  const qtdMes = vendasMes._count || 0;

  res.json({
    faturamentoHoje: Number(vendasHoje._sum.total || 0),
    vendasHoje: vendasHoje._count || 0,
    faturamentoMes,
    vendasMes: qtdMes,
    ticketMedioMes: qtdMes ? faturamentoMes / qtdMes : 0,
    totalClientes,
    totalProdutos,
    estoqueBaixo: estoqueBaixo[0]?.n || 0,
    serie,
  });
}));

// Top produtos vendidos no mês.
router.get('/top-produtos', asyncHandler(async (req, res) => {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const rows = await prisma.$queryRaw`
    SELECT p.nome, SUM(vi.quantidade)::int AS qtd, SUM(vi.total)::float AS total
    FROM "VendaItem" vi
    JOIN "Venda" v ON v.id = vi."vendaId"
    JOIN "Variacao" va ON va.id = vi."variacaoId"
    JOIN "Produto" p ON p.id = va."produtoId"
    WHERE v.status = 'FINALIZADA' AND v."finalizadaEm" >= ${inicioMes}
    GROUP BY p.nome ORDER BY qtd DESC LIMIT 10`;
  res.json(rows);
}));

export default router;
