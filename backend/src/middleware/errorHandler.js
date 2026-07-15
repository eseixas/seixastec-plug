import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Dados inválidos', detalhes: err.flatten() });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Registro duplicado', campo: err.meta?.target });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Registro em uso, não pode ser excluído' });
    }
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}
