# SeixasTec — Gestão Total

ERP web para **varejo de roupas**, reimaginado a partir do ConnectPlug. Catálogo com
**grade (tamanho × cor)**, coleção/estação, controle de estoque, vendas, financeiro de
recebíveis e um **PDV (frente de caixa) como aplicativo separado**.

Roda **100% em Docker**, com **backup automático em nuvem**. Arquitetura **distribuída
offline-first**: o **admin/central** roda numa **VPS** (sempre acessível) e cada **loja**
roda um **servidor local (edge)** que atende os PDVs e **funciona mesmo sem internet**,
sincronizando com a central quando há conexão. Preparado para **multi-loja e múltiplos
PDVs**.

## Arquitetura (central + edge)

```
                 ┌───────────────────────────┐
   você ───────▶ │  CENTRAL (VPS)            │  admin :8080 · API :4000
                 │  catálogo/config (verdade)│◀────┐  fonte do catálogo
                 │  consolida vendas/estoque │     │  recebe vendas/estoque/caixa
                 └───────────────────────────┘     │
                            ▲ sync (pull catálogo / push vendas)
                            │ (quando há internet)
   LOJA ─────────┌──────────┴────────────────┐
   (offline OK)  │  EDGE (servidor local)    │  PDV :8090 · API :4001
                 │  Postgres local + worker  │◀── PDVs da loja (LAN)
                 └───────────────────────────┘
```

- **Central (VPS):** fonte de verdade do **catálogo/config**; serve o admin; recebe o sync
  dos edges e **consolida** vendas e estoque de todas as lojas.
- **Edge (loja):** Postgres local com réplica do catálogo; atende os PDVs pela rede local e
  **opera 100% offline**; um **worker** puxa catálogo/config e empurra vendas/estoque/caixa
  para a central quando há internet. Os PDVs continuam clientes finos — falam com o edge
  local, então **não dependem da internet para vender**.
- **Como funciona o sync:** IDs são UUID (sem colisão offline); a numeração de venda é **por
  loja**; o estoque é **por loja** (`EstoqueLocal`), derivado de um **log de movimentos**
  replicado e aplicado **idempotentemente** (cada movimento uma vez). Catálogo/config: a
  **central vence**. Vendas/caixa/estoque: **append-only** do edge para a central. Vendas
  offline ficam numa **outbox** e drenam ao reconectar.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Admin (gestão) | React + Vite + Tailwind + React Router + TanStack Query — porta **8080** |
| PDV (frente de caixa) | App React separado — porta **8090** |
| Backend | Node + Express + Prisma — API REST, auth **JWT** + **API Key** (`x-api-key`) — porta **4000** |
| Banco | PostgreSQL 16 |
| Backup | pg_dump agendado (cron) + upload em nuvem via rclone |

## Módulos

- **Dashboard** — faturamento dia/mês, ticket médio, série de vendas, top produtos, estoque baixo.
- **Produtos** — categorias, marcas e produtos com **grade** (variações por tamanho/cor, SKU e estoque próprios), **coleção/estação** e **foto do produto**.
- **Clientes** e **Fornecedores**.
- **Estoque** — movimentações (entrada/saída/ajuste) e alerta de mínimo.
- **Vendas** — histórico, detalhe e cancelamento (com devolução de estoque).
- **Adquirentes & Taxas** — operadoras de pagamento com taxa e prazo por forma e por nº de parcelas (crédito).
- **Recebíveis** — parcelas a receber geradas por cada pagamento (bruto → taxa → líquido → data prevista), com baixa manual.
- **Lojas & PDVs** — cadastro de lojas/localidades e terminais de PDV.
- **Configurações** — categorias, marcas e **API Keys** para integrações externas.
- **PDV** (app separado) — abertura/fechamento de caixa, sangria/suprimento, busca por nome/SKU/código de barras (com foto), **vitrine de produtos em estoque ordenada pelos últimos vendidos** (miniaturas com scroll infinito), carrinho, e pagamentos por **Dinheiro, Pix, Débito, Crédito, Depósito em Conta e Link de Pagamento** (com adquirente/parcelas e cálculo de taxa/líquido).

