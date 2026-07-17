-- CreateTable
CREATE TABLE "ConfiguracaoPdv" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "exigirGerenteCancelamento" BOOLEAN NOT NULL DEFAULT false,
    "exigirGerenteDesconto" BOOLEAN NOT NULL DEFAULT false,
    "descontoHabilitado" BOOLEAN NOT NULL DEFAULT true,
    "descontoMaximoPercentual" DECIMAL(5,2),
    "bloquearVendaSemEstoque" BOOLEAN NOT NULL DEFAULT false,
    "exigirAprovacaoFechamento" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoPdv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoCliente" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "camposObrigatoriosPF" TEXT[],
    "camposObrigatoriosPJ" TEXT[],
    "aplicarNoPdv" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoCliente_pkey" PRIMARY KEY ("id")
);

