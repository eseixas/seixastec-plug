// Utilitários de dinheiro em centavos (inteiros) para evitar erros de ponto flutuante.

// Converte um valor em reais (número ou string) para centavos inteiros.
export function toCents(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

// Converte centavos inteiros de volta para reais (número) para exibição via formatCurrency.
export function toReais(cents) {
  return (Number(cents) || 0) / 100
}

// Total de uma linha do carrinho, em centavos: quantidade * precoUnit - desconto (nunca negativo).
export function lineTotalCents(item) {
  const qtd = Math.max(1, Math.trunc(Number(item.quantidade) || 0))
  const precoCents = toCents(item.precoUnit)
  const descontoCents = toCents(item.desconto)
  const total = qtd * precoCents - descontoCents
  return Math.max(0, total)
}

// Subtotal do carrinho (soma das linhas), em centavos.
export function subtotalCents(itens) {
  return (itens || []).reduce((acc, item) => acc + lineTotalCents(item), 0)
}

// Total da venda em centavos: subtotal - desconto geral + acréscimo geral (nunca negativo).
export function totalCents(itens, descontoGeral, acrescimoGeral) {
  const total = subtotalCents(itens) - toCents(descontoGeral) + toCents(acrescimoGeral)
  return Math.max(0, total)
}

// Soma dos pagamentos, em centavos.
export function pagamentosCents(pagamentos) {
  return (pagamentos || []).reduce((acc, p) => acc + toCents(p.valor), 0)
}
