// Toda a matemática do PDV em centavos inteiros, para a soma dos pagamentos
// casar exatamente com o total (o backend rejeita diferença > 0,01).
export const toCents = (v) => Math.round(Number(v || 0) * 100)
export const fromCents = (c) => c / 100

// Desconto efetivo (em centavos) de um item da venda, aceitando o valor cru
// em R$ (descontoModo 'R$') ou em percentual sobre o total bruto da linha
// (descontoModo '%').
export function descontoItemCents(item) {
  const brutoLinha = toCents(item.precoUnit) * item.quantidade
  if (item.descontoModo === '%') {
    return Math.round((brutoLinha * (Number(item.desconto) || 0)) / 100)
  }
  return toCents(item.desconto || 0)
}

export function somaDescontosItens(itens) {
  return itens.reduce((acc, i) => acc + descontoItemCents(i), 0)
}

export function calcSubtotal(itens) {
  return itens.reduce((acc, i) => acc + toCents(i.precoUnit) * i.quantidade - descontoItemCents(i), 0)
}

// Desconto efetivo (em centavos) da venda, a partir do valor digitado e do
// modo escolhido ('R$' ou '%'). O percentual incide sobre o subtotal já
// líquido dos descontos de item (subtotalCents = calcSubtotal(itens)).
export function descontoVendaCents(subtotalCents, valor, modo) {
  if (modo === '%') {
    return Math.round((subtotalCents * (Number(valor) || 0)) / 100)
  }
  return toCents(valor || 0)
}

export function calcTotal(itens, desconto) {
  return calcSubtotal(itens) - toCents(desconto || 0)
}

export function somaPagamentos(pagamentos) {
  return pagamentos.reduce((acc, p) => acc + toCents(p.valor), 0)
}

// Taxa/líquido estimados de um pagamento, a partir das taxas do adquirente.
export function estimarTaxa(pagamento, adquirentes) {
  if (pagamento.forma === 'DINHEIRO' || !pagamento.adquirenteId) {
    return { taxaValor: 0, liquido: toCents(pagamento.valor) }
  }
  const adq = adquirentes.find((a) => a.id === pagamento.adquirenteId)
  const parcelas = pagamento.forma === 'CREDITO' ? pagamento.parcelas || 1 : 1
  const taxa = adq?.taxas?.find((t) => t.forma === pagamento.forma && t.parcelas === parcelas)
  if (!taxa) return { taxaValor: 0, liquido: toCents(pagamento.valor) }
  const bruto = toCents(pagamento.valor)
  const taxaValor = Math.round((bruto * Number(taxa.taxaPercentual)) / 100 + toCents(taxa.taxaFixa))
  return { taxaValor, liquido: bruto - taxaValor, prazo: taxa.prazoRecebimentoDias }
}
