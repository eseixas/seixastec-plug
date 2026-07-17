-- CreateTable
CREATE TABLE "ModeloEtiqueta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "folhaLargura" DECIMAL(6,2) NOT NULL,
    "folhaAltura" DECIMAL(6,2) NOT NULL,
    "margemEsquerda" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "margemTopo" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "colunas" INTEGER NOT NULL DEFAULT 1,
    "espacamentoColunas" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "linhasFolha" INTEGER NOT NULL DEFAULT 1,
    "espacamentoLinhas" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "etiquetaLargura" DECIMAL(6,2) NOT NULL,
    "etiquetaAltura" DECIMAL(6,2) NOT NULL,
    "espacoSuperior" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "espacoInferior" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "espacoEsquerda" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "espacoDireita" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "linhasConteudo" JSONB NOT NULL,
    "fonteTipo" TEXT NOT NULL DEFAULT 'Helvetica',
    "fonteTamanho" INTEGER NOT NULL DEFAULT 8,
    "alinhamento" TEXT NOT NULL DEFAULT 'C',
    "imagemLeituraTipo" TEXT NOT NULL DEFAULT 'NENHUMA',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloEtiqueta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModeloEtiqueta_codigo_key" ON "ModeloEtiqueta"("codigo");

