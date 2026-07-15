-- CreateEnum
CREATE TYPE "MotivoMovimentacao" AS ENUM ('AJUSTE', 'DEVOLUCAO', 'COMPRA', 'ESTOQUE_INICIAL', 'PRODUCAO', 'CONSUMO_INTERNO', 'PERDA', 'REPOSICAO', 'VENDA', 'TRANSFERENCIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusCompraItem" AS ENUM ('AGUARDANDO', 'ENTREGUE', 'CANCELADO', 'EXTRAVIADO');

-- AlterTable
ALTER TABLE "ContaPagar" ADD COLUMN     "compraId" TEXT;

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "categoria" "MotivoMovimentacao",
ADD COLUMN     "transferenciaId" TEXT;

-- CreateTable
CREATE TABLE "TransferenciaEstoque" (
    "id" TEXT NOT NULL,
    "lojaOrigemId" TEXT NOT NULL,
    "lojaDestinoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferenciaEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "numeroNota" TEXT,
    "serie" TEXT,
    "dataCompra" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,
    "anexoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraItem" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "variacaoId" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "custoUnitario" DECIMAL(12,2) NOT NULL,
    "valorVenda" DECIMAL(12,2),
    "status" "StatusCompraItem" NOT NULL DEFAULT 'AGUARDANDO',
    "previsaoChegada" TIMESTAMP(3),
    "movimentacaoId" TEXT,

    CONSTRAINT "CompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompraItem_movimentacaoId_key" ON "CompraItem"("movimentacaoId");

-- CreateIndex
CREATE INDEX "CompraItem_compraId_idx" ON "CompraItem"("compraId");

-- CreateIndex
CREATE INDEX "ContaPagar_compraId_idx" ON "ContaPagar"("compraId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_transferenciaId_idx" ON "MovimentacaoEstoque"("transferenciaId");

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "TransferenciaEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaEstoque" ADD CONSTRAINT "TransferenciaEstoque_lojaOrigemId_fkey" FOREIGN KEY ("lojaOrigemId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaEstoque" ADD CONSTRAINT "TransferenciaEstoque_lojaDestinoId_fkey" FOREIGN KEY ("lojaDestinoId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaEstoque" ADD CONSTRAINT "TransferenciaEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES "Variacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "MovimentacaoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

