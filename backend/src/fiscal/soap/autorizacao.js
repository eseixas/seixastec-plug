// Envio de lote de autorização da NFC-e (emissão síncrona — indSinc=1, padrão
// para NFC-e: a SEFAZ responde autorização/rejeição na mesma chamada, sem
// precisar de consulta de recibo separada como na NF-e assíncrona).
import { endpointFor, envelopeSoap12, postSoap } from './cliente.js';

const XMLNS_AUTORIZACAO4 = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';

// Extração simples por regex — a resposta desse serviço é razoavelmente
// plana; se algum campo aparecer aninhado/repetido de forma inesperada em
// homologação, trocar por um parser XML de verdade (ex. fast-xml-parser).
function extrairTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

// Isola o bloco <infProt>...</infProt> (resultado da NOTA em si, dentro do
// lote) — o cStat/xMotivo de fora (<retEnviNFe>) é só o status do LOTE
// (ex. "104 Lote processado", que não é nem autorização nem rejeição da
// nota). Emissão síncrona (indSinc=1) sempre traz infProt na resposta.
function extrairInfProt(xml) {
  const m = xml.match(/<infProt[^>]*>([\s\S]*?)<\/infProt>/);
  return m ? m[1] : null;
}

/**
 * @param {string} xmlAssinado - XML completo <NFe>...</NFe> já assinado.
 * @param {{ uf: string, ambiente: 'homologacao'|'producao', modelo?: '65'|'55' }} params
 * @returns {{ cStat: string, xMotivo: string, protocolo: string|null, dhRecbto: string|null, xmlRetorno: string, autorizada: boolean }}
 */
export async function enviarAutorizacaoNfce(xmlAssinado, { uf, ambiente, modelo = '65' }) {
  // Remove a declaração <?xml ...?> antes de embutir no envelope SOAP (o
  // enviNFe já carrega sua própria estrutura, não deve ter XML aninhado com
  // outra declaração).
  const nfeSemDeclaracao = xmlAssinado.replace(/^<\?xml[^>]*\?>/, '');

  const enviNFe =
    `<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<idLote>${Date.now()}</idLote>` +
    `<indSinc>1</indSinc>` +
    nfeSemDeclaracao +
    `</enviNFe>`;

  const url = endpointFor(uf, ambiente, 'Autorizacao', modelo);
  const envelope = envelopeSoap12(XMLNS_AUTORIZACAO4, enviNFe);
  const xmlRetorno = await postSoap(url, envelope, { soapAction: `${XMLNS_AUTORIZACAO4}/nfeAutorizacaoLote` });

  // O resultado de verdade da NOTA (autorização/rejeição) vem dentro de
  // infProt; o cStat de fora é só o status do lote como um todo. Se infProt
  // não vier (não deveria acontecer com indSinc=1, mas por segurança), cai
  // para o cStat do lote — nesse caso não é uma autorização válida mesmo
  // assim, então "autorizada" só fica true com cStat === '100' de infProt.
  const infProt = extrairInfProt(xmlRetorno);
  const escopo = infProt || xmlRetorno;
  const cStat = extrairTag(escopo, 'cStat');
  const xMotivo = extrairTag(escopo, 'xMotivo');
  const protocolo = extrairTag(escopo, 'nProt');
  const dhRecbto = extrairTag(escopo, 'dhRecbto');

  return {
    cStat,
    xMotivo,
    protocolo,
    dhRecbto,
    xmlRetorno,
    autorizada: cStat === '100',
  };
}
