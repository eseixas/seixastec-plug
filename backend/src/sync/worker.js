import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { UPLOAD_DIR } from '../routes/produtos.routes.js';
import { aplicarMovimento } from './estoque.js';
import {
  CENTRAL_URL,
  EDGE_SYNC_TOKEN,
  LOJA_ID,
  SYNC_INTERVAL_MS,
  SYNC_PUSH_BATCH,
  assertEdgeConfig,
} from '../config.js';

// Mapeia o nome lógico da entidade (na resposta de pull) para o delegate Prisma.
const DELEGATE = {
  loja: 'loja',
  pdvTerminal: 'pDVTerminal',
  user: 'user',
  categoria: 'categoria',
  marca: 'marca',
  escalaTamanho: 'escalaTamanho',
  cor: 'cor',
  configuracaoFiscal: 'configuracaoFiscal',
  adquirente: 'adquirente',
  taxaAdquirente: 'taxaAdquirente',
  fornecedor: 'fornecedor',
  produto: 'produto',
  variacao: 'variacao',
  cliente: 'cliente',
};

function headers() {
  return { 'Content-Type': 'application/json', 'x-edge-token': EDGE_SYNC_TOKEN };
}

async function lerCursores() {
  const rows = await prisma.syncCursor.findMany();
  const c = {};
  for (const r of rows) c[r.entidade] = r.cursor;
  return c;
}

async function salvarCursor(entidade, cursorISO) {
  if (!cursorISO) return;
  const cursor = typeof cursorISO === 'string' ? cursorISO : new Date(cursorISO).toISOString();
  await prisma.syncCursor.upsert({
    where: { entidade },
    update: { cursor },
    create: { entidade, cursor },
  });
}

// Baixa a foto do produto da central para o volume local, se ainda não existir.
async function baixarFotoSePreciso(fotoUrl) {
  if (!fotoUrl) return;
  const nome = path.basename(fotoUrl);
  const destino = path.join(UPLOAD_DIR, nome);
  if (fs.existsSync(destino)) return;
  try {
    const r = await fetch(`${CENTRAL_URL}${fotoUrl}`, { headers: { 'x-edge-token': EDGE_SYNC_TOKEN } });
    if (!r.ok) return;
    const buf = Buffer.from(await r.arrayBuffer());
    await fs.promises.writeFile(destino, buf);
  } catch {
    /* tenta de novo no próximo ciclo */
  }
}

async function pull() {
  const cursors = await lerCursores();
  const url = `${CENTRAL_URL}/api/sync/pull?cursors=${encodeURIComponent(JSON.stringify(cursors))}`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error(`pull HTTP ${r.status}`);
  const dados = await r.json();

  // Catálogo/config: upsert por id (central sempre vence).
  for (const [nome, delegate] of Object.entries(DELEGATE)) {
    const bloco = dados[nome];
    if (!bloco || !bloco.rows?.length) continue;
    for (const row of bloco.rows) {
      const { updatedAt, ...data } = row; // deixa o Prisma gerir @updatedAt local
      // Variação: NÃO sobrescrever o saldo agregado local. O edge mantém
      // Variacao.estoqueAtual pelo fold dos SEUS movimentos; o valor da central
      // é o agregado global e não vale para a loja.
      if (nome === 'variacao') {
        delete data.estoqueAtual;
        delete data.estoqueMinimo;
        await prisma.variacao.upsert({
          where: { id: data.id },
          update: data,
          create: { ...data, estoqueAtual: 0, estoqueMinimo: 0 },
        });
      } else {
        await prisma[delegate].upsert({ where: { id: data.id }, update: data, create: data });
      }
      if (nome === 'produto' && data.fotoUrl) await baixarFotoSePreciso(data.fotoUrl);
    }
    await salvarCursor(nome, bloco.cursor);
  }

  // Movimentos de estoque descidos da central (entradas/ajustes do admin).
  const mov = dados['movimentacaoEstoque'];
  if (mov?.rows?.length) {
    for (const m of mov.rows) {
      await prisma.$transaction((tx) => aplicarMovimento(tx, m)); // idempotente por id
    }
    await salvarCursor('movimentacaoEstoque', mov.cursor);
  }
}

async function push() {
  const pendentes = await prisma.outboxEvent.findMany({
    where: { syncedAt: null },
    orderBy: { createdAt: 'asc' },
    take: SYNC_PUSH_BATCH,
  });
  if (!pendentes.length) return;

  const eventos = pendentes.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    entidadeId: e.entidadeId,
    payload: e.payload,
    createdAt: e.createdAt,
  }));

  const r = await fetch(`${CENTRAL_URL}/api/sync/push`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ eventos, lojaId: LOJA_ID }),
  });
  if (!r.ok) throw new Error(`push HTTP ${r.status}`);
  const { acked = [], falhas = [] } = await r.json();

  if (acked.length) {
    await prisma.outboxEvent.updateMany({
      where: { id: { in: acked } },
      data: { syncedAt: new Date() },
    });
  }
  for (const f of falhas) {
    await prisma.outboxEvent.update({
      where: { id: f.id },
      data: { tentativas: { increment: 1 } },
    }).catch(() => {});
  }
}

let rodando = false;
async function ciclo() {
  if (rodando) return;
  rodando = true;
  try {
    await push(); // sobe primeiro (não perder vendas)
    await pull(); // depois atualiza catálogo
  } catch (err) {
    // Offline ou central indisponível: silencioso, tenta no próximo ciclo.
    console.warn(`[sync] ciclo falhou: ${err.message}`);
  } finally {
    rodando = false;
  }
}

export function iniciarWorkerSync() {
  assertEdgeConfig();
  console.log(`[sync] worker do edge iniciado (loja=${LOJA_ID}, central=${CENTRAL_URL}, intervalo=${SYNC_INTERVAL_MS}ms)`);
  // Primeiro ciclo logo após subir; depois em intervalos fixos.
  setTimeout(ciclo, 3000);
  setInterval(ciclo, SYNC_INTERVAL_MS);
}
