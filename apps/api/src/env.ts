import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Kök dizindeki .env dosyasını (ve varsa apps/api/.env) yükle
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4100),
  DATABASE_URL: z.string().min(1, "DATABASE_URL tanımlı değil"),

  API_PUBLIC_URL: z.string().url().default("http://localhost:4100"),
  WEB_PUBLIC_URL: z.string().url().default("http://localhost:3100"),
  /** Virgülle ayrılmış ek CORS kaynakları */
  EXTRA_CORS_ORIGINS: z.string().default(""),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET en az 32 karakter olmalı"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET en az 32 karakter olmalı"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Brevo HTTP API anahtarı. Doluysa mailler SMTP yerine HTTPS üzerinden
   * gönderilir — Railway gibi barındırma sağlayıcıları giden SMTP portlarını
   * (25/465/587/2525) kapatıyor, 443 ise her yerde açık.
   */
  BREVO_API_KEY: z.string().default(""),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  // z.coerce.boolean() kullanılamaz: Boolean("false") === true olduğu için
  // SMTP_SECURE="false" yazan herkes sessizce TLS'e zorlanırdı.
  SMTP_SECURE: z
    .enum(["true", "false", "1", "0", ""])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  MAIL_FROM: z.string().default("Kampus <noreply@kampus.app>"),

  ALLOWED_DOMAIN_MODE: z.enum(["strict", "edu"]).default("strict"),

  UPLOAD_DIR: z.string().default(path.resolve(__dirname, "../uploads")),
  MAX_UPLOAD_MB: z.coerce.number().int().default(25),

  // --- Nesne depolama (boş bırakılırsa yerel disk kullanılır) ---
  S3_BUCKET: z.string().default(""),
  S3_REGION: z.string().default("auto"),
  /** R2/B2 gibi S3 uyumlu servisler için; AWS S3'te boş bırakın. */
  S3_ENDPOINT: z.string().default(""),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  /** Dosyaların herkese açık adres öneki, örn. https://cdn.kampus.app */
  S3_PUBLIC_URL: z.string().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`\n❌ Ortam değişkenleri hatalı:\n${issues}\n\n.env.example dosyasını .env olarak kopyalayın.\n`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";

export const corsOrigins = [
  env.WEB_PUBLIC_URL,
  ...env.EXTRA_CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
];
