# Revisão completa do projeto — julho/2026

Revisão de código de todo o monorepo (backend, admin, PDV, sync central/edge,
Docker). Achados classificados por severidade; itens marcados **[corrigido]**
foram aplicados nesta mesma revisão (branch `revisao-completa`), os demais
ficam como recomendação.

## Críticos (segurança)

1. **[corrigido] Escalação de privilégio via API Keys.** `POST /api/apikeys`
   exigia apenas login: qualquer usuário (ex.: VENDEDOR) podia criar uma chave
   vinculada a um ADMIN (`usuarioId` livre no corpo) e passar a operar como
   admin. Agora toda a rota `/api/apikeys` exige papel ADMIN
   (`backend/src/server.js`).
2. **[corrigido] API Key de usuário desativado continuava válida.** A
   autenticação só checava `apiKey.ativo`, não o `usuario.ativo`; e uma chave
   sem usuário caía num fallback `role: 'ADMIN'`. Agora a chave exige usuário
   ativo e herda exatamente o papel dele (`backend/src/middleware/auth.js`).
3. **[corrigido] Segredos placeholder em produção.** `JWT_SECRET || 'dev-secret'`
   (auth e cryptoSenha) somado aos defaults dos compose
   (`troque-este-segredo`) permitia subir produção com segredo público — o que
   permite forjar token de admin e decifrar a senha do certificado A1 (a chave
   AES deriva do JWT_SECRET). Novo `backend/src/lib/secret.js`: em
   `NODE_ENV=production` o backend **não sobe** com segredo ausente/placeholder;
   em dev, apenas avisa.
4. **[corrigido] Qualquer usuário logado podia regenerar o token de sync de um
   edge** (`POST /api/lojas/edges`) — o token dá acesso total ao canal de sync,
   incluindo os hashes de senha dos usuários que descem ao edge; regenerar
   também derruba o sync da loja. Agora é ADMIN; CRUD de lojas/terminais passou
   a exigir ADMIN/GERENTE (leituras continuam abertas a autenticados, o PDV usa).

## Altos (dinheiro e consistência)

5. **[corrigido] Backend confiava no preço enviado pelo cliente.** `POST
   /api/vendas` aceitava qualquer `precoUnit`; um operador podia vender por
   R$ 0,01 sem passar pelas regras de desconto. Agora o preço unitário é
   validado contra o catálogo (`Variacao.precoVenda ?? Produto.precoVenda`) e
   divergência é rejeitada; desconto continua sendo o único caminho de redução,
   com os limites/aprovação já existentes (`backend/src/routes/vendas.routes.js`).
6. **[corrigido] Recebível podia ser "recebido" mais de uma vez**, creditando a
   conta bancária em dobro a cada clique (`POST /api/recebiveis/:id/receber`
   não checava status). Agora só recebe se `PENDENTE`
   (`backend/src/routes/recebiveis.routes.js`).
7. **[corrigido] Matemática de dinheiro em float no backend.** O PDV calcula em
   centavos inteiros, o backend recalculava em float com `round2` e tolerância
   de 1 centavo. Novo `backend/src/lib/money.js` (centavos inteiros, mesmo
   modelo do `pdvMath.js`): totais da venda, taxa de adquirente e rateio de
   parcelas (resíduo na última, com prova por testes de que a soma fecha
   exata); validação de pagamentos agora é igualdade exata. Também passou a
   rejeitar desconto maior que o item/venda (antes permitia total negativo).
   Fechamento de caixa somando em centavos (`caixa.routes.js`).
8. **[corrigido] `bloquearVendaSemEstoque` estava invertido/quebrado no
   backend:** com a opção **desligada** (default) a venda sem saldo era
   rejeitada mesmo assim (os dois ramos lançavam erro), contradizendo a UI
   ("Bloquear finalização…" desmarcado) e o comportamento do PDV. Agora:
   ligada = bloqueia; desligada = permite (estoque fica negativo).
9. **[corrigido] Movimento/fechamento em caixa já fechado.** `POST
   /api/caixa/:id/movimento` e `/fechar` não checavam `aberto` — dava para
   lançar sangria em caixa fechado e fechar duas vezes. Ambos agora exigem
   caixa aberto.
