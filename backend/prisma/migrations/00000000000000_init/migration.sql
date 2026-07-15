-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GERENTE', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'DEPOSITO', 'LINK');

-- CreateEnum
CREATE TYPE "StatusRecebivel" AS ENUM ('PENDENTE', 'RECEBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('ABERTA', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovimentoCaixa" AS ENUM ('SUPRIMENTO', 'SANGRIA');

-- CreateEnum
CREATE TYPE "StatusNotaFiscal" AS ENUM ('PENDENTE', 'ENVIADA', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'INUTILIZADA', 'ERRO');

-- CreateTable
CREATE TABLE "Loja" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "ie" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "matriz" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "crt" INTEGER,
    "inscricaoMunicipal" TEXT,
    "codigoMunicipioIbge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PDVTerminal" (
    "id" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "identificador" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PDVTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VENDEDOR',
    "lojaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "chaveHash" TEXT NOT NULL,
    "usuarioId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoUso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaTamanho" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tamanhos" TEXT[],
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalaTamanho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoFiscal" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "origemMercadoria" TEXT NOT NULL DEFAULT '0',
    "csosn" TEXT NOT NULL DEFAULT '102',
    "cfop" TEXT NOT NULL DEFAULT '5102',
    "ncmPadrao" TEXT,
    "cest" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "serieNfce" INTEGER NOT NULL DEFAULT 1,
    "serieNfe" INTEGER NOT NULL DEFAULT 1,
    "idCsc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "referencia" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoriaId" TEXT,
    "marcaId" TEXT,
    "fornecedorPadraoId" TEXT,
    "escalaId" TEXT,
    "genero" TEXT,
    "fotoUrl" TEXT,
    "colecao" TEXT,
    "estacao" TEXT,
    "ncm" TEXT,
    "cest" TEXT,
    "origemMercadoria" TEXT,
    "csosn" TEXT,
    "cfop" TEXT,
    "precoCusto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precoVenda" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variacao" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tamanho" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "precoVenda" DECIMAL(12,2),
    "estoqueAtual" INTEGER NOT NULL DEFAULT 0,
    "estoqueMinimo" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstoqueLocal" (
    "id" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "variacaoId" TEXT NOT NULL,
    "estoqueAtual" INTEGER NOT NULL DEFAULT 0,
    "estoqueMinimo" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueLocal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "limiteCredito" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" TEXT NOT NULL,
    "variacaoId" TEXT NOT NULL,
    "lojaId" TEXT,
    "tipo" "TipoMovimentacao" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "custoUnit" DECIMAL(12,2),
    "motivo" TEXT,
    "fornecedorId" TEXT,
    "vendaId" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adquirente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adquirente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxaAdquirente" (
    "id" TEXT NOT NULL,
    "adquirenteId" TEXT NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "taxaPercentual" DECIMAL(6,3) NOT NULL,
    "taxaFixa" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "prazoRecebimentoDias" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxaAdquirente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebivel" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "adquirenteId" TEXT,
    "parcelaNumero" INTEGER NOT NULL DEFAULT 1,
    "totalParcelas" INTEGER NOT NULL DEFAULT 1,
    "valorBruto" DECIMAL(12,2) NOT NULL,
    "taxaValor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(12,2) NOT NULL,
    "dataPrevista" TIMESTAMP(3) NOT NULL,
    "status" "StatusRecebivel" NOT NULL DEFAULT 'PENDENTE',
    "recebidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recebivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "clienteId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "caixaId" TEXT,
    "lojaId" TEXT,
    "pdvTerminalId" TEXT,
    "status" "StatusVenda" NOT NULL DEFAULT 'ABERTA',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "acrescimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendaItem" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "variacaoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnit" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "VendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "adquirenteId" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "taxaPercentual" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "taxaValor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "prazoRecebimentoDias" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caixa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "lojaId" TEXT,
    "pdvTerminalId" TEXT,
    "aberturaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechamentoEm" TIMESTAMP(3),
    "valorAbertura" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorFechamento" DECIMAL(12,2),
    "observacao" TEXT,
    "aberto" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Caixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoCaixa" (
    "id" TEXT NOT NULL,
    "caixaId" TEXT NOT NULL,
    "tipo" "TipoMovimentoCaixa" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "entidade" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("entidade")
);

-- CreateTable
CREATE TABLE "EdgeNode" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "versao" TEXT,
    "ultimoPush" TIMESTAMP(3),
    "ultimoPull" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdgeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "lojaId" TEXT NOT NULL,
    "vendaId" TEXT,
    "dadosManual" JSONB,
    "ambiente" TEXT NOT NULL,
    "status" "StatusNotaFiscal" NOT NULL DEFAULT 'PENDENTE',
    "chaveAcesso" TEXT,
    "protocolo" TEXT,
    "xmlAssinado" TEXT,
    "xmlRetorno" TEXT,
    "motivoRejeicao" TEXT,
    "qrCodeUrl" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorizadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Loja_cnpj_key" ON "Loja"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "PDVTerminal_identificador_key" ON "PDVTerminal"("identificador");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_chaveHash_key" ON "ApiKey"("chaveHash");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaTamanho_nome_key" ON "EscalaTamanho"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Cor_nome_key" ON "Cor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Marca_nome_key" ON "Marca"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_referencia_key" ON "Produto"("referencia");

-- CreateIndex
CREATE INDEX "Produto_nome_idx" ON "Produto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Variacao_sku_key" ON "Variacao"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Variacao_codigoBarras_key" ON "Variacao"("codigoBarras");

-- CreateIndex
CREATE INDEX "Variacao_codigoBarras_idx" ON "Variacao"("codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "Variacao_produtoId_tamanho_cor_key" ON "Variacao"("produtoId", "tamanho", "cor");

-- CreateIndex
CREATE INDEX "EstoqueLocal_variacaoId_idx" ON "EstoqueLocal"("variacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "EstoqueLocal_lojaId_variacaoId_key" ON "EstoqueLocal"("lojaId", "variacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cpfCnpj_key" ON "Cliente"("cpfCnpj");

-- CreateIndex
CREATE INDEX "Cliente_nome_idx" ON "Cliente"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_cpfCnpj_key" ON "Fornecedor"("cpfCnpj");

-- CreateIndex
CREATE INDEX "Fornecedor_nome_idx" ON "Fornecedor"("nome");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_variacaoId_idx" ON "MovimentacaoEstoque"("variacaoId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_createdAt_idx" ON "MovimentacaoEstoque"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxaAdquirente_adquirenteId_forma_parcelas_key" ON "TaxaAdquirente"("adquirenteId", "forma", "parcelas");

-- CreateIndex
CREATE INDEX "Recebivel_status_idx" ON "Recebivel"("status");

-- CreateIndex
CREATE INDEX "Recebivel_dataPrevista_idx" ON "Recebivel"("dataPrevista");

-- CreateIndex
CREATE INDEX "Venda_createdAt_idx" ON "Venda"("createdAt");

-- CreateIndex
CREATE INDEX "Venda_status_idx" ON "Venda"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_lojaId_numero_key" ON "Venda"("lojaId", "numero");

-- CreateIndex
CREATE INDEX "OutboxEvent_syncedAt_idx" ON "OutboxEvent"("syncedAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_createdAt_idx" ON "OutboxEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EdgeNode_tokenHash_key" ON "EdgeNode"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_chaveAcesso_key" ON "NotaFiscal"("chaveAcesso");

-- CreateIndex
CREATE INDEX "NotaFiscal_status_idx" ON "NotaFiscal"("status");

-- CreateIndex
CREATE INDEX "NotaFiscal_vendaId_idx" ON "NotaFiscal"("vendaId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_lojaId_modelo_serie_numero_key" ON "NotaFiscal"("lojaId", "modelo", "serie", "numero");

-- AddForeignKey
ALTER TABLE "PDVTerminal" ADD CONSTRAINT "PDVTerminal_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_fornecedorPadraoId_fkey" FOREIGN KEY ("fornecedorPadraoId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "EscalaTamanho"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variacao" ADD CONSTRAINT "Variacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueLocal" ADD CONSTRAINT "EstoqueLocal_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueLocal" ADD CONSTRAINT "EstoqueLocal_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "Variacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "Variacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxaAdquirente" ADD CONSTRAINT "TaxaAdquirente_adquirenteId_fkey" FOREIGN KEY ("adquirenteId") REFERENCES "Adquirente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebivel" ADD CONSTRAINT "Recebivel_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebivel" ADD CONSTRAINT "Recebivel_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebivel" ADD CONSTRAINT "Recebivel_adquirenteId_fkey" FOREIGN KEY ("adquirenteId") REFERENCES "Adquirente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "Caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_pdvTerminalId_fkey" FOREIGN KEY ("pdvTerminalId") REFERENCES "PDVTerminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaItem" ADD CONSTRAINT "VendaItem_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaItem" ADD CONSTRAINT "VendaItem_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "Variacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_adquirenteId_fkey" FOREIGN KEY ("adquirenteId") REFERENCES "Adquirente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_pdvTerminalId_fkey" FOREIGN KEY ("pdvTerminalId") REFERENCES "PDVTerminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoCaixa" ADD CONSTRAINT "MovimentoCaixa_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "Caixa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

