// Resolvem os parâmetros de emissão que passaram a ser cadastros próprios
// (múltiplas séries, naturezas de operação), sempre com FALLBACK para os
// valores antigos do singleton ConfiguracaoFiscal — compatibilidade total com
// lojas que ainda não cadastraram nada.
//
// `db` pode ser o PrismaClient ou uma transação (tx) — só usa métodos de leitura.

// Série padrão ativa de um modelo ("65"/"55"); cai para `fallback` (o valor do
// singleton) quando nenhuma SerieNotaFiscal foi cadastrada.
export async function resolverSeriePadrao(db, { modelo, fallback }) {
  const s = await db.serieNotaFiscal.findFirst({
    where: { modelo, padrao: true, ativo: true },
  });
  return s ? s.serie : fallback;
}

// Natureza de operação padrão (descrição usada no natOp do XML); cai para
// "Venda ao consumidor" quando não há cadastro.
export async function resolverNaturezaPadrao(db) {
  const n = await db.naturezaOperacao.findFirst({ where: { padrao: true, ativo: true } });
  return n ? n.descricao : 'Venda ao consumidor';
}
