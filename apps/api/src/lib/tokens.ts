import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../env";
import { prisma } from "../db";
import { unauthorized } from "./errors";

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: string;
  uni: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: "kampus",
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "kampus" }) as AccessTokenPayload;
  } catch {
    throw unauthorized("Oturum süresi doldu, lütfen tekrar giriş yapın");
  }
}

export function accessTokenTtlSeconds(): number {
  const raw = env.ACCESS_TOKEN_TTL;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 900;
  const n = Number(match[1]);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as "s" | "m" | "h" | "d"];
  return n * mult;
}

const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export async function issueRefreshToken(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<string> {
  const raw = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400_000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash(raw),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 200),
      ip: meta.ip,
    },
  });

  return `${userId}.${raw}`;
}

/** Refresh token'ı doğrular ve tek kullanımlık olarak yenisiyle değiştirir (rotation). */
export async function rotateRefreshToken(
  presented: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ userId: string; refreshToken: string }> {
  const [userId, raw] = presented.split(".");
  if (!userId || !raw) throw unauthorized("Geçersiz oturum anahtarı");

  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!record || record.userId !== userId) throw unauthorized("Geçersiz oturum anahtarı");

  if (record.revokedAt) {
    // Kullanılmış bir token tekrar sunuldu -> muhtemel sızıntı, tüm oturumları kapat.
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized("Oturum güvenlik nedeniyle sonlandırıldı, tekrar giriş yapın");
  }

  if (record.expiresAt < new Date()) throw unauthorized("Oturum süresi doldu");

  await prisma.refreshToken.update({
    where: { tokenHash: record.tokenHash },
    data: { revokedAt: new Date() },
  });

  const refreshToken = await issueRefreshToken(userId, meta);
  return { userId, refreshToken };
}

export async function revokeRefreshToken(presented: string): Promise<void> {
  const [, raw] = presented.split(".");
  if (!raw) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------- doğrulama kodu

export function generateVerificationCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export const hashCode = (code: string) => hash(code);

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
