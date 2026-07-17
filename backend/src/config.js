// Configuração de papel do nó (central x edge) e parâmetros de sincronização.
// A MESMA imagem roda como central (VPS) ou edge (loja) conforme estas envs.

export const NODE_ROLE = (process.env.NODE_ROLE || 'central').toLowerCase();
export const IS_EDGE = NODE_ROLE === 'edge';
export const IS_CENTRAL = !IS_EDGE;

// No edge, identifica a loja (obrigatório) e como falar com a central.
export const LOJA_ID = process.env.LOJA_ID || null;
export const CENTRAL_URL = (process.env.CENTRAL_URL || '').replace(/\/$/, '') || null;
export const EDGE_SYNC_TOKEN = process.env.EDGE_SYNC_TOKEN || null;

// Intervalo do worker de sync (ms) e tamanho de lote de push.
export const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 15000);
export const SYNC_PUSH_BATCH = Number(process.env.SYNC_PUSH_BATCH || 100);

export function assertEdgeConfig() {
  const faltando = [];
  if (!LOJA_ID) faltando.push('LOJA_ID');
  if (!CENTRAL_URL) faltando.push('CENTRAL_URL');
  if (!EDGE_SYNC_TOKEN) faltando.push('EDGE_SYNC_TOKEN');
  if (faltando.length) {
    throw new Error(`NODE_ROLE=edge requer as variáveis: ${faltando.join(', ')}`);
  }
}

// Emissão fiscal (NFC-e/NF-e), roda somente no edge. O certificado A1 fica em
// arquivo num volume Docker dedicado (não público, distinto de UPLOAD_DIR).
export const FISCAL_CERT_PATH = process.env.FISCAL_CERT_PATH || null;
export const FISCAL_CERT_SENHA = process.env.FISCAL_CERT_SENHA || null;
export const FISCAL_CSC = process.env.FISCAL_CSC || null;
export const FISCAL_ID_CSC = process.env.FISCAL_ID_CSC || null;
// Habilita a fila/worker fiscal — só liga quando a loja já configurou os
// dados de emissão; sem isso, vendas continuam funcionando normalmente.
export const FISCAL_HABILITADO = String(process.env.FISCAL_HABILITADO || '').toLowerCase() === 'true';

// NOTA: FISCAL_CERT_PATH/FISCAL_CERT_SENHA não são mais exigidos aqui — o
// certificado pode vir de Configurações → Empresa no admin central (desce
// via sync e é lido por fiscal/certificado.js, que cai para essas env vars
// só se ConfiguracaoEmpresa ainda não tiver certificado). CSC/idCSC continuam
// vindo só de env: não fazem parte do certificado, são específicos da SEFAZ.
export function assertFiscalConfig() {
  const faltando = [];
  if (!FISCAL_CSC) faltando.push('FISCAL_CSC');
  if (!FISCAL_ID_CSC) faltando.push('FISCAL_ID_CSC');
  if (faltando.length) {
    throw new Error(`FISCAL_HABILITADO=true requer as variáveis: ${faltando.join(', ')}`);
  }
}
