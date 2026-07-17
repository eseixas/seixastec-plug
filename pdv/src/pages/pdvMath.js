// Toda a matemática do PDV em centavos inteiros, para a soma dos pagamentos
// casar exatamente com o total (o backend rejeita diferença > 0,01).
export const toCents = (v) => Math.round(Number(v || 0) * 100)
export const fromCents = (c) => c / 100

export function calcSubtotal(itens) {
  return itens.reduce((acc, i) => acc + toCents(i.precoUnit) * i.quantidade - toCents(i.desconto || 0), 0)
}

export function calcTotal(itens, desconto, acrescimo) {
  return calcSubtotal(itens) - toCents(desconto || 0) + toCents(acrescimo || 0)
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
