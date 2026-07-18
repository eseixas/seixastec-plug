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

  // ENTRADA/SAIDA aplicam DELTA com increment atômico: duas transações
  // concorrentes na mesma variação não se perdem (o "ler saldo e gravar
  // absoluto" antigo descartava o movimento concorrente). AJUSTE continua
  // absoluto por definição — é o único que grava saldo direto.
  const delta =
    mov.tipo === 'ENTRADA' ? mov.quantidade :
    mov.tipo === 'SAIDA' ? -mov.quantidade :
    mov.quantidade - saldoAtual; // AJUSTE = saldo absoluto

  await tx.estoqueLocal.upsert({
    where: { lojaId_variacaoId: { lojaId: mov.lojaId, variacaoId: mov.variacaoId } },
    update: mov.tipo === 'AJUSTE'
      ? { estoqueAtual: mov.quantidade }
      : { estoqueAtual: { increment: delta } },
    create: { lojaId: mov.lojaId, variacaoId: mov.variacaoId, estoqueAtual: saldoAtual + delta },
  });

  // Mantém Variacao.estoqueAtual como AGREGADO global (soma das lojas) aplicando
  // o mesmo delta. Na central vira o total de todas as lojas; no edge, o da loja.
  if (delta !== 0) {
    await tx.variacao.update({
      where: { id: mov.variacaoId },
      data: { estoqueAtual: { increment: delta } },
    });
  }
  const novo = saldoAtual + delta;

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
