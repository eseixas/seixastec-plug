// Fonte única do JWT_SECRET (assinatura de tokens e derivação da chave AES de
// cryptoSenha.js). Em produção o processo NÃO SOBE com segredo ausente ou com
// os placeholders conhecidos de dev/compose — rodar com eles permitiria a
// qualquer pessoa forjar tokens de admin e decifrar a senha do certificado A1.
const PLACEHOLDERS = new Set(['dev-secret', 'troque-este-segredo']);

const bruto = process.env.JWT_SECRET || '';

if (process.env.NODE_ENV === 'production' && (!bruto || PLACEHOLDERS.has(bruto))) {
  throw new Error(
    'JWT_SECRET ausente ou com valor placeholder em produção. Defina um segredo forte no .env ' +
      '(ex.: openssl rand -hex 32) antes de subir o backend.'
  );
}

if (!bruto || PLACEHOLDERS.has(bruto)) {
  console.warn('[seguranca] JWT_SECRET de desenvolvimento em uso — NÃO use em produção.');
}

export const JWT_SECRET = bruto || 'dev-secret';
