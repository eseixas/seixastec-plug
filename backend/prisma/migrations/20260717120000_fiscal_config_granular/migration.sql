-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "grupoTributacaoId" TEXT;

-- CreateTable
CREATE TABLE "GrupoTributacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "origemMercadoria" TEXT NOT NULL DEFAULT '0',
    "csosn" TEXT NOT NULL DEFAULT '102',
    "cfop" TEXT NOT NULL DEFAULT '5102',
    "ncm" TEXT,
    "cest" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoTributacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerieNotaFiscal" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "descricao" TEXT,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerieNotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NaturezaOperacao" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "cfop" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NaturezaOperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrupoTributacao_nome_key" ON "GrupoTributacao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "SerieNotaFiscal_modelo_serie_key" ON "SerieNotaFiscal"("modelo", "serie");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_grupoTributacaoId_fkey" FOREIGN KEY ("grupoTributacaoId") REFERENCES "GrupoTributacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

