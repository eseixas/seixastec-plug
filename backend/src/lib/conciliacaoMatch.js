// Matching de um lançamento de extrato bancário contra Recebivel/ContaPagar.
//
// Regras:
//  - valor > 0 (entrada): procura Recebivel RECEBIDO, não conciliado, mesma
//    conta bancária, recebidoEm dentro de ±3 dias da data do lançamento, e
//    valorLiquido == valor (tolerância 0.01).
//  - valor < 0 (saída): procura ContaPagar pago, não conciliado, mesma conta,
//    dataPagamento dentro de ±3 dias, valor efetivo pago == abs(valor)
//    (tolerância 0.01). Valor efetivo = valorPago se houver, senão
//    valor - desconto + juros.
//
// Retorna { match: 'RECEBIVEL'|'CONTA_PAGAR'|null, id, candidatos }.
//  - exatamente 1 candidato => match preenchido.
//  - 0 ou 2+ candidatos => match null (revisão manual), candidatos retornados.

const TOLERANCIA = 0.01;
const JANELA_DIAS = 3;

// Valor efetivo que saiu da conta ao pagar uma ContaPagar.
export function valorEfetivoContaPagar(cp) {
  if (cp.valorPago !== null && cp.valorPago !== undefined) return Number(cp.valorPago);
  return Number(cp.valor) - Number(cp.desconto || 0) + Number(cp.juros || 0);
}

function janela(data) {
  const de = new Date(data);
  de.setDate(de.getDate() - JANELA_DIAS);
  de.setHours(0, 0, 0, 0);
  const ate = new Date(data);
  ate.setDate(ate.getDate() + JANELA_DIAS);
  ate.setHours(23, 59, 59, 999);
  return { de, ate };
}

// lancamento: { data: Date, valor: Number }
export async function buscarCandidatos(lancamento, contaBancariaId, prisma) {
  const valor = Number(lancamento.valor);
  const { de, ate } = janela(lancamento.data);

  if (valor > 0) {
    const recebiveis = await prisma.recebivel.findMany({
      where: {
        status: 'RECEBIDO',
        conciliado: false,
        contaBancariaId,
        recebidoEm: { gte: de, lte: ate },
      },
    });
    const candidatos = recebiveis.filter(
      (r) => Math.abs(Number(r.valorLiquido) - valor) <= TOLERANCIA
    );
    if (candidatos.length === 1) {
      return { match: 'RECEBIVEL', id: candidatos[0].id, candidatos };
    }
    return { match: null, id: null, candidatos };
  }

  if (valor < 0) {
    const alvo = Math.abs(valor);
    const contas = await prisma.contaPagar.findMany({
      where: {
        pago: true,
        conciliado: false,
        contaBancariaId,
        dataPagamento: { gte: de, lte: ate },
      },
    });
    const candidatos = contas.filter(
      (c) => Math.abs(valorEfetivoContaPagar(c) - alvo) <= TOLERANCIA
    );
    if (candidatos.length === 1) {
      return { match: 'CONTA_PAGAR', id: candidatos[0].id, candidatos };
    }
    return { match: null, id: null, candidatos };
  }

  // valor == 0: sem contrapartida possível.
  return { match: null, id: null, candidatos: [] };
}

export default buscarCandidatos;
