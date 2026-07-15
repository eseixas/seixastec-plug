import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { UPLOAD_DIR } from './routes/produtos.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRequired, requireRole } from './middleware/auth.js';

import authRoutes from './routes/auth.routes.js';
import categoriasRoutes from './routes/categorias.routes.js';
import marcasRoutes from './routes/marcas.routes.js';
import produtosRoutes from './routes/produtos.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import fornecedoresRoutes from './routes/fornecedores.routes.js';
import estoqueRoutes from './routes/estoque.routes.js';
import estoqueTransferenciasRoutes from './routes/estoque-transferencias.routes.js';
import comprasRoutes from './routes/compras.routes.js';
import vendasRoutes from './routes/vendas.routes.js';
import caixaRoutes from './routes/caixa.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import adquirentesRoutes from './routes/adquirentes.routes.js';
import recebiveisRoutes from './routes/recebiveis.routes.js';
import contasBancariasRoutes from './routes/financeiro/contas-bancarias.routes.js';
import categoriasFinanceirasRoutes from './routes/financeiro/categorias-financeiras.routes.js';
import contasPagarRoutes from './routes/financeiro/contas-pagar.routes.js';
import resultadosRoutes from './routes/financeiro/resultados.routes.js';
import extratoRoutes from './routes/financeiro/extrato.routes.js';
import transferenciasContasRoutes from './routes/financeiro/transferencias.routes.js';
import conciliacaoRoutes from './routes/financeiro/conciliacao.routes.js';
import lojasRoutes from './routes/lojas.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import apiKeysRoutes from './routes/apikeys.routes.js';
import escalasRoutes from './routes/escalas.routes.js';
import coresRoutes from './routes/cores.routes.js';
import configRoutes from './routes/config.routes.js';
import etiquetasRoutes from './routes/etiquetas.routes.js';
import syncRoutes from './routes/sync.routes.js';
import fiscalRoutes from './routes/fiscal.routes.js';

import { NODE_ROLE, IS_CENTRAL, IS_EDGE, LOJA_ID } from './config.js';
import { iniciarWorkerSync } from './sync/worker.js';
import { iniciarWorkerFiscal } from './fiscal/worker.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // payloads de sync (lotes de vendas)

app.get('/health', (req, res) =>
  res.json({ ok: true, sistema: 'SeixasTec — Gestão Total', role: NODE_ROLE, lojaId: LOJA_ID })
);

// Imagens dos produtos (públicas).
app.use('/uploads', express.static(UPLOAD_DIR));

app.use('/api/auth', authRoutes);

// Rotas protegidas (JWT ou API Key via header x-api-key)
app.use('/api/categorias', authRequired, categoriasRoutes);
app.use('/api/marcas', authRequired, marcasRoutes);
app.use('/api/produtos', authRequired, produtosRoutes);
app.use('/api/clientes', authRequired, clientesRoutes);
app.use('/api/fornecedores', authRequired, fornecedoresRoutes);
app.use('/api/estoque', authRequired, estoqueRoutes);
app.use('/api/estoque/transferencias', authRequired, estoqueTransferenciasRoutes);
app.use('/api/compras', authRequired, comprasRoutes);
app.use('/api/vendas', authRequired, vendasRoutes);
app.use('/api/caixa', authRequired, caixaRoutes);
app.use('/api/dashboard', authRequired, dashboardRoutes);
app.use('/api/adquirentes', authRequired, adquirentesRoutes);
app.use('/api/recebiveis', authRequired, recebiveisRoutes);
app.use('/api/financeiro/contas-bancarias', authRequired, requireRole('ADMIN', 'FINANCEIRO'), contasBancariasRoutes);
app.use('/api/financeiro/categorias', authRequired, requireRole('ADMIN', 'FINANCEIRO'), categoriasFinanceirasRoutes);
app.use('/api/financeiro/contas-pagar', authRequired, requireRole('ADMIN', 'FINANCEIRO'), contasPagarRoutes);
app.use('/api/financeiro/resultados', authRequired, requireRole('ADMIN', 'FINANCEIRO'), resultadosRoutes);
app.use('/api/financeiro/extrato', authRequired, requireRole('ADMIN', 'FINANCEIRO'), extratoRoutes);
app.use('/api/financeiro/transferencias', authRequired, requireRole('ADMIN', 'FINANCEIRO'), transferenciasContasRoutes);
app.use('/api/financeiro/conciliacao', authRequired, requireRole('ADMIN', 'FINANCEIRO'), conciliacaoRoutes);
app.use('/api/lojas', authRequired, lojasRoutes);
app.use('/api/usuarios', authRequired, requireRole('ADMIN'), usuariosRoutes);
app.use('/api/apikeys', authRequired, apiKeysRoutes);
app.use('/api/escalas', authRequired, escalasRoutes);
app.use('/api/cores', authRequired, coresRoutes);
app.use('/api/config', authRequired, configRoutes);
app.use('/api/etiquetas', authRequired, etiquetasRoutes);

// Rotas de sincronização: só existem na CENTRAL (o edge é o cliente delas).
// Autenticação própria por token de edge (dentro de sync.routes.js).
if (IS_CENTRAL) {
  app.use('/api/sync', syncRoutes);
}

// Fiscal (NFC-e/NF-e): emissão só acontece no edge, mas a central também
// expõe a rota (somente leitura + reenvio bloqueado) para o admin mostrar o
// status das notas sincronizadas via outbox.
app.use('/api/fiscal', authRequired, fiscalRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SeixasTec API rodando na porta ${PORT} (role=${NODE_ROLE})`);
  // No edge, sobe o worker que puxa catálogo e empurra vendas/estoque/caixa.
  if (IS_EDGE) {
    try {
      iniciarWorkerSync();
    } catch (err) {
      console.error(`[sync] não foi possível iniciar o worker: ${err.message}`);
    }
    try {
      iniciarWorkerFiscal();
    } catch (err) {
      console.error(`[fiscal] não foi possível iniciar o worker: ${err.message}`);
    }
  }
});
