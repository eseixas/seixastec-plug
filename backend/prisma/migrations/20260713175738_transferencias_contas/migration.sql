-- CreateTable
CREATE TABLE "TransferenciaContas" (
    "id" TEXT NOT NULL,
    "contaOrigemId" TEXT NOT NULL,
    "contaDestinoId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferenciaContas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferenciaContas_contaOrigemId_idx" ON "TransferenciaContas"("contaOrigemId");

-- CreateIndex
CREATE INDEX "TransferenciaContas_contaDestinoId_idx" ON "TransferenciaContas"("contaDestinoId");

-- AddForeignKey
ALTER TABLE "TransferenciaContas" ADD CONSTRAINT "TransferenciaContas_contaOrigemId_fkey" FOREIGN KEY ("contaOrigemId") REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaContas" ADD CONSTRAINT "TransferenciaContas_contaDestinoId_fkey" FOREIGN KEY ("contaDestinoId") REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
