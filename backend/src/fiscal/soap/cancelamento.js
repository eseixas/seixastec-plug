// Envia o evento de cancelamento (já assinado) para a SEFAZ via RecepcaoEvento4.
import { endpointFor, envelopeSoap12, postSoap } from './cliente.js';
import { montarXmlCancelamento } from '../xml/cancelamento.js';
import { assinarElemento } from '../xml/assinatura.js';

const XMLNS_RECEPCAO_EVENTO4 = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';

function extrairTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

function extrairInfEvento(xml) {
  const m = xml.match(/<infEvento[^>]*>([\s\S]*?)<\/infEvento>/);
  return m ? m[1] : null;
}

/**
 * @param {{ chaveAcesso, cnpj, protocolo, justificativa, ambiente, uf }} dadosCancelamento
 */
export async function cancelarNfce(dadosCancelamento) {
  const { xml, idEvento } = montarXmlCancelamento(dadosCancelamento);
  const xmlAssinado = assinarElemento(xml, 'infEvento', idEvento);

  const eventoSemDeclaracao = xmlAssinado.replace(/^<\?xml[^>]*\?>/, '');
  const envEvento =
    `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<idLote>${Date.now()}</idLote>` +
    eventoSemDeclaracao +
    `</envEvento>`;

  // Modelo vem da própria chave de acesso (posições 20-21: 44=NF-e não, na
  // verdade são os dígitos 21-22 — usamos slice(20,22) do padrão já usado em
  // chaveAcesso.js: cUF(2)+AAMM(4)+CNPJ(14)+mod(2)+...).
  const modelo = dadosCancelamento.chaveAcesso.slice(20, 22);
  const url = endpointFor(dadosCancelamento.uf, dadosCancelamento.ambiente, 'RecepcaoEvento', modelo);
  const envelope = envelopeSoap12(XMLNS_RECEPCAO_EVENTO4, envEvento);
  const xmlRetorno = await postSoap(url, envelope, { soapAction: `${XMLNS_RECEPCAO_EVENTO4}/nfeRecepcaoEvento` });

  const escopo = extrairInfEvento(xmlRetorno) || xmlRetorno;
  const cStat = extrairTag(escopo, 'cStat');
  const xMotivo = extrairTag(escopo, 'xMotivo');
  const nProt = extrairTag(escopo, 'nProt');

  // 135 = evento registrado e vinculado a NF-e; 136 = registrado, não vinculado.
  const cancelado = cStat === '135' || cStat === '136';

  return { cStat, xMotivo, protocoloCancelamento: nProt, xmlRetorno, cancelado };
}
