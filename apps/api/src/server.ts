import { buildApp } from "./app";
import { disconnectDb, prisma } from "./db";
import { env } from "./env";
import { assertStorageConfigured, usesObjectStorage } from "./lib/storage";
import { setupSocket } from "./realtime/socket";

async function main() {
  // Yanlış yapılandırmayı ilk yüklemede değil, açılışta yakala.
  assertStorageConfigured();

  const app = await buildApp();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  // Fastify'ın HTTP sunucusunu Socket.IO ile paylaş.
  setupSocket(app.server);

  app.log.info(`🚀 Kampus API  http://localhost:${env.PORT}`);
  app.log.info(`   REST      http://localhost:${env.PORT}/api/v1`);
  app.log.info(`   Realtime  ws://localhost:${env.PORT}/socket.io`);
  app.log.info(`   Depolama  ${usesObjectStorage ? "nesne depolama (S3/R2)" : "yerel disk"}`);

  // Süresi dolmuş doğrulama kodlarını ve token'ları saatlik temizle.
  const cleanup = setInterval(
    () => {
      const now = new Date();
      prisma.verificationCode
        .deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } })
        .catch(() => undefined);
      prisma.refreshToken
        .deleteMany({ where: { expiresAt: { lt: now } } })
        .catch(() => undefined);
    },
    60 * 60_000,
  );
  cleanup.unref();

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} alındı, kapatılıyor...`);
    clearInterval(cleanup);
    await app.close();
    await disconnectDb();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Sunucu başlatılamadı:", err);
  process.exit(1);
});