10. **[corrigido] Editar recebível manual deixava o líquido defasado** (PUT
    atualizava `valorBruto` sem `valorLiquido`). Agora o líquido acompanha o
    bruto (recebível manual não tem taxa).

## Altos (sync central/edge)

11. **[corrigido] Cancelamento podia se perder no sync.** Se o evento `venda`
    falhasse num lote e o `venda_cancelada` chegasse antes da venda existir, o
    cancelamento era confirmado (ack) sem efeito — a central ficaria com a
    venda FINALIZADA para sempre. Agora o cancelamento sem venda lança erro e
    cai em `falhas`, sendo reenviado no próximo ciclo (`backend/src/sync/apply.js`).
12. **[corrigido] Corrida no fold de estoque.** `aplicarMovimento` lia o saldo
    e gravava o valor absoluto: duas transações concorrentes na mesma variação
    perdiam um movimento (saldo errado permanente, divergência central×edge).
    ENTRADA/SAÍDA agora aplicam delta com `increment` atômico; AJUSTE segue
    absoluto por definição (`backend/src/sync/estoque.js`).

## Médios (corrigidos)

13. **[corrigido] CORS totalmente aberto** (`cors()` sem origem). Como a auth é
    por header (não cookie), o risco prático é menor, mas agora há allowlist
    opcional via `CORS_ORIGINS` (compose atualizado); sem a variável, mantém o
    comportamento anterior para não quebrar dev.
14. **[corrigido] `.env.example` não existia** apesar de o README mandar
    `cp .env.example .env`. Criados `.env.example` e `.env.edge.example`.

## Recomendações (não aplicadas — exigem decisão de produto/arquitetura)

- **Cancelar venda em dinheiro não estorna o crédito na conta bancária**: os
  recebíveis `RECEBIDO` (dinheiro) não são tocados no cancelamento e o saldo
  creditado permanece. Definir a regra (estorno automático × lançamento manual).
- **Token JWT em `localStorage`** (admin e PDV): exposto a XSS. Migrar para
  cookie httpOnly exige mudar CORS/CSRF — planejar.
- **Senha do certificado A1 viaja em header HTTP** no canal central→edge
  (`/api/sync/certificado`). Hoje depende 100% de TLS no `CENTRAL_URL`;
  documentar https como obrigatório ou mover para corpo cifrado.
- ~~**`frontend/src/pages/Pdv/` é código morto**~~ — já removido no master
  (README atualizado no mesmo commit).
- **Numeração de venda `max+1`** pode colidir em vendas simultâneas na mesma
  loja (o unique `[lojaId, numero]` vira 409 para o cliente). Raro num PDV
  físico; se incomodar, usar sequence por loja ou retry.
- **Sem rate-limit no login** (`/api/auth/login`, `/api/auth/validar-gerente`)
  — força bruta possível; adicionar `express-rate-limit` na frente.
- **`GET /api/vendas/vendedores`** lista todos os usuários ativos para qualquer
  autenticado — considerar restringir aos papéis de venda.
- **Seed cria `admin@seixastec.local / admin123`** — trocar a senha no primeiro
  acesso em produção (o seed só roda em banco vazio, mas a credencial é pública
  no repositório).
- **Sem lint/CI.** Agora existe `npm test` no backend (node:test); um workflow
  de CI rodando testes + builds custaria pouco.

## Verificação executada

- `npm test` no backend: 7 testes de dinheiro/rateio passando.
- `npx prisma validate`: schema válido.
- `npm run build` no admin e no PDV: ok.
- Boot do backend sem banco: `/health` ok, 401 em rota protegida ok.
- CORS: sem `CORS_ORIGINS` → `*` (comportamento anterior); com allowlist →
  origem fora da lista não recebe `Access-Control-Allow-Origin`.
- Fail-fast do segredo: produção com placeholder aborta com mensagem clara;
  produção com segredo forte sobe; dev sem segredo sobe com aviso.
- Smoke com Postgres real não pôde rodar neste ambiente (sem daemon Docker);
  recomenda-se rodar o fluxo de venda/cancelamento num ambiente de dev antes
  do deploy.
