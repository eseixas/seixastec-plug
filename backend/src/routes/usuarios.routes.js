import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

// Nunca inclui senhaHash nas respostas.
const SELECT_SAFE = {
  id: true,
  nome: true,
  email: true,
  role: true,
  lojaId: true,
  ativo: true,
  createdAt: true,
};

const createSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(6),
  role: z.enum(['ADMIN', 'GERENTE', 'FINANCEIRO', 'CAIXA', 'VENDEDOR']),
  lojaId: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

// Troca de senha passa pelo endpoint dedicado /:id/redefinir-senha.
const updateSchema = createSchema.omit({ senha: true }).partial();

const senhaSchema = z.object({
  senha: z.string().min(6),
});

// Garante que não é possível deixar o sistema sem nenhum admin ativo.
// Só bloqueia quando o usuário alvo É atualmente admin ativo e a mudança o
// tiraria dessa condição (desativação ou troca de role para algo != ADMIN).
async function garantirNaoUltimoAdmin(usuarioId, usuarioAtual, mudancaSaiDeAdmin) {
  if (!mudancaSaiDeAdmin) return;
  if (usuarioAtual.role !== 'ADMIN' || !usuarioAtual.ativo) return;

  const outrosAdminsAtivos = await prisma.user.count({
    where: { role: 'ADMIN', ativo: true, id: { not: usuarioId } },
  });
  if (outrosAdminsAtivos === 0) {
    throw Object.assign(new Error('Não é possível remover o último administrador ativo'), { status: 400 });
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const { q, ativo } = req.query;
  const where = {
    ...(q
      ? {
          OR: [
            { nome: { contains: String(q), mode: 'insensitive' } },
            { email: { contains: String(q), mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(ativo === 'true' ? { ativo: true } : ativo === 'false' ? { ativo: false } : {}),
  };
  const usuarios = await prisma.user.findMany({
    where,
    orderBy: { nome: 'asc' },
    select: SELECT_SAFE,
  });
  res.json(usuarios);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { senha, ...data } = createSchema.parse(req.body);
  const senhaHash = bcrypt.hashSync(senha, 10);
  const usuario = await prisma.user.create({
    data: { ...data, senhaHash },
    select: SELECT_SAFE,
  });
  res.status(201).json(usuario);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const data = updateSchema.parse(req.body);
  const atual = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { role: true, ativo: true },
  });

  const mudancaSaiDeAdmin =
    data.ativo === false || (data.role !== undefined && data.role !== 'ADMIN');
  await garantirNaoUltimoAdmin(req.params.id, atual, mudancaSaiDeAdmin);

  const usuario = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: SELECT_SAFE,
  });
  res.json(usuario);
}));

router.post('/:id/redefinir-senha', asyncHandler(async (req, res) => {
  const { senha } = senhaSchema.parse(req.body);
  const senhaHash = bcrypt.hashSync(senha, 10);
  const usuario = await prisma.user.update({
    where: { id: req.params.id },
    data: { senhaHash },
    select: SELECT_SAFE,
  });
  res.json(usuario);
}));

// Exclusão física. Na prática, usuários com histórico (vendas, caixas,
// movimentações de estoque) não podem ser excluídos por causa da FK — o
// erro P2003 já é traduzido para 409 pelo errorHandler. Para esses casos,
// o caminho real de desativação é PUT com { ativo: false }.
router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.user.sub) {
    throw Object.assign(new Error('Você não pode excluir seu próprio usuário'), { status: 400 });
  }

  const atual = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { role: true, ativo: true },
  });
  await garantirNaoUltimoAdmin(req.params.id, atual, true);

  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
