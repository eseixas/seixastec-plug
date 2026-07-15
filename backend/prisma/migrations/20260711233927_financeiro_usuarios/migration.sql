-- CreateEnum
CREATE TYPE "TipoContaBancaria" AS ENUM ('DINHEIRO', 'CONTA_CORRENTE', 'CONTA_POUPANCA', 'CARTEIRA_DIGITAL');

-- CreateEnum
CREATE TYPE "GrupoDRE" AS ENUM ('RECEITA_OPERACIONAL', 'DEDUCAO_RECEITA', 'CUSTO_OPERACIONAL', 'DESPESA_OPERACIONAL', 'DESPESA_FINANCEIRA', 'OUTRAS_RECEITAS', 'OUTRAS_DESPESAS');

-- CreateEnum
CREATE TYPE "TipoCategoriaFinanceira" AS ENUM ('RECEITA', 'DESPESA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'FINANCEIRO';
ALTER TYPE "UserRole" ADD VALUE 'CAIXA';

-- DropForeignKey
ALTER TABLE "Recebivel" DROP CONSTRAINT "Recebivel_vendaId_fkey";

-- AlterTable
ALTER TABLE "Recebivel" ADD COLUMN     "categoriaId" TEXT,
ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "contaBancariaId" TEXT,
ADD COLUMN     "descricao" TEXT,
ALTER COLUMN "pagamentoId" DROP NOT NULL,
ALTER COLUMN "vendaId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ContaBancaria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoContaBancaria" NOT NULL DEFAULT 'CONTA_CORRENTE',
    "banco" TEXT,
    "agencia" TEXT,
    "numeroConta" TEXT,
    "saldoInicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaFinanceira" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo" "GrupoDRE" NOT NULL,
    "tipo" "TipoCategoriaFinanceira" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaPagar" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "contaBancariaId" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "juros" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorPago" DECIMAL(12,2),
    "vencimento" TIMESTAMP(3) NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "anexoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaPagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContaBancaria_nome_idx" ON "ContaBancaria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaFinanceira_nome_grupo_key" ON "CategoriaFinanceira"("nome", "grupo");

-- CreateIndex
CREATE INDEX "ContaPagar_vencimento_idx" ON "ContaPagar"("vencimento");

-- CreateIndex
CREATE INDEX "ContaPagar_pago_idx" ON "ContaPagar"("pago");

-- AddForeignKey
ALTER TABLE "Recebivel" ADD CONSTRAINT "Recebivel_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebivel" ADD CONSTRAINT "Recebivel_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebivel" ADD CONSTRAINT "Recebivel_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebivel" ADD CONSTRAINT "Recebivel_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

