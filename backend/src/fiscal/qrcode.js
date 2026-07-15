// URL do QR Code da NFC-e (grupo infNFeSupl) — precisa estar DENTRO do XML
// assinado antes de transmitir (não é só para exibição pós-autorização: a
// SEFAZ rejeita a nota sem ele, cStat 394).
//
// Versão 3 do QR Code (NT 2025.001, mar/2025): para emissão ONLINE (tpEmis=1,
// nosso caso — offline/contingência formal não é coberto nesta leva), a URL
// é só `?p=<chave>|3|<tpAmb>`, sem CSC/hash — confirmado contra a
// implementação de referência github.com/nfephp-org/sped-nfe (QRCode::get300).
export const URL_BASE_QRCODE = 'https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode';
// urlChave é a página de consulta MANUAL (digitar a chave), distinta da URL
// de leitura direta do QR Code acima — confundir as duas gera rejeição 878.
// Valor exato conforme registrado na SEFAZ (mesmo p/ homologação e produção),
// confirmado contra o arquivo de config storage/uri_consulta_nfce.json da
// lib de referência sped-nfe (github.com/nfephp-org/sped-nfe) — a validação
// da SVRS compara literalmente contra o que está registrado do lado deles,
// que pode divergir do texto anunciado no portal público da SEFAZ-RJ.
export const URL_CONSULTA_CHAVE = 'www.fazenda.rj.gov.br/nfce/consulta';

export function urlQrCode({ chaveAcesso, ambiente }) {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  return `${URL_BASE_QRCODE}?p=${chaveAcesso}|3|${tpAmb}`;
}
