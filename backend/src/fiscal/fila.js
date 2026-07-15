// Fila fiscal: grava a INTENÇÃO de emitir a NFC-e na mesma transação da
// venda (escrita local, sem I/O de rede — não bloqueia nem arrisca rollback
// da venda). O worker fiscal processa de forma assíncrona e independente.
import { proximoNumero } from './numeracao.js';

// @param {import('@prisma/client').PrismaClient} tx - transação Prisma aberta
export async function enfileirarNfce(tx, { lojaId, vendaId, ambiente, serie }) {
  const numero = await proximoNumero(tx, { lojaId, modelo: '65', serie });
  return tx.notaFiscal.create({
    data: {
      modelo: '65',
      serie,
      numero,
      lojaId,
      vendaId,
      ambiente,
      status: 'PENDENTE',
    },
  });
}
