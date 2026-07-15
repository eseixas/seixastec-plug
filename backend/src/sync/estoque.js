import { enfileirar } from './outbox.js';

// Modelo mental: MovimentacaoEstoque é um LOG append-only replicado (chave = UUID).
// EstoqueLocal[loja, variação] é o "fold" desses movimentos, cada um aplicado
// EXATAMENTE UMA VEZ (dedup por id). Central e cada edge convergem para o mesmo
// saldo replicando os movimentos relevantes. Nunca sincronizamos o saldo direto.

export async function getSaldo(tx, lojaId, variacaoId) {
  const e = await tx.estoqueLocal.findUnique({
    where: { lojaId_variacaoId: { lojaId, variacaoId } },
  });
  return e ? e.estoqueAtual : 0;
}

// Aplica um movimento ao EstoqueLocal, idempotente por mov.id.
// mov: { id, variacaoId, lojaId, tipo, quantidade, custoUnit?, motivo?,
//        categoria?, transferenciaId?, fornecedorId?, vendaId?, usuarioId?,
//        createdAt? }
// opts.enqueue: grava OutboxEvent 'movimento_estoque' (uso local no edge,
//   somente para movimentos manuais — os de venda viajam dentro do evento 'venda').
export async function aplicarMovimento(tx, mov, opts = {}) {
  const jaExiste = await tx.movimentacaoEstoque.findUnique({ where: { id: mov.id } });
  if (jaExiste) return { aplicado: false };

  const atual = await tx.estoqueLocal.findUnique({
    where: { lojaId_variacaoId: { lojaId: mov.lojaId, variacaoId: mov.variacaoId } },
  });
  const saldoAtual = atual ? atual.estoqueAtual : 0;

  let novo;
  if (mov.tipo === 'ENTRADA') novo = saldoAtual + mov.quantidade;
  else if (mov.tipo === 'SAIDA') novo = saldoAtual - mov.quantidade;
  else novo = mov.quantidade; // AJUSTE = saldo absoluto

  await tx.estoqueLocal.upsert({
    where: { lojaId_variacaoId: { lojaId: mov.lojaId, variacaoId: mov.variacaoId } },
    update: { estoqueAtual: novo },
    create: { lojaId: mov.lojaId, variacaoId: mov.variacaoId, estoqueAtual: novo },
  });

  // Mantém Variacao.estoqueAtual como AGREGADO global (soma das lojas) aplicando
  // o mesmo delta. Na central vira o total de todas as lojas; no edge, o da loja.
  const delta = novo - saldoAtual;
  if (delta !== 0) {
    await tx.variacao.update({
      where: { id: mov.variacaoId },
      data: { estoqueAtual: { increment: delta } },
    });
  }

  await tx.movimentacaoEstoque.create({
    data: {
      id: mov.id,
      variacaoId: mov.variacaoId,
      lojaId: mov.lojaId,
      tipo: mov.tipo,
      quantidade: mov.quantidade,
      custoUnit: mov.custoUnit ?? null,
      motivo: mov.motivo ?? null,
      categoria: mov.categoria ?? null,
      transferenciaId: mov.transferenciaId ?? null,
      fornecedorId: mov.fornecedorId ?? null,
      vendaId: mov.vendaId ?? null,
      usuarioId: mov.usuarioId ?? null,
      ...(mov.createdAt ? { createdAt: new Date(mov.createdAt) } : {}),
    },
  });

  if (opts.enqueue) {
    await enfileirar(tx, 'movimento_estoque', mov.id, {
      id: mov.id,
      variacaoId: mov.variacaoId,
      lojaId: mov.lojaId,
      tipo: mov.tipo,
      quantidade: mov.quantidade,
      custoUnit: mov.custoUnit ?? null,
      motivo: mov.motivo ?? null,
      categoria: mov.categoria ?? null,
      transferenciaId: mov.transferenciaId ?? null,
      fornecedorId: mov.fornecedorId ?? null,
      vendaId: mov.vendaId ?? null,
      usuarioId: mov.usuarioId ?? null,
    });
  }
  return { aplicado: true, saldo: novo };
}
