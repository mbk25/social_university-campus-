# Kampus API — Fastify + Prisma + Socket.IO
# Depo kökünden derleyin:  docker build -f apps/api/Dockerfile -t kampus-api .

# ---------------------------------------------------------------- bağımlılıklar
FROM node:22-slim AS deps
WORKDIR /app

# Prisma ve sharp'ın ihtiyaç duyduğu sistem kütüphaneleri
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Önce yalnızca manifest dosyalarını kopyala — kaynak değişince katman
# önbelleği bozulmasın, kurulum tekrar çalışmasın.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN npm install --omit=dev --no-audit --no-fund

# ------------------------------------------------------------------- derleme
FROM deps AS build
WORKDIR /app

# Derleme için geliştirme bağımlılıkları da gerekli (typescript, prisma CLI)
RUN npm install --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build -w @kampus/shared \
    && npx prisma generate --schema apps/api/prisma/schema.prisma \
    && npm run build -w @kampus/api

# ------------------------------------------------------------------- çalışma
FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Sadece çalışması için gerekenleri taşı
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Nesne depolama yapılandırılmamışsa dosyalar buraya yazılır.
RUN mkdir -p /app/apps/api/uploads

EXPOSE 4100

# Açılışta bekleyen migration'ları uygula, sonra sunucuyu başlat.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/server.js"]
