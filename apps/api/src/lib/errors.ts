import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { isDev } from "../env";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg: string, fields?: Record<string, string>) =>
  new AppError(400, "BAD_REQUEST", msg, fields);
export const unauthorized = (msg = "Giriş yapmanız gerekiyor") =>
  new AppError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "Bu işlem için yetkiniz yok") =>
  new AppError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Kayıt bulunamadı") =>
  new AppError(404, "NOT_FOUND", msg);
export const conflict = (msg: string, fields?: Record<string, string>) =>
  new AppError(409, "CONFLICT", msg, fields);
export const tooMany = (msg = "Çok fazla istek gönderdiniz, lütfen bekleyin") =>
  new AppError(429, "TOO_MANY_REQUESTS", msg);

function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, fields: error.fields },
      });
    }

    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Gönderilen bilgiler geçersiz",
          fields: zodFields(error),
        },
      });
    }

    // @fastify/rate-limit
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({
        error: { code: "TOO_MANY_REQUESTS", message: "Çok fazla istek gönderdiniz, biraz bekleyin" },
      });
    }

    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.code(413).send({
        error: { code: "FILE_TOO_LARGE", message: "Dosya boyutu çok büyük" },
      });
    }

    // Prisma benzersizlik ihlali
    if ((error as { code?: string }).code === "P2002") {
      return reply.code(409).send({
        error: { code: "CONFLICT", message: "Bu kayıt zaten mevcut" },
      });
    }

    // Veritabanına ulaşılamıyor — kullanıcıya ham Prisma çıktısı gösterme.
    const prismaCode = (error as { code?: string }).code;
    if (prismaCode && ["P1000", "P1001", "P1002", "P1008", "P1017"].includes(prismaCode)) {
      request.log.error({ err: error }, "Veritabanına ulaşılamıyor");
      return reply.code(503).send({
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: isDev
            ? "Veritabanına bağlanılamıyor. PostgreSQL çalışıyor mu? (.env → DATABASE_URL)"
            : "Servise şu anda ulaşılamıyor, lütfen birazdan tekrar deneyin.",
        },
      });
    }

    request.log.error({ err: error }, "İşlenmemiş hata");
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: isDev ? (error as Error).message : "Beklenmeyen bir hata oluştu",
      },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Böyle bir uç nokta yok" } });
  });
}
