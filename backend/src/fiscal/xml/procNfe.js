// Monta o XML padrão "nfeProc" (NFe assinada + protocolo de autorização) usado
// por contadores/softwares fiscais para download/exportação das notas.

// Extrai o bloco <protNFe...>...</protNFe> da resposta SOAP crua da autorização.
function extrairProtNFe(xmlRetorno) {
  const m = xmlRetorno.match(/<protNFe[^>]*>[\s\S]*?<\/protNFe>/);
  return m ? m[0] : null;
}

// Monta o XML final para download/exportação: se houver protocolo de
// autorização, entrega o padrão nfeProc (NFe + protNFe); senão, entrega só
// a NFe assinada (nota ainda sem protocolo, ex. rejeitada logo após reenvio).
export function montarXmlProc(nota) {
  if (!nota.xmlAssinado) return null;
  const nfeSemDeclaracao = nota.xmlAssinado.replace(/^<\?xml[^>]*\?>\s*/, '');
  const protNFe = nota.xmlRetorno ? extrairProtNFe(nota.xmlRetorno) : null;
  if (!protNFe) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${nfeSemDeclaracao}`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${nfeSemDeclaracao}${protNFe}</nfeProc>`;
}

// Nome de arquivo sugerido para download/exportação.
export function nomeArquivoXml(nota) {
  const tipo = nota.modelo === '65' ? 'NFCe' : 'NFe';
  return `${tipo}_${String(nota.serie).padStart(3, '0')}-${String(nota.numero).padStart(9, '0')}${nota.chaveAcesso ? `_${nota.chaveAcesso}` : ''}.xml`;
}
