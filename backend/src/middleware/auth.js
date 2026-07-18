import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { JWT_SECRET } from '../lib/secret.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, nome: user.nome, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function hashApiKey(chave) {
  return crypto.createHash('sha256').update(chave).digest('hex');
}

// Aceita autenticação por JWT (Bearer) OU por API Key (header x-api-key).
// A API Key opera como o usuário vinculado (req.user.sub aponta para um User real).
export async function authRequired(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    try {
      const registro = await prisma.apiKey.findUnique({
        where: { chaveHash: hashApiKey(String(apiKey)) },
        include: { usuario: true },
      });
      if (!registro || !registro.ativo) {
        return res.status(401).json({ error: 'API Key inválida' });
      }
      // A chave opera como o usuário vinculado: sem usuário (ou com usuário
      // desativado) ela não autentica — e nunca assume papel por padrão.
      if (!registro.usuario || !registro.usuario.ativo) {
        return res.status(401).json({ error: 'API Key sem usuário ativo associado' });
      }
      // Atualiza último uso sem bloquear a requisição.
      prisma.apiKey.update({ where: { id: registro.id }, data: { ultimoUso: new Date() } }).catch(() => {});
      req.user = {
        sub: registro.usuario.id,
        role: registro.usuario.role,
        viaApiKey: true,
      };
      return next();
    } catch {
      return res.status(401).json({ error: 'Falha ao validar API Key' });
    }
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    next();
  };
}

// Autenticação de EDGE para as rotas de sync: header x-edge-token validado
// contra EdgeNode.tokenHash (sha256). Identifica a loja do edge em req.edge.
export async function edgeAuthRequired(req, res, next) {
  const token = req.headers['x-edge-token'];
  if (!token) return res.status(401).json({ error: 'Token de edge ausente' });
  try {
    const node = await prisma.edgeNode.findUnique({
      where: { tokenHash: hashApiKey(String(token)) },
    });
    if (!node) return res.status(401).json({ error: 'Token de edge inválido' });
    req.edge = { lojaId: node.id, nome: node.nome };
    return next();
  } catch {
    return res.status(401).json({ error: 'Falha ao validar token de edge' });
  }
}
