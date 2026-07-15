// Monta o XML da NFC-e (modelo 65) a partir de uma Venda já finalizada.
//
// AVISO: segue a estrutura geral do layout NFe/NFC-e (grupos infNFe/ide/emit/
// det/total/pag), mas os detalhes finos (regras condicionais de cada campo,
// versão exata do schema/NT vigente) PRECISAM ser conferidos e ajustados
// contra rejeições reais da SEFAZ-RJ em homologação — isso é esperado e faz
// parte do processo (ver plano, etapa 3-5).
import { create } from 'xmlbuilder2';
import { montarChaveAcesso } from '../chaveAcesso.js';
import { urlQrCode } from '../qrcode.js';

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const fmt2 = (n) => round2(n).toFixed(2);

// Mapeia FormaPagamento do sistema para o código tPag da NFC-e.
const T_PAG = {
  DINHEIRO: '01',
  DEBITO: '04',
  CREDITO: '03',
  PIX: '17',
  DEPOSITO: '17', // transferência bancária — mais próximo do código disponível
  LINK: '99',
};

// GTIN (EAN-8/12/13/14) válido exige dígito verificador correto — código de
// barras interno/inventado (comum em produtos sem GTIN real) é rejeitado
// pela SEFAZ (cStat 611) se enviado como se fosse um GTIN. Nesse caso, o
// campo deve ser "SEM GTIN" em vez do código.
function gtinValido(codigo) {
  if (!codigo || ![8, 12, 13, 14].includes(codigo.length) || !/^\d+$/.test(codigo)) return false;
  const digitos = codigo.split('').map(Number);
  const dv = digitos.pop();
  let soma = 0;
  digitos.reverse().forEach((d, i) => {
    soma += d * (i % 2 === 0 ? 3 : 1);
  });
  const dvCalculado = (10 - (soma % 10)) % 10;
  return dvCalculado === dv;
}

function ean(codigoBarras) {
  return gtinValido(codigoBarras) ? codigoBarras : 'SEM GTIN';
}

