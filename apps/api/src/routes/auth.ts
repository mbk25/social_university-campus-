import argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import {
  addEducationCompleteSchema,
  addEducationStartSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerCompleteSchema,
  registerStartSchema,
  resendCodeSchema,
  resetPasswordSchema,
  resetPasswordSchema as _reset,
  usernameSchema,
} from "@kampus/shared";
import { z } from "zod";
import { prisma } from "../db";
import { badRequest, conflict, notFound, tooMany, unauthorized } from "../lib/errors";
import { sendPasswordResetCode, sendVerificationCode, sendWelcome } from "../lib/mailer";
import { serializeUser } from "../lib/serialize";
import {
  accessTokenTtlSeconds,
  generateVerificationCode,
  hashCode,
  issueRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  safeCompare,
  signAccessToken,
} from "../lib/tokens";
import { grantBadge } from "../lib/notify";
import { requireUser } from "../plugins/auth";
import { previewUniversityForEmail, resolveUniversityForEmail } from "../services/universityResolver";
import { autoJoinDefaultCommunities } from "../services/communities";

void _reset;

const CODE_TTL_MS = 10 * 60_000;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

const argonOptions: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

async function issueCode(email: string, purpose: "REGISTER" | "PASSWORD_RESET" | "ADD_EDUCATION") {
  const recent = await prisma.verificationCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000);
    throw tooMany(`Yeni kod istemek için ${wait} saniye bekleyin`);
  }

  // Aynı amaç için bekleyen eski kodları geçersiz kıl.
  await prisma.verificationCode.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateVerificationCode();
  await prisma.verificationCode.create({
    data: {
      email,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  return code;
}

/**
 * Kodu doğrular ama tüketmez — kayıt formunun 2. adımında anında geri bildirim
 * verebilmek için. Hatalı denemede sayaç yine artar.
 */
async function assertCodeValid(email: string, code: string, purpose: "REGISTER" | "PASSWORD_RESET" | "ADD_EDUCATION") {
  const record = await prisma.verificationCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) throw badRequest("Doğrulama kodu bulunamadı, yeni kod isteyin", { code: "Kod geçersiz" });
  if (record.expiresAt < new Date()) throw badRequest("Kodun süresi doldu, yeni kod isteyin", { code: "Süre doldu" });
  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    throw tooMany("Çok fazla hatalı deneme yaptınız, yeni kod isteyin");
  }

  if (!safeCompare(record.codeHash, hashCode(code))) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const left = MAX_CODE_ATTEMPTS - record.attempts - 1;
    throw badRequest(
      left > 0
        ? `Kod hatalı. ${left} deneme hakkınız kaldı. En son gönderilen kodu kullandığınızdan emin olun.`
        : "Kod hatalı, yeni kod isteyin",
      { code: "Kod hatalı" },
    );
  }

  return record;
}

async function consumeCode(email: string, code: string, purpose: "REGISTER" | "PASSWORD_RESET" | "ADD_EDUCATION") {
  const record = await assertCodeValid(email, code, purpose);
  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
}

