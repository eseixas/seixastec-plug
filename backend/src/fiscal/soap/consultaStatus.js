// Consulta o status do serviço da SEFAZ (StatusServico) — não exige XML
// assinado nem chave de acesso, é o primeiro passo natural para validar que
// o certificado A1/mTLS está funcionando antes de tentar autorizar uma nota.
import { endpointFor, envelopeSoap12, postSoap } from './cliente.js';

const CODIGO_UF = { RJ: '33' };
const XMLNS_STATUS_SERVICO = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4';

function extrairTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

// @param {{ uf: string, ambiente: 'homologacao'|'producao' }} params
export async function consultarStatusServico({ uf, ambiente }) {
  const cUF = CODIGO_UF[uf];
  if (!cUF) throw new Error(`UF "${uf}" sem código IBGE mapeado.`);
  const tpAmb = ambiente === 'producao' ? '1' : '2';

  const consStatServ =
    `<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${tpAmb}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ>`;

  const url = endpointFor(uf, ambiente, 'StatusServico');
  const envelope = envelopeSoap12(XMLNS_STATUS_SERVICO, consStatServ);
  const respostaXml = await postSoap(url, envelope, { soapAction: `${XMLNS_STATUS_SERVICO}/nfeStatusServicoNF` });

  return {
    cStat: extrairTag(respostaXml, 'cStat'),
    xMotivo: extrairTag(respostaXml, 'xMotivo'),
    tempoMedio: extrairTag(respostaXml, 'cUF') ? extrairTag(respostaXml, 'tMed') : null,
    xmlBruto: respostaXml,
  };
}
