import { IS_EDGE } from '../config.js';

// Enfileira um evento para subir à central. No-op na central (só o edge tem
// outbox). Deve ser chamado DENTRO da mesma transação da escrita de negócio,
// garantindo que o evento só existe se a escrita persistiu.
export async function enfileirar(tx, tipo, entidadeId, payload) {
  if (!IS_EDGE) return;
  // Serializa para JSON puro (Decimals -> string, Dates -> ISO) de forma determinística.
  const limpo = JSON.parse(JSON.stringify(payload));
  await tx.outboxEvent.create({ data: { tipo, entidadeId, payload: limpo } });
}
