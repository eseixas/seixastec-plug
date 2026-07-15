import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

router.post('/login', asyncHandler(async (req, res) => {
  const { email, senha } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.ativo || !bcrypt.compareSync(senha, user.senhaHash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
  });
}));

router.get('/me', authRequired, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, nome: true, email: true, role: true },
  });
  res.json(user);
}));

export default router;
