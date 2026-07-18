// Criptografia simétrica (AES-256-GCM) para segredos em repouso — usado hoje
// só para a senha do certificado digital A1 (ConfiguracaoEmpresa.certificadoSenha).
// A chave é derivada do JWT_SECRET via scrypt (não reutilizamos o JWT_SECRET
// bruto como chave AES). NUNCA logar o valor em claro.
import crypto from 'crypto';
import { JWT_SECRET } from './secret.js';
const SALT = 'seixastec-plug:cryptoSenha:v1'; // fixo — só precisa ser estável, não secreto
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

let chaveCache = null;
function chave() {
  if (!chaveCache) chaveCache = crypto.scryptSync(JWT_SECRET, SALT, 32);
  return chaveCache;
}

// Retorna string no formato "iv:authTag:cipherText" (tudo em base64).
export function encrypt(texto) {
  if (texto === null || texto === undefined || texto === '') return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, chave(), iv);
  const cipherText = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), cipherText.toString('base64')].join(':');
}

export function decrypt(payload) {
  if (!payload) return null;
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv(ALGO, chave(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const texto = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return texto.toString('utf8');
  } catch {
    return null; // payload corrompido ou criptografado com outra chave
  }
}
