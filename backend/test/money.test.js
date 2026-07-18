import test from 'node:test';
import assert from 'node:assert/strict';
import { toCents, fromCents, somarReais, totalItem, calcularTaxa, ratearParcelas } from '../src/lib/money.js';

test('toCents/fromCents evitam artefatos de ponto flutuante', () => {
  assert.equal(toCents(0.1) + toCents(0.2), 30);
  assert.equal(toCents(19.9), 1990); // 19.9 * 100 = 1989.9999... em float
  assert.equal(fromCents(1990), 19.9);
  assert.equal(toCents('49.90'), 4990);
  assert.equal(toCents(null), 0);
});

test('somarReais soma em centavos', () => {
  assert.equal(somarReais([0.1, 0.2, 0.3]), 0.6);
  assert.equal(somarReais([19.9, 19.9, 19.9]), 59.7);
});

test('totalItem: preco * quantidade - desconto', () => {
  assert.equal(totalItem(49.9, 3, 0), 149.7);
  assert.equal(totalItem(49.9, 3, 10.5), 139.2);
  assert.equal(totalItem(0.1, 3, 0), 0.3);
});

test('calcularTaxa: percentual + fixa, líquido fecha com o bruto', () => {
  const { taxaValor, valorLiquido } = calcularTaxa(100, 3.5, 0.5);
  assert.equal(taxaValor, 4);
  assert.equal(valorLiquido, 96);
  assert.equal(toCents(taxaValor) + toCents(valorLiquido), toCents(100));
});

test('calcularTaxa sem taxa', () => {
  const { taxaValor, valorLiquido } = calcularTaxa(59.7, 0, 0);
  assert.equal(taxaValor, 0);
  assert.equal(valorLiquido, 59.7);
});

test('ratearParcelas: soma das parcelas fecha exatamente com bruto e taxa', () => {
  for (const [valor, taxa, n] of [
    [100, 4.13, 3],
    [59.7, 0, 7],
    [0.05, 0.01, 3],
    [199.9, 7.77, 12],
    [10, 0.1, 1],
  ]) {
    const parcelas = ratearParcelas(valor, taxa, n);
    assert.equal(parcelas.length, n);
    const somaBruto = parcelas.reduce((a, p) => a + toCents(p.valorBruto), 0);
    const somaTaxa = parcelas.reduce((a, p) => a + toCents(p.taxaValor), 0);
    const somaLiquido = parcelas.reduce((a, p) => a + toCents(p.valorLiquido), 0);
    assert.equal(somaBruto, toCents(valor), `bruto ${valor}/${n}`);
    assert.equal(somaTaxa, toCents(taxa), `taxa ${taxa}/${n}`);
    assert.equal(somaLiquido, toCents(valor) - toCents(taxa), `liquido ${valor}/${n}`);
    // Cada parcela individualmente consistente.
    for (const p of parcelas) {
      assert.equal(toCents(p.valorLiquido), toCents(p.valorBruto) - toCents(p.taxaValor));
    }
  }
});

test('ratearParcelas: parcelas numeradas e resíduo na última', () => {
  const parcelas = ratearParcelas(100, 0, 3);
  assert.deepEqual(parcelas.map((p) => p.parcelaNumero), [1, 2, 3]);
  assert.deepEqual(parcelas.map((p) => p.valorBruto), [33.33, 33.33, 33.34]);
});
