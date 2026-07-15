// Carrega o certificado A1 (.pfx) do edge, uma única vez, e mantém em memória.
// Nunca logar a senha nem o conteúdo do certificado.
import fs from 'fs';
import forge from 'node-forge';
import { FISCAL_CERT_PATH, FISCAL_CERT_SENHA } from '../config.js';

let cache = null;

// Extrai o primeiro par chave-privada/certificado de um PKCS#12 (.pfx) em PEM,
// formato consumido tanto pela assinatura XML-DSig quanto (se preciso) por
// libs que não aceitam pfx bruto diretamente.
function pfxParaPem(pfxBuffer, senha) {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  const certBag = (certBags[forge.pki.oids.certBag] || [])[0];

  if (!keyBag?.key || !certBag?.cert) {
    throw new Error('Certificado A1 inválido: não foi possível extrair chave privada e certificado do .pfx.');
  }

  return {
    chavePrivadaPem: forge.pki.privateKeyToPem(keyBag.key),
    certificadoPem: forge.pki.certificateToPem(certBag.cert),
    certificado: certBag.cert,
  };
}

// Carrega (e cacheia) o certificado configurado no edge. Lança erro claro se
// o arquivo/senha estiverem ausentes ou inválidos — chamado só quando a
// emissão fiscal está de fato habilitada.
export function carregarCertificado() {
  if (cache) return cache;

  if (!FISCAL_CERT_PATH || !FISCAL_CERT_SENHA) {
    throw new Error('FISCAL_CERT_PATH/FISCAL_CERT_SENHA não configurados.');
  }
  if (!fs.existsSync(FISCAL_CERT_PATH)) {
    throw new Error(`Certificado não encontrado em ${FISCAL_CERT_PATH}.`);
  }

  const pfxBuffer = fs.readFileSync(FISCAL_CERT_PATH);
  const { chavePrivadaPem, certificadoPem, certificado } = pfxParaPem(pfxBuffer, FISCAL_CERT_SENHA);

  const validade = certificado.validity.notAfter;
  if (validade.getTime() < Date.now()) {
    throw new Error(`Certificado A1 vencido em ${validade.toISOString()}.`);
  }

  cache = {
    pfxBuffer,      // para https.Agent({ pfx, passphrase }) — mTLS com a SEFAZ
    passphrase: FISCAL_CERT_SENHA,
    chavePrivadaPem, // para assinatura XML-DSig (xml-crypto)
    certificadoPem,
    validade,
  };
  return cache;
}

// Limpa o cache em memória — chamado depois de um upload de certificado novo
// para que a próxima emissão já use o arquivo atualizado sem reiniciar o
// processo.
export function recarregarCertificado() {
  cache = null;
}

// Só para diagnóstico (ex. tela de config no admin) — nunca expor a senha.
export function statusCertificado() {
  try {
    const { validade } = carregarCertificado();
    return { ok: true, validade };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
}
