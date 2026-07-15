#!/bin/sh
set -e

# Sincroniza o schema com o banco (edge e central usam a mesma imagem).
npx prisma db push --skip-generate

# Só a CENTRAL semeia catálogo/usuários. O EDGE começa vazio e puxa tudo da
# central via sync (worker), para não divergir os UUIDs. Sem NODE_ROLE definido,
# assume o comportamento antigo (nó único = central) e semeia.
if [ "$NODE_ROLE" = "edge" ]; then
  echo "NODE_ROLE=edge — pulando seed (o catálogo vem da central por sync)."
else
  node prisma/seed.js
fi

exec node src/server.js