## Como rodar

Pré-requisito: Docker + Docker Compose. Há **três formas**:

### 1) Nó único (dev, tudo junto)

Um só backend serve admin + PDV (sem separação central/edge). Bom para desenvolver.

```bash
cp .env.example .env      # ajuste senhas e o segredo JWT
docker compose up -d --build
```

- **Admin:** http://localhost:8080 · **PDV:** http://localhost:8090 · **API:** http://localhost:4000

### 2) Central (na VPS)

```bash
cp .env.example .env      # ajuste POSTGRES_*, JWT_SECRET, CENTRAL_PUBLIC_URL, MATRIZ_EDGE_TOKEN
docker compose -p seixastec_central -f docker-compose.central.yml up -d --build
```

Ao subir, o log do backend imprime o `LOJA_ID` da **Matriz** e o `EDGE_SYNC_TOKEN` — anote-os
(ou veja em **Lojas & PDVs** no admin). A central **semeia** o catálogo.

- **Admin:** http://localhost:8080 · **API central:** http://localhost:4000

### 3) Edge (em cada loja)

Crie um `.env.edge` por loja com o `LOJA_ID`, o `EDGE_SYNC_TOKEN` e o `CENTRAL_URL` (domínio/IP
da VPS — idealmente **https**). Depois:

```bash
docker compose -p seixastec_edge -f docker-compose.edge.yml --env-file .env.edge up -d --build
```

- **PDV:** http://localhost:8090 · **API do edge:** http://localhost:4001

O edge **não semeia** — na primeira vez (com internet) ele **puxa** todo o catálogo, usuários e
saldos da central. Aponte o `VITE_API_URL`/`EDGE_PUBLIC_URL` do PDV para o **IP do servidor da
loja na LAN** (ex.: `http://192.168.0.10:4001`).

**Login inicial (seed):** `admin@seixastec.local` / `admin123`

> **Provisionar uma nova loja:** cadastre a Loja no admin → em **Lojas & PDVs**, gere o **token
> de sync** (aparece uma única vez) → configure `LOJA_ID` (id da loja) e `EDGE_SYNC_TOKEN` no
> `.env.edge` daquela loja → suba o edge com internet para o primeiro sync.
>
> Reiniciar do zero (dev): `docker compose down -v && docker compose up -d --build`.

## Acesso externo via API

Gere uma chave em **Configurações → API Keys** e use no header:

```bash
curl http://localhost:4000/api/produtos -H "x-api-key: SUA_CHAVE"
```

## Backup em nuvem

O serviço `backup` faz `pg_dump` no horário de `BACKUP_CRON` (padrão 03:00), guarda cópia
local e envia para a nuvem via **rclone** (configure `backup/rclone.conf` com um remote
`cloud` e ajuste `RCLONE_REMOTE`). Backup imediato:

```bash
docker exec cp_varejo_backup /usr/local/bin/backup.sh
```

Restaurar:
```bash
gunzip -c backup/<arquivo>.sql.gz | docker exec -i cp_varejo_db psql -U cpvarejo -d cpvarejo
```

## Estrutura

```
.
├── docker-compose.yml
├── backend/     # API Node/Express/Prisma (schema em prisma/schema.prisma)
├── frontend/    # Admin (gestão)
├── pdv/         # App de PDV (separado)
└── backup/      # backup pg_dump + rclone
```

## Roadmap

- **Fiscal (próxima fase):** emissão de **NFC-e (65)** e **NF-e (55)** com integração
  **direta na SEFAZ** (requer certificado A1 + CSC). O schema já reserva os campos fiscais
  (NCM no produto, CNPJ/IE na loja).
- Multi-loja completo (estoque por localidade), PDV mobile (Android/iOS), múltiplos caixas.
