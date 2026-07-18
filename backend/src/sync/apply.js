import { aplicarMovimento } from './estoque.js';
import { creditarRecebiveisSemConta } from '../lib/creditarContaPrincipal.js';

// Ingestão idempotente dos eventos enviados pelo edge (push). Cada handler é
// seguro para reenvio: cria por id só se ainda não existe, ou faz upsert.

const num = (x) => (x == null ? 0 : Number(x));

export async function aplicarEventoPush(tx, evento) {
  switch (evento.tipo) {
    case 'venda':
      return aplicarVenda(tx, evento.payload);
    case 'venda_cancelada':
      return aplicarVendaCancelada(tx, evento.payload);
    case 'movimento_estoque':
      return aplicarMovimento(tx, evento.payload);
    case 'caixa':
      return aplicarCaixa(tx, evento.payload);
    case 'movimento_caixa':
      return aplicarMovimentoCaixa(tx, evento.payload);
    case 'nota_fiscal':
      return aplicarNotaFiscal(tx, evento.payload);
    default:
      return { aplicado: false, motivo: `tipo desconhecido: ${evento.tipo}` };
  }
}

async function aplicarVenda(tx, v) {
  const existe = await tx.venda.findUnique({ where: { id: v.id } });
  if (existe) return { aplicado: false }; // já ingerida (movimentos já aplicados)

  await tx.venda.create({
    data: {
      id: v.id,
      numero: v.numero,
      clienteId: v.clienteId || null,
      usuarioId: v.usuarioId,
      vendedorId: v.vendedorId || null,
      caixaId: v.caixaId || null,
      lojaId: v.lojaId || null,
      pdvTerminalId: v.pdvTerminalId || null,
      status: v.status,
      subtotal: num(v.subtotal),
      desconto: num(v.desconto),
      acrescimo: num(v.acrescimo),
      total: num(v.total),
      observacao: v.observacao || null,
      createdAt: v.createdAt ? new Date(v.createdAt) : undefined,
      finalizadaEm: v.finalizadaEm ? new Date(v.finalizadaEm) : null,
      itens: {
        create: (v.itens || []).map((i) => ({
          id: i.id,
          variacaoId: i.variacaoId,
          quantidade: i.quantidade,
          precoUnit: num(i.precoUnit),
          desconto: num(i.desconto),
          total: num(i.total),
        })),
      },
    },
  });

  for (const p of v.pagamentos || []) {
    await tx.pagamento.create({
      data: {
        id: p.id,
        vendaId: v.id,
        forma: p.forma,
        adquirenteId: p.adquirenteId || null,
        valor: num(p.valor),
        parcelas: p.parcelas || 1,
        taxaPercentual: num(p.taxaPercentual),
        taxaValor: num(p.taxaValor),
        valorLiquido: num(p.valorLiquido),
        prazoRecebimentoDias: p.prazoRecebimentoDias || 0,
        createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
      },
    });
  }

  for (const r of v.recebiveis || []) {
    await tx.recebivel.create({
      data: {
        id: r.id,
        pagamentoId: r.pagamentoId,
        vendaId: v.id,
        adquirenteId: r.adquirenteId || null,
        parcelaNumero: r.parcelaNumero || 1,
        totalParcelas: r.totalParcelas || 1,
        valorBruto: num(r.valorBruto),
        taxaValor: num(r.taxaValor),
        valorLiquido: num(r.valorLiquido),
        dataPrevista: new Date(r.dataPrevista),
        status: r.status,
        recebidoEm: r.recebidoEm ? new Date(r.recebidoEm) : null,
        createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
      },
    });
  }

  // Movimentos de estoque da venda (aplicados ao EstoqueLocal da loja, idempotentes).
  for (const m of v.movimentacoes || []) {
    await aplicarMovimento(tx, m);
  }

  // Esta função roda sempre na central, então já pode creditar a conta principal.
  const recebiveisCriados = await tx.recebivel.findMany({ where: { vendaId: v.id } });
  await creditarRecebiveisSemConta(tx, recebiveisCriados);

  return { aplicado: true };
}

async function aplicarVendaCancelada(tx, p) {
  const v = await tx.venda.findUnique({ where: { id: p.id } });
  // Venda ainda não chegou (ex.: o evento 'venda' falhou neste lote): NÃO
  // confirmar — lançar faz o evento cair em `falhas` e ser reenviado depois
  // que a venda aplicar. Ack aqui perderia o cancelamento para sempre.
  if (!v) {
    throw new Error(`venda ${p.id} ainda não sincronizada; cancelamento será reenviado`);
  }
  if (v.status === 'CANCELADA') return { aplicado: false };
  await tx.recebivel.updateMany({
    where: { vendaId: p.id, status: 'PENDENTE' },
    data: { status: 'CANCELADO' },
  });
  await tx.venda.update({ where: { id: p.id }, data: { status: 'CANCELADA' } });
  return { aplicado: true };
}

async function aplicarCaixa(tx, c) {
  const data = {
    usuarioId: c.usuarioId,
    lojaId: c.lojaId || null,
    pdvTerminalId: c.pdvTerminalId || null,
    aberturaEm: c.aberturaEm ? new Date(c.aberturaEm) : undefined,
    fechamentoEm: c.fechamentoEm ? new Date(c.fechamentoEm) : null,
    valorAbertura: num(c.valorAbertura),
    valorFechamento: c.valorFechamento != null ? num(c.valorFechamento) : null,
    observacao: c.observacao || null,
    aberto: !!c.aberto,
  };
  await tx.caixa.upsert({ where: { id: c.id }, update: data, create: { id: c.id, ...data } });
  return { aplicado: true };
}

// Diferente das demais (append-only), NotaFiscal muda de status ao longo do
// tempo no edge (PENDENTE → AUTORIZADA/REJEITADA) — a central só espelha o
// estado mais recente, por isso é upsert (não "já existe, ignora").
async function aplicarNotaFiscal(tx, n) {
  const data = {
    modelo: n.modelo,
    serie: n.serie,
    numero: n.numero,
    lojaId: n.lojaId,
    vendaId: n.vendaId || null,
    ambiente: n.ambiente,
    status: n.status,
    chaveAcesso: n.chaveAcesso || null,
    protocolo: n.protocolo || null,
    xmlAssinado: n.xmlAssinado || null,
    xmlRetorno: n.xmlRetorno || null,
    motivoRejeicao: n.motivoRejeicao || null,
    qrCodeUrl: n.qrCodeUrl || null,
    dadosManual: n.dadosManual || null,
    tentativas: n.tentativas || 0,
    autorizadaEm: n.autorizadaEm ? new Date(n.autorizadaEm) : null,
    canceladaEm: n.canceladaEm ? new Date(n.canceladaEm) : null,
  };
  await tx.notaFiscal.upsert({ where: { id: n.id }, update: data, create: { id: n.id, ...data } });
  return { aplicado: true };
}

async function aplicarMovimentoCaixa(tx, mc) {
  const existe = await tx.movimentoCaixa.findUnique({ where: { id: mc.id } });
  if (existe) return { aplicado: false };
  await tx.movimentoCaixa.create({
    data: {
      id: mc.id,
      caixaId: mc.caixaId,
      tipo: mc.tipo,
      valor: num(mc.valor),
      motivo: mc.motivo || null,
      createdAt: mc.createdAt ? new Date(mc.createdAt) : undefined,
    },
  });
  return { aplicado: true };
}
