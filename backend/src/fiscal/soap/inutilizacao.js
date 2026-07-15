// Envia o pedido de inutilização de numeração para a SEFAZ.
import { endpointFor, envelopeSoap12, postSoap } from './cliente.js';
import { montarXmlInutilizacao } from '../xml/inutilizacao.js';
import { assinarElemento } from '../xml/assinatura.js';

const XMLNS_INUTILIZACAO4 = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4';

function extrairTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

export async function inutilizarNumeracao(dados) {
  const { xml, id } = montarXmlInutilizacao(dados);
  const xmlAssinado = assinarElemento(xml, 'infInut', id);

  const url = endpointFor(dados.uf, dados.ambiente, 'Inutilizacao', dados.modelo);
  const envelope = envelopeSoap12(XMLNS_INUTILIZACAO4, xmlAssinado.replace(/^<\?xml[^>]*\?>/, ''));
  const xmlRetorno = await postSoap(url, envelope, { soapAction: `${XMLNS_INUTILIZACAO4}/nfeInutilizacaoNF` });

  const cStat = extrairTag(xmlRetorno, 'cStat');
  const xMotivo = extrairTag(xmlRetorno, 'xMotivo');
  const protocolo = extrairTag(xmlRetorno, 'nProt');

  // 102 = inutilização homologada.
  return { cStat, xMotivo, protocolo, xmlRetorno, inutilizada: cStat === '102' };
}
