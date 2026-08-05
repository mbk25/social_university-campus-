import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { updateProfileSchema } from "@kampus/shared";
import { prisma } from "../db";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { grantBadge, notify } from "../lib/notify";
import { serializeMiniUser, serializeUser } from "../lib/serialize";
import { requireUser } from "../plugins/auth";
import { autoJoinDefaultCommunities } from "../services/communities";
import { isUserOnline } from "../realtime/io";

const USER_SELECT = {
  id: true, username: true, displayName: true, avatarUrl: true, coverUrl: true,
  bio: true, department: true, classYear: true, karma: true, showDepartment: true,
  isPrivate: true, verifiedAt: true, createdAt: true, lastSeenAt: true, status: true,
  university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
  badges: { select: { code: true } },
} as const;

export default async function userRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ profil
  app.get("/:username", { preHandler: app.optionalAuth }, async (request) => {
    const { username } = z.object({ username: z.string() }).parse(request.params);
    const viewer = request.user;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: USER_SELECT,
    });
    if (!user || user.status === "DEACTIVATED") throw notFound("Kullanıcı bulunamadı");

    const [posts, followers, following, communities, relation, blocked] = await Promise.all([
      prisma.post.count({ where: { authorId: user.id, deletedAt: null, isAnonymous: false } }),
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.communityMember.count({ where: { userId: user.id } }),
      viewer
        ? prisma.follow.findMany({
            where: {
              OR: [
                { followerId: viewer.id, followingId: user.id },
                { followerId: user.id, followingId: viewer.id },
              ],
            },
            select: { followerId: true, followingId: true },
          })
        : [],
      viewer
        ? prisma.block.findFirst({
            where: { blockerId: viewer.id, blockedId: user.id },
            select: { blockerId: true },
          })
        : null,
    ]);

    const isFollowing = relation.some((r) => r.followerId === viewer?.id);
    const isFollowedBy = relation.some((r) => r.followingId === viewer?.id);

    const topCommunities = await prisma.communityMember.findMany({
      where: { communityId: { not: undefined }, userId: user.id },
      include: { community: { select: { id: true, slug: true, name: true, avatarUrl: true } } },
      orderBy: { joinedAt: "desc" },
      take: 6,
    });

    return {
      user: serializeUser(
        user,
        { isFollowing, isFollowedBy, isBlocked: !!blocked, viewerId: viewer?.id ?? null },
        { posts, followers, following, communities },
      ),
      isPrivate: user.isPrivate,
      online: await isUserOnline(user.id),
      lastSeenAt: user.lastSeenAt.toISOString(),
      communities: topCommunities.map((m) => m.community),
    };
  });

  // ------------------------------------------------------------ profil güncelle
  app.patch("/me", { preHandler: app.authenticate }, async (request) => {
    const auth = requireUser(request);
    const body = updateProfileSchema.parse(request.body);

    const before = await prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
      select: { department: true },
    });

    const user = await prisma.user.update({
      where: { id: auth.id },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.department !== undefined ? { department: body.department } : {}),
        ...(body.classYear !== undefined ? { classYear: body.classYear } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl } : {}),
        ...(body.interests !== undefined ? { interests: body.interests } : {}),
        ...(body.isPrivate !== undefined ? { isPrivate: body.isPrivate } : {}),
        ...(body.showDepartment !== undefined ? { showDepartment: body.showDepartment } : {}),
      },
      select: USER_SELECT,
    });

    // Bölüm değiştiyse yeni bölüm topluluğuna otomatik katıl.
    if (body.department && body.department !== before.department) {
      await autoJoinDefaultCommunities(auth.id).catch(() => undefined);
    }

    return { user: serializeUser(user, { viewerId: auth.id }) };
  });

  // ------------------------------------------------------------ takip
  app.post("/:username/follow", { preHandler: app.authenticate }, async (request) => {
    const viewer = requireUser(request);
    const { username } = z.object({ username: z.string() }).parse(request.params);

    const target = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, displayName: true, status: true },
    });
    if (!target || target.status !== "ACTIVE") throw notFound("Kullanıcı bulunamadı");
    if (target.id === viewer.id) throw badRequest("Kendinizi takip edemezsiniz");

    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewer.id, blockedId: target.id },
          { blockerId: target.id, blockedId: viewer.id },
        ],
      },
      select: { blockerId: true },
    });
    if (blocked) throw forbidden("Bu kullanıcıyı takip edemezsiniz");

    const created = await prisma.follow.createMany({
      data: [{ followerId: viewer.id, followingId: target.id }],
      skipDuplicates: true,
    });

    if (created.count > 0) {
      await notify({
        userId: target.id,
        type: "FOLLOW",
        actorId: viewer.id,
        text: `${viewer.displayName} seni takip etmeye başladı`,
        link: `/u/${viewer.username}`,
        entityId: viewer.id,
      });

      const followerCount = await prisma.follow.count({ where: { followingId: target.id } });
      if (followerCount >= 100) await grantBadge(target.id, "SOCIAL_BUTTERFLY", "Sosyal Kelebek");
    }

    const followers = await prisma.follow.count({ where: { followingId: target.id } });
    return { following: true, followers };
  });

  app.delete("/:username/follow", { preHandler: app.authenticate }, async (request) => {
    const viewer = requireUser(request);
    const { username } = z.object({ username: z.string() }).parse(request.params);

    const target = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw notFound("Kullanıcı bulunamadı");

    await prisma.follow.deleteMany({ where: { followerId: viewer.id, followingId: target.id } });
    const followers = await prisma.follow.count({ where: { followingId: target.id } });
    return { following: false, followers };
  });

  // ------------------------------------------------------------ takipçi listeleri
  app.get("/:username/followers", { preHandler: app.optionalAuth }, async (request) => {
    const { username } = z.object({ username: z.string() }).parse(request.params);
    const { page, limit } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(30),
      })
      .parse(request.query);

    const target = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw notFound("Kullanıcı bulunamadı");

    const [total, follows] = await Promise.all([
      prisma.follow.count({ where: { followingId: target.id } }),
      prisma.follow.findMany({
        where: { followingId: target.id },
        include: { follower: { select: USER_SELECT } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: follows.map((f) => serializeUser(f.follower)),
      total,
      hasMore: page * limit < total,
    };
  });

  app.get("/:username/following", { preHandler: app.optionalAuth }, async (request) => {
    const { username } = z.object({ username: z.string() }).parse(request.params);
    const { page, limit } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(30),
      })
      .parse(request.query);

    const target = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw notFound("Kullanıcı bulunamadı");

    const [total, follows] = await Promise.all([
      prisma.follow.count({ where: { followerId: target.id } }),
      prisma.follow.findMany({
        where: { followerId: target.id },
        include: { following: { select: USER_SELECT } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: follows.map((f) => serializeUser(f.following)),
      total,
      hasMore: page * limit < total,
    };
  });

  // ------------------------------------------------------------ öneriler
  app.get("/me/suggestions", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);

    const [following, blocked] = await Promise.all([
      prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
      prisma.block.findMany({
        where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
        select: { blockerId: true, blockedId: true },
      }),
    ]);

    const excluded = new Set<string>([user.id, ...following.map((f) => f.followingId)]);
    for (const b of blocked) {
      excluded.add(b.blockerId);
      excluded.add(b.blockedId);
    }

    // Aynı bölüm > aynı üniversite > yüksek karma sırasıyla
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excluded) },
        status: "ACTIVE",
        isPrivate: false,
        ...(user.universityId ? { universityId: user.universityId } : {}),
      },
      select: USER_SELECT,
      orderBy: [{ karma: "desc" }, { createdAt: "desc" }],
      take: 20,
    });

    const sorted = candidates.sort((a, b) => {
      const aMatch = a.department === user.department ? 1 : 0;
      const bMatch = b.department === user.department ? 1 : 0;
      return bMatch - aMatch;
    });

    return { items: sorted.slice(0, 8).map((u) => serializeUser(u)) };
  });

  // ------------------------------------------------------------ engelleme
  app.post("/:username/block", { preHandler: app.authenticate }, async (request) => {
    const viewer = requireUser(request);
    const { username } = z.object({ username: z.string() }).parse(request.params);

    const target = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw notFound("Kullanıcı bulunamadı");
    if (target.id === viewer.id) throw badRequest("Kendinizi engelleyemezsiniz");

    await prisma.block.createMany({
      data: [{ blockerId: viewer.id, blockedId: target.id }],
      skipDuplicates: true,
    });
    // Engelleme karşılıklı takibi de keser.
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: viewer.id, followingId: target.id },
          { followerId: target.id, followingId: viewer.id },
        ],
      },
    });

    return { blocked: true };
  });

  app.delete("/:username/block", { preHandler: app.authenticate }, async (request) => {
    const viewer = requireUser(request);
    const { username } = z.object({ username: z.string() }).parse(request.params);
    const target = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw notFound("Kullanıcı bulunamadı");

    await prisma.block.deleteMany({ where: { blockerId: viewer.id, blockedId: target.id } });
    return { blocked: false };
  });

  app.get("/me/blocked", { preHandler: app.authenticate }, async (request) => {
    const viewer = requireUser(request);
    const blocks = await prisma.block.findMany({
      where: { blockerId: viewer.id },
      include: {
        blocked: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { items: blocks.map((b) => serializeMiniUser(b.blocked)) };
  });

  // ------------------------------------------------------------ hesabı kapat
  app.post("/me/deactivate", { preHandler: app.authenticate }, async (request) => {
    const viewer = requireUser(request);
    await prisma.user.update({
      where: { id: viewer.id },
      data: { status: "DEACTIVATED" },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: viewer.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true, message: "Hesabınız kapatıldı. Tekrar giriş yaparsanız yeniden açılır." };
  });

  // ------------------------------------------------------------ push jetonu (mobil)
  app.post("/me/push-token", { preHandler: app.authenticate }, async (request) => {
    const viewer = requireUser(request);
    const { token } = z.object({ token: z.string().max(255).nullable() }).parse(request.body);
    await prisma.user.update({ where: { id: viewer.id }, data: { pushToken: token } });
    return { ok: true };
  });
}
