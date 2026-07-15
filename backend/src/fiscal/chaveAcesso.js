// Chave de acesso da NFC-e/NF-e: 44 dígitos.
// cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
import crypto from 'crypto';

// Código da UF conforme tabela do IBGE (usada pela SEFAZ). Só as UFs em uso
// pelo projeto hoje; adicionar conforme necessário.
const CODIGO_UF = { RJ: '33', SP: '35', MG: '31' };

function digitoVerificador(chave43) {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let pesoIdx = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * pesos[pesoIdx];
    pesoIdx = (pesoIdx + 1) % pesos.length;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return String(dv);
}

// cNF: código numérico aleatório (8 dígitos) que compõe a chave e evita
// previsibilidade — não é o número da nota, é só um "sal".
function gerarCNF() {
  return String(crypto.randomInt(0, 99999999)).padStart(8, '0');
}

export function montarChaveAcesso({ uf, dataEmissao, cnpj, modelo, serie, numero, tpEmis = '1' }) {
  const codigoUf = CODIGO_UF[uf];
  if (!codigoUf) throw new Error(`UF "${uf}" sem código IBGE mapeado em chaveAcesso.js.`);

  const aamm = `${String(dataEmissao.getFullYear()).slice(2)}${String(dataEmissao.getMonth() + 1).padStart(2, '0')}`;
  const cnpjLimpo = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  const serieStr = String(serie).padStart(3, '0');
  const numeroStr = String(numero).padStart(9, '0');
  const cNF = gerarCNF();

  const chave43 = `${codigoUf}${aamm}${cnpjLimpo}${modelo}${serieStr}${numeroStr}${tpEmis}${cNF}`;
  const dv = digitoVerificador(chave43);
  return `${chave43}${dv}`;
}
