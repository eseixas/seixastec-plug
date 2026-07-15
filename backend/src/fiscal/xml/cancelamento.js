// Monta o evento de cancelamento (tpEvento 110111) da NFC-e/NF-e.
import { create } from 'xmlbuilder2';

const CODIGO_UF = { RJ: '33' };
const TP_EVENTO_CANCELAMENTO = '110111';

function isoComOffset(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sinal = offsetMin >= 0 ? '+' : '-';
  const offH = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offM = pad(Math.abs(offsetMin) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sinal}${offH}:${offM}`
  );
}

/**
 * @param {{ chaveAcesso: string, cnpj: string, protocolo: string, justificativa: string, ambiente: string, uf: string, nSeqEvento?: number }} params
 */
export function montarXmlCancelamento({ chaveAcesso, cnpj, protocolo, justificativa, ambiente, uf, nSeqEvento = 1 }) {
  if (justificativa.trim().length < 15) {
    throw new Error('Justificativa do cancelamento precisa ter pelo menos 15 caracteres.');
  }
  const cOrgao = CODIGO_UF[uf];
  if (!cOrgao) throw new Error(`UF "${uf}" sem código IBGE mapeado.`);
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const seq = String(nSeqEvento).padStart(2, '0');
  const idEvento = `ID${TP_EVENTO_CANCELAMENTO}${chaveAcesso}${seq}`;
  const dhEvento = isoComOffset(new Date());

  const infEvento = {
    '@Id': idEvento,
    cOrgao,
    tpAmb,
    CNPJ: cnpj.replace(/\D/g, ''),
    chNFe: chaveAcesso,
    dhEvento,
    tpEvento: TP_EVENTO_CANCELAMENTO,
    nSeqEvento: String(nSeqEvento),
    verEvento: '1.00',
    detEvento: {
      '@versao': '1.00',
      descEvento: 'Cancelamento',
      nProt: protocolo,
      xJust: justificativa.trim(),
    },
  };

  const doc = create({ version: '1.0', encoding: 'UTF-8' }, {
    evento: {
      '@xmlns': 'http://www.portalfiscal.inf.br/nfe',
      '@versao': '1.00',
      infEvento,
    },
  });

  return { xml: doc.end({ prettyPrint: false }), idEvento };
}
