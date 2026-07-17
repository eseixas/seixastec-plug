// Carrega o certificado A1 (.pfx) do edge, uma única vez, e mantém em memória.
// Nunca logar a senha nem o conteúdo do certificado.
import fs from 'fs';
import forge from 'node-forge';
import { FISCAL_CERT_PATH, FISCAL_CERT_SENHA } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../lib/cryptoSenha.js';

let cache = null;

// Caminho/senha efetivos — inicializam com as env vars (fluxo antigo, upload
// direto no edge sem central) e são sobrescritos por sincronizarConfigCertificado()
// quando ConfiguracaoEmpresa (admin central → sync) tem um certificado configurado.
let certPathAtivo = FISCAL_CERT_PATH;
let certSenhaAtiva = FISCAL_CERT_SENHA;

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

// Relê ConfiguracaoEmpresa (fonte preferida: admin central → sync) e atualiza
// certPathAtivo/certSenhaAtiva; cai para as env vars antigas se a linha ainda
// não existir ou não tiver senha decriptável. Chame isso na inicialização do
// worker fiscal e sempre que o sync baixar um certificado novo, ANTES de usar
// carregarCertificado() (que continua síncrono para não propagar `async` por
// toda a cadeia de assinatura/SOAP).
export async function sincronizarConfigCertificado() {
  try {
    const cfg = await prisma.configuracaoEmpresa.findUnique({ where: { id: 'singleton' } });
    if (cfg?.certificadoArquivo && cfg?.certificadoSenha) {
      const senha = decrypt(cfg.certificadoSenha);
      if (senha) {
        certPathAtivo = cfg.certificadoArquivo;
        certSenhaAtiva = senha;
        cache = null;
        return;
      }
    }
  } catch {
    /* ConfiguracaoEmpresa pode não existir ainda (migration não rodada) */
  }
  certPathAtivo = FISCAL_CERT_PATH;
  certSenhaAtiva = FISCAL_CERT_SENHA;
  cache = null;
}

// Carrega (e cacheia) o certificado configurado no edge. Lança erro claro se
// o arquivo/senha estiverem ausentes ou inválidos — chamado só quando a
// emissão fiscal está de fato habilitada.
export function carregarCertificado() {
  if (cache) return cache;

  if (!certPathAtivo || !certSenhaAtiva) {
    throw new Error('Certificado não configurado (nem em Configurações → Empresa, nem em FISCAL_CERT_PATH/FISCAL_CERT_SENHA).');
  }
  if (!fs.existsSync(certPathAtivo)) {
    throw new Error(`Certificado não encontrado em ${certPathAtivo}.`);
  }

  const pfxBuffer = fs.readFileSync(certPathAtivo);
  const { chavePrivadaPem, certificadoPem, certificado } = pfxParaPem(pfxBuffer, certSenhaAtiva);

  const validade = certificado.validity.notAfter;
  if (validade.getTime() < Date.now()) {
    throw new Error(`Certificado A1 vencido em ${validade.toISOString()}.`);
  }

  cache = {
    pfxBuffer,      // para https.Agent({ pfx, passphrase }) — mTLS com a SEFAZ
    passphrase: certSenhaAtiva,
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