function isoComOffset(date) {
  // SEFAZ exige data/hora com timezone explícito (ex.: -03:00), não "Z".
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
 * @param {object} params
 * @param {import('@prisma/client').Venda & {itens:any[], pagamentos:any[], cliente:any}} params.venda
 * @param {import('@prisma/client').Loja} params.loja
 * @param {import('@prisma/client').ConfiguracaoFiscal} params.configFiscal
 * @param {number} params.numero - número da NotaFiscal (por loja/modelo/série)
 * @param {number} params.serie
 * @param {string} params.ambiente - "homologacao" | "producao"
 * @returns {{ xml: string, chaveAcesso: string }}
 */
export function montarXmlNfce({ venda, loja, configFiscal, numero, serie, ambiente }) {
  if (!loja.cnpj) throw new Error('Loja sem CNPJ cadastrado — obrigatório para emissão fiscal.');
  if (!loja.uf) throw new Error('Loja sem UF cadastrada — obrigatório para emissão fiscal.');
  if (!loja.crt) throw new Error('Loja sem CRT (regime tributário) cadastrado.');
  if (!loja.codigoMunicipioIbge) throw new Error('Loja sem código IBGE do município cadastrado — obrigatório para emissão fiscal.');

  const dataEmissao = venda.finalizadaEm ? new Date(venda.finalizadaEm) : new Date();
  const tpAmb = ambiente === 'producao' ? '1' : '2';

  const chaveAcesso = montarChaveAcesso({
    uf: loja.uf,
    dataEmissao,
    cnpj: loja.cnpj,
    modelo: '65',
    serie,
    numero,
  });

  const cnpjLimpo = loja.cnpj.replace(/\D/g, '');
  const idInfNFe = `NFe${chaveAcesso}`;

  const det = venda.itens.map((item, idx) => {
    const produto = item.variacao.produto;
    const vProd = round2(Number(item.precoUnit) * item.quantidade - Number(item.desconto || 0));
    const origem = produto.origemMercadoria ?? configFiscal.origemMercadoria;
    const csosn = produto.csosn ?? configFiscal.csosn;
    const cfop = produto.cfop ?? configFiscal.cfop;
    const ncm = produto.ncm ?? configFiscal.ncmPadrao;
    if (!ncm) throw new Error(`Produto "${produto.nome}" sem NCM definido (e sem NCM padrão em Configuração Fiscal).`);

    return {
      '@nItem': String(idx + 1),
      prod: {
        cProd: item.variacao.sku,
        cEAN: ean(item.variacao.codigoBarras),
        // Regra da SEFAZ para ambiente de homologação: o item 1 precisa ter
        // exatamente este texto, senão a nota é rejeitada (cStat 373).
        xProd:
          idx === 0 && ambiente === 'homologacao'
            ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
            : produto.nome,
        NCM: ncm,
        CFOP: cfop,
        uCom: 'UN',
        qCom: String(item.quantidade),
        vUnCom: fmt2(item.precoUnit),
        vProd: fmt2(vProd),
        cEANTrib: ean(item.variacao.codigoBarras),
        uTrib: 'UN',
        qTrib: String(item.quantidade),
        vUnTrib: fmt2(item.precoUnit),
        indTot: '1',
      },
      imposto: {
        ICMS: {
          // Simples Nacional (CRT=1/2) usa ICMSSN102; Regime Normal (CRT=3)
          // exigiria CST + base de cálculo — não coberto nesta primeira leva
          // (loja é Simples Nacional na maioria dos casos de varejo pequeno;
          // ajustar aqui se a loja for Regime Normal).
          ICMSSN102: {
            orig: origem,
            CSOSN: csosn,
          },
        },
        PIS: { PISNT: { CST: '07' } },
        COFINS: { COFINSNT: { CST: '07' } },
      },
    };
  });

  const vProdTotal = round2(venda.itens.reduce((acc, i) => acc + Number(i.precoUnit) * i.quantidade - Number(i.desconto || 0), 0));

  // Desde a NT 2025.001 (set/2025), o grupo <card> é obrigatório para
  // cartão de débito/crédito E PIX (tPag 03/04/17), mesmo sem integração
  // com a maquininha — tpIntegra=2 (não integrado) dispensa CNPJ/bandeira/
  // autorização, que só são obrigatórios com tpIntegra=1.
  const EXIGE_CARD = new Set(['03', '04', '17']);
  const detPag = venda.pagamentos.map((p) => {
    const tPag = T_PAG[p.forma] || '99';
    return {
      tPag,
      vPag: fmt2(p.valor),
      ...(EXIGE_CARD.has(tPag) ? { card: { tpIntegra: '2' } } : {}),
    };
  });

  const infNFe = {
    '@Id': idInfNFe,
    '@versao': '4.00',
    ide: {
      cUF: chaveAcesso.slice(0, 2),
      cNF: chaveAcesso.slice(35, 43),
      natOp: 'Venda',
      mod: '65',
      serie: String(serie),
      nNF: String(numero),
      dhEmi: isoComOffset(dataEmissao),
      tpNF: '1',
      idDest: '1',
      cMunFG: loja.codigoMunicipioIbge,
      tpImp: '4', // DANFCE
      tpEmis: '1',
      cDV: chaveAcesso.slice(-1),
      tpAmb,
      finNFe: '1',
      indFinal: '1',
      indPres: '1',
      procEmi: '0',
      verProc: '1.0.0',
    },
    emit: {
      CNPJ: cnpjLimpo,
      xNome: loja.nome,
      enderEmit: {
        xLgr: loja.logradouro || '',
        nro: loja.numero || 'S/N',
        xBairro: loja.bairro || '',
        cMun: loja.codigoMunicipioIbge,
        xMun: loja.cidade || '',
        UF: loja.uf,
        CEP: (loja.cep || '').replace(/\D/g, ''),
        cPais: '1058',
        xPais: 'BRASIL',
      },
      IE: (loja.ie || '').replace(/\D/g, ''),
      CRT: String(loja.crt),
    },
    det,
    total: {
      ICMSTot: {
        vBC: '0.00',
        vICMS: '0.00',
        vICMSDeson: '0.00',
        vFCP: '0.00',
        vBCST: '0.00',
        vST: '0.00',
        vFCPST: '0.00',
        vFCPSTRet: '0.00',
        vProd: fmt2(vProdTotal),
        vFrete: '0.00',
        vSeg: '0.00',
        vDesc: fmt2(venda.desconto || 0),
        vII: '0.00',
        vIPI: '0.00',
        vIPIDevol: '0.00',
        vPIS: '0.00',
        vCOFINS: '0.00',
        vOutro: fmt2(venda.acrescimo || 0),
        vNF: fmt2(venda.total),
      },
    },
    transp: { modFrete: '9' },
    pag: { detPag },
  };

  // infNFeSupl (QR Code) NÃO entra aqui — a ordem correta é
  // infNFe → infNFeSupl → Signature (confirmado contra a lib de referência
  // sped-nfe), e a assinatura só existe depois de assinar. assinatura.js
  // insere o infNFeSupl na posição certa após assinar.
  const qrCodeUrl = urlQrCode({ chaveAcesso, ambiente });

  const doc = create({ version: '1.0', encoding: 'UTF-8' }, {
    NFe: {
      '@xmlns': 'http://www.portalfiscal.inf.br/nfe',
      infNFe,
    },
  });

  return { xml: doc.end({ prettyPrint: false }), chaveAcesso, idInfNFe, qrCodeUrl };
}
