// Aritmética de dinheiro em CENTAVOS INTEIROS — mesmo modelo do pdvMath.js do
// PDV, para que front e back cheguem exatamente ao mesmo resultado. Os valores
// entram/saem em reais (Number) porque o Prisma/JSON trafegam assim; toda a
// soma/rateio interna é feita em inteiros.

export const toCents = (v) => Math.round(Number(v || 0) * 100);
export const fromCents = (c) => c / 100;

// Soma em reais feita em centavos (evita 0.1 + 0.2 = 0.30000000000000004).
export const somarReais = (valores) =>
  fromCents(valores.reduce((acc, v) => acc + toCents(v), 0));

// Total de uma linha de venda: preco * quantidade - desconto (em reais).
export const totalItem = (precoUnit, quantidade, desconto) =>
  fromCents(toCents(precoUnit) * quantidade - toCents(desconto || 0));

// Taxa da adquirente sobre um pagamento: percentual sobre o bruto + taxa fixa.
export function calcularTaxa(valor, taxaPercentual, taxaFixa) {
  const bruto = toCents(valor);
  const taxa = Math.round((bruto * Number(taxaPercentual || 0)) / 100) + toCents(taxaFixa || 0);
  return { taxaValor: fromCents(taxa), valorLiquido: fromCents(bruto - taxa) };
}

// Rateio de um pagamento em N parcelas: divide bruto e taxa igualmente e joga
// o resíduo do arredondamento na última parcela, garantindo que a soma das
// parcelas feche EXATAMENTE com o bruto/taxa do pagamento.
export function ratearParcelas(valor, taxaValor, parcelas) {
  const brutoTotal = toCents(valor);
  const taxaTotal = toCents(taxaValor);
  const brutoParcela = Math.floor(brutoTotal / parcelas);
  const taxaParcela = Math.floor(taxaTotal / parcelas);
  const out = [];
  for (let i = 1; i <= parcelas; i++) {
    const ultimo = i === parcelas;
    const bruto = ultimo ? brutoTotal - brutoParcela * (parcelas - 1) : brutoParcela;
    const taxa = ultimo ? taxaTotal - taxaParcela * (parcelas - 1) : taxaParcela;
    out.push({
      parcelaNumero: i,
      valorBruto: fromCents(bruto),
      taxaValor: fromCents(taxa),
      valorLiquido: fromCents(bruto - taxa),
    });
  }
  return out;
}
