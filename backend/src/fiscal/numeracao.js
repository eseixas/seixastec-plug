// Numeração de NotaFiscal por (lojaId, modelo, serie) — mesmo padrão de
// Venda.numero: contador local via max+1, sem autoincrement global (evita
// colisão entre lojas operando offline).
export async function proximoNumero(tx, { lojaId, modelo, serie }) {
  const agg = await tx.notaFiscal.aggregate({
    where: { lojaId, modelo, serie },
    _max: { numero: true },
  });
  return (agg._max.numero || 0) + 1;
}
