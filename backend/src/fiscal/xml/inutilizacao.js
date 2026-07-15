// Monta o pedido de inutilização de numeração (quando um número foi pulado
// sem gerar nota, ex.: erro de sistema) — cobre uma faixa [nInicial,nFinal]
// dentro de uma série/modelo. Diferente do cancelamento: não referencia uma
// NotaFiscal existente, é uma faixa "nunca usada".
import { create } from 'xmlbuilder2';

const CODIGO_UF = { RJ: '33' };

/**
 * @param {{ cnpj, modelo, serie, numeroInicial, numeroFinal, justificativa, ambiente, uf }} params
 */
export function montarXmlInutilizacao({ cnpj, modelo, serie, numeroInicial, numeroFinal, justificativa, ambiente, uf }) {
  if (justificativa.trim().length < 15) {
    throw new Error('Justificativa da inutilização precisa ter pelo menos 15 caracteres.');
  }
  const cUF = CODIGO_UF[uf];
  if (!cUF) throw new Error(`UF "${uf}" sem código IBGE mapeado.`);
  const ano = String(new Date().getFullYear()).slice(2);
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  const serieStr = String(serie).padStart(3, '0');
  const nIniStr = String(numeroInicial).padStart(9, '0');
  const nFinStr = String(numeroFinal).padStart(9, '0');
  const tpAmb = ambiente === 'producao' ? '1' : '2';

  const id = `ID${cUF}${ano}${cnpjLimpo}${modelo}${serieStr}${nIniStr}${nFinStr}`;

  const infInut = {
    '@Id': id,
    tpAmb,
    xServ: 'INUTILIZAR',
    cUF,
    ano,
    CNPJ: cnpjLimpo,
    mod: modelo,
    serie: String(serie),
    nNFIni: String(numeroInicial),
    nNFFin: String(numeroFinal),
    xJust: justificativa.trim(),
  };

  const doc = create({ version: '1.0', encoding: 'UTF-8' }, {
    inutNFe: {
      '@xmlns': 'http://www.portalfiscal.inf.br/nfe',
      '@versao': '4.00',
      infInut,
    },
  });

  return { xml: doc.end({ prettyPrint: false }), id };
}
