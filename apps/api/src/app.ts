import fs from "node:fs";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { corsOrigins, env, isDev } from "./env";
import { registerErrorHandler } from "./lib/errors";
import { getFile, usesObjectStorage } from "./lib/storage";
import authPlugin from "./plugins/auth";

import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import commentRoutes from "./routes/comments";
import communityRoutes from "./routes/communities";
import confessionRoutes from "./routes/confessions";
import eventRoutes from "./routes/events";
import feedRoutes from "./routes/feed";
import metaRoutes from "./routes/meta";
import moderationRoutes from "./routes/moderation";
import noteRoutes from "./routes/notes";
import notificationRoutes from "./routes/notifications";
import postRoutes from "./routes/posts";
import searchRoutes from "./routes/search";
import uploadRoutes from "./routes/upload";
import userRoutes from "./routes/users";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isDev
      ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
      : true,
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  await app.register(cors, {
    origin(origin, callback) {
      // Mobil uygulama (Expo) origin göndermez.
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      if (isDev && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error("CORS: bu kaynağa izin verilmiyor"), false);
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const auth = request.headers.authorization;
      return auth ? `t:${auth.slice(-32)}` : `ip:${request.ip}`;
    },
  });

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
      files: 1,
      fields: 5,
    },
    attachFieldsToBody: false,
  });

  // Yüklenen dosyalar
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: env.UPLOAD_DIR,
    prefix: "/uploads/",
    decorateReply: false,
    cacheControl: true,
    maxAge: "7d",
  });

  // Nesne depolamadaki dosyaları sunucu üzerinden servis eder.
  //
  // Cloudflare R2'nin `r2.dev` alan adı Türkiye'deki ağlarda engellendiği için
  // tarayıcı dosyalara doğrudan ulaşamıyor — sunucu ulaşabiliyor. Bu rota
  // aradaki köprü. Bucket'a özel alan adı bağlandığında `S3_PUBLIC_URL` o
  // adrese çevrilir ve burası kendiliğinden devre dışı kalır.
  if (usesObjectStorage) {
    app.get<{ Params: { "*": string } }>("/media/*", {
      // Görseller hız sınırının dışında: kampüs ağlarında yüzlerce öğrenci tek
      // bir genel IP'nin arkasında olur ve ortak kotayı dakikada tüketirlerdi.
      // İçerik değişmez ve kalıcı önbelleklendiği için kötüye kullanım riski düşük.
      config: { rateLimit: false },
    }, async (request, reply) => {
      const key = request.params["*"];
      if (!key || key.includes("..")) return reply.code(400).send({ error: "Geçersiz yol" });

      const file = await getFile(key);
      if (!file) return reply.code(404).send({ error: "Dosya bulunamadı" });

      // Dosya adları benzersiz (nanoid), bu yüzden kalıcı önbellek güvenli.
      reply
        .header("content-type", file.contentType ?? "application/octet-stream")
        .header("cache-control", file.cacheControl ?? "public, max-age=31536000, immutable");
      if (file.contentLength !== undefined) reply.header("content-length", file.contentLength);
      if (file.etag) reply.header("etag", file.etag);

      return reply.send(file.body);
    });
  }

  await app.register(authPlugin);
  registerErrorHandler(app);

  app.get("/health", async () => ({
    ok: true,
    service: "kampus-api",
    time: new Date().toISOString(),
  }));

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(userRoutes, { prefix: "/users" });
      await api.register(communityRoutes, { prefix: "/communities" });
      await api.register(postRoutes, { prefix: "/posts" });
      await api.register(commentRoutes, { prefix: "/comments" });
      await api.register(feedRoutes, { prefix: "/feed" });
      await api.register(chatRoutes, { prefix: "/chat" });
      await api.register(notificationRoutes, { prefix: "/notifications" });
      await api.register(eventRoutes, { prefix: "/events" });
      await api.register(noteRoutes, { prefix: "/notes" });
      await api.register(confessionRoutes, { prefix: "/confessions" });
      await api.register(searchRoutes, { prefix: "/search" });
      await api.register(uploadRoutes, { prefix: "/upload" });
      await api.register(metaRoutes, { prefix: "/meta" });
      await api.register(moderationRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
