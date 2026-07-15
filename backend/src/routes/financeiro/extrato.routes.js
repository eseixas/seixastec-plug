import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

const router = Router();

function rangeFiltro(campo, de, ate) {
  if (!de && !ate) return {};
  return {
    [campo]: {
      ...(de ? { gte: new Date(String(de)) } : {}),
      ...(ate ? { lte: new Date(String(ate) + 'T23:59:59') } : {}),
    },
  };
}

async function montarExtrato(conta, de, ate) {
  const [recebiveis, contasPagar, recebiveisPendentes, contasPagarPendentes, transferenciasSaida, transferenciasEntrada] = await Promise.all([
    prisma.recebivel.findMany({
      where: {
        contaBancariaId: conta.id,
        status: 'RECEBIDO',
        ...rangeFiltro('recebidoEm', de, ate),
      },
      select: {
        id: true,
        vendaId: true,
        valorLiquido: true,
        recebidoEm: true,
        descricao: true,
        venda: { select: { numero: true } },
      },
    }),
    prisma.contaPagar.findMany({
      where: {
        contaBancariaId: conta.id,
        pago: true,
        ...rangeFiltro('dataPagamento', de, ate),
      },
      select: {
        id: true,
        compraId: true,
        valorPago: true,
        dataPagamento: true,
        descricao: true,
      },
    }),
    prisma.recebivel.findMany({
      where: { contaBancariaId: conta.id, status: 'PENDENTE' },
      select: {
        id: true,
        vendaId: true,
        valorLiquido: true,
        dataPrevista: true,
        descricao: true,
        venda: { select: { numero: true } },
      },
      orderBy: { dataPrevista: 'asc' },
    }),
    prisma.contaPagar.findMany({
      where: { contaBancariaId: conta.id, pago: false },
      select: {
        id: true,
        compraId: true,
        valor: true,
        desconto: true,
        juros: true,
        vencimento: true,
        descricao: true,
      },
      orderBy: { vencimento: 'asc' },
    }),
    prisma.transferenciaContas.findMany({
      where: { contaOrigemId: conta.id, ...rangeFiltro('data', de, ate) },
      select: { id: true, valor: true, data: true, descricao: true, contaDestino: { select: { nome: true } } },
    }),
    prisma.transferenciaContas.findMany({
      where: { contaDestinoId: conta.id, ...rangeFiltro('data', de, ate) },
      select: { id: true, valor: true, data: true, descricao: true, contaOrigem: { select: { nome: true } } },
    }),
  ]);

  const movimentosRecebimento = recebiveis.map((r) => ({
    id: r.id,
    origem: 'RECEBIVEL',
    manual: r.vendaId == null,
    data: r.recebidoEm,
    tipo: 'RECEBIMENTO',
    descricao: r.descricao || (r.venda ? `Venda #${r.venda.numero}` : 'Recebível'),
    valor: Number(r.valorLiquido),
    valorBruto: Number(r.valorLiquido),
  }));

  const movimentosPagamento = contasPagar.map((c) => ({
    id: c.id,
    origem: 'CONTA_PAGAR',
    manual: c.compraId == null,
    data: c.dataPagamento,
    tipo: 'PAGAMENTO',
    descricao: c.descricao,
    valor: -Number(c.valorPago),
    valorBruto: Number(c.valorPago),
  }));

  const movimentosTransferenciaSaida = transferenciasSaida.map((t) => ({
    id: t.id,
    origem: 'TRANSFERENCIA',
    manual: true,
    data: t.data,
    tipo: 'PAGAMENTO',
    descricao: t.descricao || `Transferência para ${t.contaDestino.nome}`,
    valor: -Number(t.valor),
    valorBruto: Number(t.valor),
  }));

  const movimentosTransferenciaEntrada = transferenciasEntrada.map((t) => ({
    id: t.id,
    origem: 'TRANSFERENCIA',
    manual: true,
    data: t.data,
    tipo: 'RECEBIMENTO',
    descricao: t.descricao || `Transferência de ${t.contaOrigem.nome}`,
    valor: Number(t.valor),
    valorBruto: Number(t.valor),
  }));

  const movimentos = [
    ...movimentosRecebimento,
    ...movimentosPagamento,
    ...movimentosTransferenciaSaida,
    ...movimentosTransferenciaEntrada,
  ].sort((a, b) => new Date(a.data) - new Date(b.data));

  let saldoCorrente = Number(conta.saldoInicial);
  const movimentosComSaldo = movimentos.map((m) => {
    saldoCorrente += m.valor;
    return { ...m, saldoAposMovimento: saldoCorrente };
  });

  const pendencias = {
    recebiveis: recebiveisPendentes.map((r) => ({
      id: r.id,
      manual: r.vendaId == null,
      data: r.dataPrevista,
      descricao: r.descricao || (r.venda ? `Venda #${r.venda.numero}` : 'Recebível'),
      valor: Number(r.valorLiquido),
    })),
    contasPagar: contasPagarPendentes.map((c) => ({
      id: c.id,
      manual: c.compraId == null,
      data: c.vencimento,
      descricao: c.descricao,
      valor: Number(c.valor) - Number(c.desconto) + Number(c.juros),
    })),
  };

  return {
    conta: { id: conta.id, nome: conta.nome, tipo: conta.tipo, saldo: conta.saldo },
    saldoInicial: Number(conta.saldoInicial),
    movimentos: movimentosComSaldo,
    pendencias,
  };
}

async function montarResumoContas() {
  const contas = await prisma.contaBancaria.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, saldo: true },
  });
  const saldoTotal = contas.reduce((sum, c) => sum + Number(c.saldo), 0);
  return { contas: contas.map((c) => ({ id: c.id, nome: c.nome, saldo: Number(c.saldo) })), saldoTotal };
}

router.get('/', asyncHandler(async (req, res) => {
  const { contaBancariaId, de, ate } = req.query;
  const resumoContas = await montarResumoContas();

  if (contaBancariaId) {
    const conta = await prisma.contaBancaria.findUniqueOrThrow({ where: { id: String(contaBancariaId) } });
    const extrato = await montarExtrato(conta, de, ate);
    return res.json({ ...extrato, resumoContas });
  }

  const contas = await prisma.contaBancaria.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });
  const extratos = await Promise.all(contas.map((conta) => montarExtrato(conta, de, ate)));
  res.json({ contas: extratos, resumoContas });
}));

export default router;
