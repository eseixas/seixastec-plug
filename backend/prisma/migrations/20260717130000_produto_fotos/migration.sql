-- CreateTable
CREATE TABLE "ProdutoFoto" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoFoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProdutoFoto_produtoId_ordem_idx" ON "ProdutoFoto"("produtoId", "ordem");

-- AddForeignKey
ALTER TABLE "ProdutoFoto" ADD CONSTRAINT "ProdutoFoto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: espelha a foto principal existente (Produto.fotoUrl) em ProdutoFoto ordem 0.
INSERT INTO "ProdutoFoto" (id, "produtoId", url, ordem, "createdAt", "updatedAt")
SELECT gen_random_uuid(), id, "fotoUrl", 0, now(), now() FROM "Produto" WHERE "fotoUrl" IS NOT NULL;
