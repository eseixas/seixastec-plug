// Monta o XML da NF-e (modelo 55) para lançamentos manuais no admin
// (transferência entre lojas, devolução a fornecedor, venda B2B) — sem
// Venda associada, os dados vêm de um formulário (destinatário + itens).
//
// Reaproveita a mesma infraestrutura de certificado/assinatura/transmissão
// da NFC-e; a diferença é o grupo <dest> (obrigatório aqui) e a ausência de
// QR Code/infNFeSupl (isso é exclusivo de NFC-e).
import { create } from 'xmlbuilder2';
import { montarChaveAcesso } from '../chaveAcesso.js';
import { resolverTributacaoProduto } from '../tributacao.js';

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const fmt2 = (n) => round2(n).toFixed(2);

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
 * @param {object} params
 * @param {{ destinatario: {cnpj?:string, cpf?:string, nome:string, ie?:string, logradouro?:string, numero?:string, bairro?:string, codigoMunicipioIbge?:string, cidade?:string, uf?:string, cep?:string, indIEDest?:string}, itens: Array<{nome:string, ncm:string, cfop:string, quantidade:number, valorUnitario:number, unidade?:string}>, naturezaOperacao: string }} params.dadosManual
 * @param {import('@prisma/client').Loja} params.loja
 * @param {import('@prisma/client').ConfiguracaoFiscal} params.configFiscal
 * @param {number} params.numero
 * @param {number} params.serie
 * @param {string} params.ambiente
 */
export function montarXmlNfe({ dadosManual, loja, configFiscal, numero, serie, ambiente }) {
  if (!loja.cnpj) throw new Error('Loja sem CNPJ cadastrado — obrigatório para emissão fiscal.');
  if (!loja.uf) throw new Error('Loja sem UF cadastrada — obrigatório para emissão fiscal.');
  if (!loja.crt) throw new Error('Loja sem CRT (regime tributário) cadastrado.');
  if (!loja.codigoMunicipioIbge) throw new Error('Loja sem código IBGE do município cadastrado.');

  const { destinatario, itens, naturezaOperacao } = dadosManual;
  if (!destinatario?.nome) throw new Error('Destinatário sem nome.');
  if (!destinatario?.cnpj && !destinatario?.cpf) throw new Error('Destinatário precisa de CNPJ ou CPF.');
  if (!itens?.length) throw new Error('NF-e precisa de ao menos 1 item.');

  const dataEmissao = new Date();
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const idDest = destinatario.uf && destinatario.uf !== loja.uf ? '2' : '1'; // 1=interna, 2=interestadual

  const chaveAcesso = montarChaveAcesso({
    uf: loja.uf,
    dataEmissao,
    cnpj: loja.cnpj,
    modelo: '55',
    serie,
    numero,
  });
  const cnpjLimpo = loja.cnpj.replace(/\D/g, '');
  const idInfNFe = `NFe${chaveAcesso}`;

  const det = itens.map((item, idx) => {
    const vProd = round2(Number(item.valorUnitario) * Number(item.quantidade));
    // NF-e manual não tem Produto/grupo — só o singleton define origem/CSOSN.
    const { origem, csosn } = resolverTributacaoProduto(null, null, configFiscal);
    return {
      '@nItem': String(idx + 1),
      prod: {
        cProd: String(idx + 1).padStart(6, '0'),
        cEAN: 'SEM GTIN',
        xProd:
          idx === 0 && ambiente === 'homologacao'
            ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
            : item.nome,
        NCM: item.ncm,
        CFOP: item.cfop,
        uCom: item.unidade || 'UN',
        qCom: String(item.quantidade),
        vUnCom: fmt2(item.valorUnitario),
        vProd: fmt2(vProd),
        cEANTrib: 'SEM GTIN',
        uTrib: item.unidade || 'UN',
        qTrib: String(item.quantidade),
        vUnTrib: fmt2(item.valorUnitario),
        indTot: '1',
      },
      imposto: {
        ICMS: { ICMSSN102: { orig: origem, CSOSN: csosn } },
        PIS: { PISNT: { CST: '07' } },
        COFINS: { COFINSNT: { CST: '07' } },
      },
    };
  });

  const vProdTotal = round2(itens.reduce((acc, i) => acc + Number(i.valorUnitario) * Number(i.quantidade), 0));

  const dest = {
    ...(destinatario.cnpj ? { CNPJ: destinatario.cnpj.replace(/\D/g, '') } : { CPF: destinatario.cpf.replace(/\D/g, '') }),
    // Regra da SEFAZ para NF-e em homologação: a razão social do
    // DESTINATÁRIO (não do item, diferente da NFC-e) precisa ser exatamente
    // este texto, senão a nota é rejeitada (cStat 598).
    xNome: ambiente === 'homologacao' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : destinatario.nome,
    enderDest: {
      xLgr: destinatario.logradouro || 'Não informado',
      nro: destinatario.numero || 'S/N',
      xBairro: destinatario.bairro || 'Não informado',
      cMun: destinatario.codigoMunicipioIbge || loja.codigoMunicipioIbge,
      xMun: destinatario.cidade || loja.cidade || '',
      UF: destinatario.uf || loja.uf,
      CEP: (destinatario.cep || '').replace(/\D/g, '') || undefined,
      cPais: '1058',
      xPais: 'BRASIL',
    },
    indIEDest: destinatario.indIEDest || (destinatario.ie ? '1' : '9'), // 1=contribuinte ICMS, 9=não contribuinte
    ...(destinatario.ie ? { IE: destinatario.ie.replace(/\D/g, '') } : {}),
  };
  // Destinatário não-contribuinte (indIEDest=9) é necessariamente consumidor
  // final — a SEFAZ rejeita indFinal=0 nesse caso (cStat 696).
  const indFinal = dest.indIEDest === '9' ? '1' : '0';

  const infNFe = {
    '@Id': idInfNFe,
    '@versao': '4.00',
    ide: {
      cUF: chaveAcesso.slice(0, 2),
      cNF: chaveAcesso.slice(35, 43),
      natOp: naturezaOperacao || 'Remessa',
      mod: '55',
      serie: String(serie),
      nNF: String(numero),
      dhEmi: isoComOffset(dataEmissao),
      tpNF: '1',
      idDest,
      cMunFG: loja.codigoMunicipioIbge,
      tpImp: '1', // DANFE retrato
      tpEmis: '1',
      cDV: chaveAcesso.slice(-1),
      tpAmb,
      finNFe: '1',
      indFinal,
      indPres: '9', // operação não presencial (padrão para emissão manual pelo admin)
      indIntermed: '0', // sem intermediador/marketplace (NT2020.006) — obrigatório desde então
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
    dest,
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
        vDesc: '0.00',
        vII: '0.00',
        vIPI: '0.00',
        vIPIDevol: '0.00',
        vPIS: '0.00',
        vCOFINS: '0.00',
        vOutro: '0.00',
        vNF: fmt2(vProdTotal),
      },
    },
    transp: { modFrete: '9' },
    // Obrigatório desde a NT 2016.002 mesmo sem movimentação financeira
    // (transferência/devolução) — tPag=90 "Sem pagamento".
    pag: { detPag: { tPag: '90', vPag: '0.00' } },
  };

  const doc = create({ version: '1.0', encoding: 'UTF-8' }, {
    NFe: { '@xmlns': 'http://www.portalfiscal.inf.br/nfe', infNFe },
  });

  return { xml: doc.end({ prettyPrint: false }), chaveAcesso, idInfNFe };
}