export default async function authRoutes(app: FastifyInstance) {
  // ------------------------------------------------ e-posta ön kontrolü
  app.post("/check-email", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request) => {
    const { email } = registerStartSchema.parse(request.body);
    const preview = await previewUniversityForEmail(email);
    const taken = preview.allowed
      ? !!(await prisma.user.findUnique({ where: { email }, select: { id: true } }))
      : false;
    return { ...preview, taken };
  });

  // ------------------------------------------------ kullanıcı adı müsaitlik
  app.get("/username-available", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request) => {
    const { username } = z.object({ username: z.string() }).parse(request.query);
    const parsed = usernameSchema.safeParse(username.toLowerCase());
    if (!parsed.success) {
      return { available: false, reason: parsed.error.issues[0]?.message ?? "Geçersiz" };
    }
    const existing = await prisma.user.findUnique({
      where: { username: parsed.data },
      select: { id: true },
    });
    return { available: !existing, reason: existing ? "Bu kullanıcı adı alınmış" : null };
  });

  // ------------------------------------------------ kayıt: kod gönder
  app.post("/register/start", {
    config: { rateLimit: { max: 5, timeWindow: "10 minutes" } },
  }, async (request) => {
    const { email } = registerStartSchema.parse(request.body);

    const resolved = await resolveUniversityForEmail(email);

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw conflict("Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.", { email: "Kayıtlı adres" });

    const code = await issueCode(email, "REGISTER");
    await sendVerificationCode(email, code);

    return {
      sent: true,
      email,
      university: resolved.university,
      expiresInSeconds: CODE_TTL_MS / 1000,
    };
  });

  // ------------------------------------------------ kodu anında doğrula
  // Kullanıcı profil bilgilerini doldurmadan önce kodun doğruluğunu öğrensin.
  app.post("/register/verify-code", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } },
  }, async (request) => {
    const { email, code } = z
      .object({ email: emailSchema, code: z.string().regex(/^\d{6}$/, "Kod 6 haneli olmalı") })
      .parse(request.body);

    const record = await assertCodeValid(email, code, "REGISTER");
    return {
      valid: true,
      expiresInSeconds: Math.max(0, Math.floor((record.expiresAt.getTime() - Date.now()) / 1000)),
    };
  });

  app.post("/register/resend", {
    config: { rateLimit: { max: 5, timeWindow: "10 minutes" } },
  }, async (request) => {
    const { email } = resendCodeSchema.parse(request.body);
    await resolveUniversityForEmail(email);
    const code = await issueCode(email, "REGISTER");
    await sendVerificationCode(email, code);
    return { sent: true };
  });

  // ---------------------------------------- ek eğitim: kod gönder / doğrula
  app.post("/education/start", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 5, timeWindow: "10 minutes" } },
  }, async (request) => {
    const auth = requireUser(request);
    const { email } = addEducationStartSchema.parse(request.body);
    const resolved = await resolveUniversityForEmail(email);
    const [primary, existing] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.userEducation.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (primary || existing) {
      const ownPrimary = primary?.id === auth.id;
      throw conflict(
        ownPrimary ? "Bu e-posta zaten ana eğitimin olarak kayıtlı" : "Bu e-posta başka bir hesapta kullanılıyor",
        { email: "Kullanımdaki adres" },
      );
    }
    const code = await issueCode(email, "ADD_EDUCATION");
    await sendVerificationCode(email, code);
    return {
      sent: true,
      email,
      university: resolved.university,
      needsUniversitySelection: resolved.needsSelection,
      expiresInSeconds: CODE_TTL_MS / 1000,
    };
  });

  app.post("/education/complete", {
    preHandler: app.authenticate,
    config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
  }, async (request) => {
    const auth = requireUser(request);
    const body = addEducationCompleteSchema.parse(request.body);
    const resolved = await resolveUniversityForEmail(body.email);
    let universityId = resolved.university?.id ?? null;
    if (resolved.needsSelection) {
      if (!body.universityId) throw badRequest("Üniversiteni seçmelisin", { universityId: "Üniversite seçilmedi" });
      const picked = await prisma.university.findFirst({
        where: { id: body.universityId, isActive: true }, select: { id: true },
      });
      if (!picked) throw badRequest("Geçersiz üniversite seçimi", { universityId: "Bulunamadı" });
      universityId = picked.id;
    }
    if (!universityId) throw badRequest("Üniversite bulunamadı");

    const [primary, existing] = await Promise.all([
      prisma.user.findUnique({ where: { email: body.email }, select: { id: true } }),
      prisma.userEducation.findUnique({ where: { email: body.email }, select: { id: true } }),
    ]);
    if (primary || existing) throw conflict("Bu e-posta zaten kullanılıyor", { email: "Kullanımdaki adres" });

    await consumeCode(body.email, body.code, "ADD_EDUCATION");
    const education = await prisma.userEducation.create({
      data: {
        userId: auth.id, universityId, email: body.email, emailDomain: resolved.domain,
        department: body.department, classYear: body.classYear,
        isStudentAddress: resolved.isStudentAddress,
      },
      include: { university: true },
    });
    await autoJoinDefaultCommunities(auth.id, education.universityId, education.department);
    return { education: { ...education, university: education.university } };
  });

  // ------------------------------------------------ kayıt: tamamla
  app.post("/register/complete", {
    config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
  }, async (request) => {
    const body = registerCompleteSchema.parse(request.body);
    const resolved = await resolveUniversityForEmail(body.email);

    // Alan adı tanınmadıysa üniversiteyi kullanıcı seçer; istemciye
    // güvenmeyip kaydın gerçekten var ve aktif olduğunu burada doğruluyoruz.
    let universityId = resolved.university?.id ?? null;
    if (resolved.needsSelection) {
      if (!body.universityId) {
        throw badRequest("Üniversiteni seçmelisin", { universityId: "Üniversite seçilmedi" });
      }
      const picked = await prisma.university.findFirst({
        where: { id: body.universityId, isActive: true },
        select: { id: true },
      });
      if (!picked) throw badRequest("Geçersiz üniversite seçimi", { universityId: "Bulunamadı" });
      universityId = picked.id;
    }

    const [emailTaken, usernameTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email: body.email }, select: { id: true } }),
      prisma.user.findUnique({ where: { username: body.username }, select: { id: true } }),
    ]);
    if (emailTaken) throw conflict("Bu e-posta ile zaten bir hesap var", { email: "Kayıtlı adres" });
    if (usernameTaken) throw conflict("Bu kullanıcı adı alınmış", { username: "Kullanılıyor" });

    await consumeCode(body.email, body.code, "REGISTER");

    const passwordHash = await argon2.hash(body.password, argonOptions);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        emailDomain: resolved.domain,
        passwordHash,
        username: body.username,
        displayName: body.displayName,
        universityId,
        department: body.department,
        classYear: body.classYear,
        isStudentAddress: resolved.isStudentAddress,
        status: "ACTIVE",
        verifiedAt: new Date(),
      },
      include: {
        university: true,
        badges: { select: { code: true } },
      },
    });

    await grantBadge(user.id, "VERIFIED_STUDENT", "Doğrulanmış Öğrenci");
    const totalUsers = await prisma.user.count();
    if (totalUsers <= 1000) await grantBadge(user.id, "EARLY_ADOPTER", "Öncü");

    // Üniversite ve bölüm topluluklarına otomatik üye yap.
    await autoJoinDefaultCommunities(user.id).catch(() => undefined);

    await sendWelcome(user.email, user.displayName, user.university?.name ?? null);

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      uni: user.universityId,
    });
    const refreshToken = await issueRefreshToken(user.id, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    const fresh = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { university: true, badges: { select: { code: true } }, educations: { include: { university: true } } },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenTtlSeconds(),
      user: serializeUser(fresh),
    };
  });

  // ------------------------------------------------ giriş
  app.post("/login", {
    config: { rateLimit: { max: 10, timeWindow: "5 minutes" } },
  }, async (request) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { university: true, badges: { select: { code: true } }, educations: { include: { university: true } } },
    });

    // Kullanıcı yoksa da argon2 çalıştırıp zamanlama farkını kapatıyoruz.
    const hash = user?.passwordHash ?? "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000";
    let valid = false;
    try {
      valid = await argon2.verify(hash, body.password);
    } catch {
      valid = false;
    }

    if (!user || !valid) throw unauthorized("E-posta veya şifre hatalı");

    if (user.status === "DEACTIVATED") {
      // Kapatılmış hesap girişte yeniden etkinleşir.
      await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
      user.status = "ACTIVE";
    }
    if (user.status === "SUSPENDED" && (!user.suspendedUntil || user.suspendedUntil > new Date())) {
      throw unauthorized(user.suspendReason ?? "Hesabınız askıya alınmış");
    }

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      uni: user.universityId,
    });
    const refreshToken = await issueRefreshToken(user.id, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenTtlSeconds(),
      user: serializeUser(user),
    };
  });

  // ------------------------------------------------ token yenile
  app.post("/refresh", async (request) => {
    const { refreshToken: presented } = refreshSchema.parse(request.body);
    const { userId, refreshToken } = await rotateRefreshToken(presented, {
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { university: true, badges: { select: { code: true } }, educations: { include: { university: true } } },
    });
    if (!user || user.status === "SUSPENDED") throw unauthorized("Oturum geçersiz");

    return {
      accessToken: signAccessToken({
        sub: user.id,
        username: user.username,
        role: user.role,
        uni: user.universityId,
      }),
      refreshToken,
      expiresIn: accessTokenTtlSeconds(),
      user: serializeUser(user),
    };
  });

  // ------------------------------------------------ çıkış
  app.post("/logout", async (request) => {
    const parsed = z.object({ refreshToken: z.string().optional() }).safeParse(request.body);
    if (parsed.success && parsed.data.refreshToken) {
      await revokeRefreshToken(parsed.data.refreshToken);
    }
    return { ok: true };
  });

  app.post("/logout-all", { preHandler: app.authenticate }, async (request) => {
    await revokeAllRefreshTokens(requireUser(request).id);
    return { ok: true };
  });

  // ------------------------------------------------ şifre sıfırlama
  app.post("/forgot-password", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  }, async (request) => {
    const { email } = forgotPasswordSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    // Hesabın var olup olmadığını sızdırmamak için yanıt her durumda aynı.
    if (user) {
      const code = await issueCode(email, "PASSWORD_RESET").catch(() => null);
      if (code) await sendPasswordResetCode(email, code);
    }

    return { sent: true, message: "Adres kayıtlıysa sıfırlama kodu gönderildi" };
  });

  app.post("/reset-password", {
    config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
  }, async (request) => {
    const body = resetPasswordSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (!user) throw notFound("Hesap bulunamadı");

    await consumeCode(body.email, body.code, "PASSWORD_RESET");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(body.password, argonOptions) },
    });

    // Şifre değişince tüm oturumlar kapanır.
    await revokeAllRefreshTokens(user.id);

    return { ok: true, message: "Şifreniz güncellendi, tekrar giriş yapabilirsiniz" };
  });

  // ------------------------------------------------ oturum sahibi
  app.get("/me", { preHandler: app.authenticate }, async (request) => {
    const auth = requireUser(request);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
      include: { university: true, badges: { select: { code: true } }, educations: { include: { university: true } } },
    });

    const [posts, followers, following, communities, unreadNotifications] = await Promise.all([
      prisma.post.count({ where: { authorId: user.id, deletedAt: null } }),
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.communityMember.count({ where: { userId: user.id } }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

    return {
      user: serializeUser(user, { viewerId: user.id }, { posts, followers, following, communities }),
      email: user.email,
      unreadNotifications,
    };
  });

  app.post("/change-password", { preHandler: app.authenticate }, async (request) => {
    const auth = requireUser(request);
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).regex(/[0-9]/, "Şifre en az bir rakam içermeli"),
      })
      .parse(request.body);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
      select: { passwordHash: true },
    });

    if (!(await argon2.verify(user.passwordHash, body.currentPassword))) {
      throw badRequest("Mevcut şifreniz hatalı", { currentPassword: "Hatalı şifre" });
    }

    await prisma.user.update({
      where: { id: auth.id },
      data: { passwordHash: await argon2.hash(body.newPassword, argonOptions) },
    });
    await revokeAllRefreshTokens(auth.id);

    return { ok: true };
  });
}
