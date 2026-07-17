// Resolve os parâmetros de tributação de um item da nota aplicando a REGRA DE
// PRECEDÊNCIA única do sistema:
//
//   campo explícito do Produto > GrupoTributacao do Produto > ConfiguracaoFiscal
//
// Fonte única para a montagem do XML (nfce.js/nfe.js) — não acessar
// produto.csosn/configFiscal.cfop etc. diretamente na montagem, sempre passar
// por aqui, para que a precedência fique num lugar só.
//
// Usa `??` (não `||`): um campo vazio só "desce" para o próximo nível quando é
// null/undefined; string presente (mesmo "0") é respeitada.
export function resolverTributacaoProduto(produto, grupo, configFiscal) {
  const p = produto || {};
  const g = grupo || {};
  const c = configFiscal || {};
  return {
    origem: p.origemMercadoria ?? g.origemMercadoria ?? c.origemMercadoria,
    csosn: p.csosn ?? g.csosn ?? c.csosn,
    cfop: p.cfop ?? g.cfop ?? c.cfop,
    ncm: p.ncm ?? g.ncm ?? c.ncmPadrao,
    cest: p.cest ?? g.cest ?? c.cest ?? null,
  };
}
