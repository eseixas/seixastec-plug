-- CreateEnum
CREATE TYPE "OrigemConciliacao" AS ENUM ('MANUAL', 'IMPORTADA');

-- CreateEnum
CREATE TYPE "FormatoExtrato" AS ENUM ('OFX', 'CSV');

-- CreateEnum
CREATE TYPE "StatusLancamentoExtrato" AS ENUM ('PENDENTE', 'CONCILIADO', 'IGNORADO');

-- AlterTable
ALTER TABLE "ContaPagar" ADD COLUMN     "conciliado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataConciliacao" TIMESTAMP(3),
ADD COLUMN     "origemConciliacao" "OrigemConciliacao";

-- AlterTable
ALTER TABLE "Recebivel" ADD COLUMN     "conciliado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dataConciliacao" TIMESTAMP(3),
ADD COLUMN     "origemConciliacao" "OrigemConciliacao";

-- CreateTable
CREATE TABLE "ImportacaoExtrato" (
    "id" TEXT NOT NULL,
    "contaBancariaId" TEXT NOT NULL,
    "formato" "FormatoExtrato" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "usuarioId" TEXT,
    "totalLinhas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoExtrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LancamentoExtrato" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT,
    "fitId" TEXT,
    "recebivelId" TEXT,
    "contaPagarId" TEXT,
    "status" "StatusLancamentoExtrato" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LancamentoExtrato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportacaoExtrato_contaBancariaId_idx" ON "ImportacaoExtrato"("contaBancariaId");

-- CreateIndex
CREATE INDEX "ImportacaoExtrato_createdAt_idx" ON "ImportacaoExtrato"("createdAt");

-- CreateIndex
CREATE INDEX "LancamentoExtrato_importacaoId_idx" ON "LancamentoExtrato"("importacaoId");

-- CreateIndex
CREATE INDEX "LancamentoExtrato_status_idx" ON "LancamentoExtrato"("status");

-- CreateIndex
CREATE INDEX "ContaPagar_conciliado_idx" ON "ContaPagar"("conciliado");

-- CreateIndex
CREATE INDEX "Recebivel_conciliado_idx" ON "Recebivel"("conciliado");

-- AddForeignKey
ALTER TABLE "ImportacaoExtrato" ADD CONSTRAINT "ImportacaoExtrato_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoExtrato" ADD CONSTRAINT "ImportacaoExtrato_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoExtrato" ADD CONSTRAINT "LancamentoExtrato_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "ImportacaoExtrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoExtrato" ADD CONSTRAINT "LancamentoExtrato_recebivelId_fkey" FOREIGN KEY ("recebivelId") REFERENCES "Recebivel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoExtrato" ADD CONSTRAINT "LancamentoExtrato_contaPagarId_fkey" FOREIGN KEY ("contaPagarId") REFERENCES "ContaPagar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
