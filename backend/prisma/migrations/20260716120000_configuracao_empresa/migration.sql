-- CreateTable
CREATE TABLE "ConfiguracaoEmpresa" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "logoUrl" TEXT,
    "certificadoArquivo" TEXT,
    "certificadoNome" TEXT,
    "certificadoSenha" TEXT,
    "certificadoValidade" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoEmpresa_pkey" PRIMARY KEY ("id")
);

