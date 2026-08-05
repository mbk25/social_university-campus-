import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "../db";
import { forbidden, unauthorized } from "../lib/errors";
import { verifyAccessToken } from "../lib/tokens";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "STUDENT" | "MODERATOR" | "ADMIN";
  status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  universityId: string | null;
  department: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
  interface FastifyInstance {
    /** Oturum zorunlu. */
    authenticate: (request: FastifyRequest) => Promise<void>;
    /** Oturum varsa doldurur, yoksa sessizce geçer. */
    optionalAuth: (request: FastifyRequest) => Promise<void>;
    /** Sadece moderatör/yönetici. */
    requireStaff: (request: FastifyRequest) => Promise<void>;
  }
}

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function loadUser(token: string): Promise<AuthUser> {
  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      status: true,
      universityId: true,
      department: true,
      suspendedUntil: true,
    },
  });

  if (!user) throw unauthorized("Hesap bulunamadı");

  if (user.status === "SUSPENDED") {
    const until = user.suspendedUntil;
    if (!until || until > new Date()) {
      throw forbidden(
        until
          ? `Hesabınız ${until.toLocaleDateString("tr-TR")} tarihine kadar askıya alındı`
          : "Hesabınız askıya alındı",
      );
    }
    // Askı süresi dolmuş -> hesabı geri aç
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", suspendedUntil: null, suspendReason: null },
    });
    user.status = "ACTIVE";
  }

  if (user.status === "DEACTIVATED") throw forbidden("Hesabınız kapatılmış");
  if (user.status === "PENDING_VERIFICATION") throw forbidden("E-posta adresinizi doğrulamanız gerekiyor");

  const { suspendedUntil, ...rest } = user;
  void suspendedUntil;
  return rest as AuthUser;
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", null);

  app.decorate("authenticate", async (request: FastifyRequest) => {
    const token = bearer(request);
    if (!token) throw unauthorized();
    request.user = await loadUser(token);
  });

  app.decorate("optionalAuth", async (request: FastifyRequest) => {
    const token = bearer(request);
    if (!token) {
      request.user = null;
      return;
    }
    try {
      request.user = await loadUser(token);
    } catch {
      request.user = null;
    }
  });

  app.decorate("requireStaff", async (request: FastifyRequest) => {
    const token = bearer(request);
    if (!token) throw unauthorized();
    const user = await loadUser(token);
    if (user.role !== "ADMIN" && user.role !== "MODERATOR") throw forbidden();
    request.user = user;
  });

  // Son görülme bilgisini en fazla 5 dakikada bir güncelle.
  const lastSeenCache = new Map<string, number>();
  app.addHook("onResponse", async (request) => {
    const user = request.user;
    if (!user) return;
    const now = Date.now();
    const previous = lastSeenCache.get(user.id) ?? 0;
    if (now - previous < 5 * 60_000) return;
    lastSeenCache.set(user.id, now);
    prisma.user
      .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  });
});

/** Rotalarda kısayol: her zaman dolu kullanıcı döner. */
export function requireUser(request: FastifyRequest): AuthUser {
  if (!request.user) throw unauthorized();
  return request.user;
}
