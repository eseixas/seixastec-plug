FROM node:20-slim

# Prisma precisa de openssl/libssl para o schema engine.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências primeiro (cache de camada)
COPY package.json ./
RUN npm install

# Copia o restante
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

EXPOSE 4000

# Startup consciente do papel (central semeia; edge só puxa da central).
RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
