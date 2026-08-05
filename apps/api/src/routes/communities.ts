import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createCommunitySchema, updateCommunitySchema } from "@kampus/shared";
import { prisma } from "../db";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { serializeMiniUser } from "../lib/serialize";
import { notify } from "../lib/notify";
import { grantBadge } from "../lib/notify";
import { requireUser } from "../plugins/auth";
import {
  COMMUNITY_INCLUDE,
  assertCanJoin,
  assertCanView,
  joinCommunity,
  leaveCommunity,
  memberRole,
  serializeCommunity,
} from "../services/communities";
import { getOrCreateCommunityConversation } from "../services/chat";

const listQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  scope: z.enum(["DEPARTMENT", "UNIVERSITY", "GLOBAL", "ALL"]).default("ALL"),
  department: z.string().trim().max(80).optional(),
  universityId: z.string().cuid().optional(),
  /** mine = üye olduklarım, forme = bana uygun olanlar */
  filter: z.enum(["ALL", "MINE", "SUGGESTED"]).default("ALL"),
  sort: z.enum(["POPULAR", "NEW", "ACTIVE"]).default("POPULAR"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

async function findCommunityOr404(idOrSlug: string) {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: COMMUNITY_INCLUDE,
  });
  if (!community || community.isArchived) throw notFound("Topluluk bulunamadı");
  return community;
}

async function assertModerator(communityId: string, user: { id: string; role: string }) {
  if (user.role === "ADMIN") return "OWNER" as const;
  const role = await memberRole(communityId, user.id);
  if (role !== "OWNER" && role !== "MODERATOR") {
    throw forbidden("Bu işlem için topluluk yöneticisi olmalısınız");
  }
  return role;
}

export default async function communityRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ listeleme
  app.get("/", { preHandler: app.optionalAuth }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const user = request.user;

    const where: Record<string, unknown> = { isArchived: false };
    const and: Record<string, unknown>[] = [];

    // Kullanıcı sadece görebileceği toplulukları listeler:
    // global topluluklar + kendi üniversitesine ait olanlar.
    if (user?.role !== "ADMIN") {
      and.push({
        OR: [
          { scope: "GLOBAL" },
          ...(user?.universityId ? [{ universityId: user.universityId }] : []),
        ],
      });
      and.push({
        OR: [
          { visibility: "PUBLIC" },
          ...(user ? [{ members: { some: { userId: user.id } } }] : []),
        ],
      });
    }

    if (query.scope !== "ALL") and.push({ scope: query.scope });
    if (query.department) and.push({ department: query.department });
    if (query.universityId) and.push({ universityId: query.universityId });

    if (query.q) {
      and.push({
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
          { tags: { has: query.q.toLowerCase() } },
        ],
      });
    }

    if (query.filter === "MINE") {
      if (!user) throw forbidden("Giriş yapmalısınız");
      and.push({ members: { some: { userId: user.id } } });
    }

    if (query.filter === "SUGGESTED" && user) {
      and.push({ members: { none: { userId: user.id } } });
      and.push({
        OR: [
          { scope: "GLOBAL" },
          { scope: "UNIVERSITY", universityId: user.universityId },
          { scope: "DEPARTMENT", universityId: user.universityId, department: user.department },
        ],
      });
    }

    where.AND = and;

    const orderBy =
      query.sort === "NEW"
        ? { createdAt: "desc" as const }
        : query.sort === "ACTIVE"
          ? { postCount: "desc" as const }
          : { memberCount: "desc" as const };

    const [total, communities] = await Promise.all([
      prisma.community.count({ where }),
      prisma.community.findMany({
        where,
        include: {
          ...COMMUNITY_INCLUDE,
          ...(user ? { members: { where: { userId: user.id }, select: { role: true } } } : {}),
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: communities.map((c) =>
        serializeCommunity(c, {
          role: (c as { members?: { role: "OWNER" | "MODERATOR" | "MEMBER" }[] }).members?.[0]?.role ?? null,
        }),
      ),
      total,
      page: query.page,
      hasMore: query.page * query.limit < total,
    };
  });

  // ------------------------------------------------------------ tek topluluk
  app.get("/:idOrSlug", { preHandler: app.optionalAuth }, async (request) => {
    const { idOrSlug } = z.object({ idOrSlug: z.string() }).parse(request.params);
    const community = await findCommunityOr404(idOrSlug);
    const user = request.user;

    await assertCanView(community, user);

    const [role, pending, moderators] = await Promise.all([
      memberRole(community.id, user?.id ?? null),
      user
        ? prisma.communityJoinRequest.findUnique({
            where: { communityId_userId: { communityId: community.id, userId: user.id } },
            select: { status: true },
          })
        : null,
      prisma.communityMember.findMany({
        where: { communityId: community.id, role: { in: ["OWNER", "MODERATOR"] } },
        include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        take: 10,
      }),
    ]);

    return {
      community: serializeCommunity(community, {
        role,
        hasPendingRequest: pending?.status === "PENDING",
      }),
      moderators: moderators.map((m) => ({ ...serializeMiniUser(m.user), role: m.role })),
    };
  });

  // ------------------------------------------------------------ oluştur
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const body = createCommunitySchema.parse(request.body);

    const slugTaken = await prisma.community.findUnique({
      where: { slug: body.slug },
      select: { id: true },
    });
    if (slugTaken) throw conflict("Bu adres (slug) kullanılıyor", { slug: "Kullanılıyor" });

    // Kapsam kuralları
    if (body.scope !== "GLOBAL" && !user.universityId) {
      throw badRequest("Üniversiteniz belirli olmadığı için sadece genel topluluk kurabilirsiniz");
    }
    if (body.scope === "DEPARTMENT" && body.department !== user.department && user.role !== "ADMIN") {
      throw forbidden("Sadece kendi bölümünüz için bölüm topluluğu kurabilirsiniz");
    }

    // Kötüye kullanımı sınırla: 24 saatte en fazla 3 topluluk.
    const recent = await prisma.community.count({
      where: { createdById: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (recent >= 3) throw forbidden("Günde en fazla 3 topluluk kurabilirsiniz");

    const community = await prisma.community.create({
      data: {
        slug: body.slug,
        name: body.name,
        description: body.description,
        scope: body.scope,
        visibility: body.visibility,
        universityId: body.scope === "GLOBAL" ? null : user.universityId,
        department: body.scope === "DEPARTMENT" ? body.department : null,
        avatarUrl: body.avatarUrl ?? null,
        coverUrl: body.coverUrl ?? null,
        tags: body.tags ?? [],
        createdById: user.id,
        memberCount: 0,
      },
      include: COMMUNITY_INCLUDE,
    });

    await prisma.communityMember.create({
      data: { communityId: community.id, userId: user.id, role: "OWNER" },
    });
    await prisma.community.update({ where: { id: community.id }, data: { memberCount: 1 } });
    await getOrCreateCommunityConversation(community.id).catch(() => undefined);
    await grantBadge(user.id, "COMMUNITY_FOUNDER", "Kurucu");

    reply.code(201);
    return { community: serializeCommunity({ ...community, memberCount: 1 }, { role: "OWNER" }) };
  });

  // ------------------------------------------------------------ güncelle
  app.patch("/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateCommunitySchema.parse(request.body);

    const community = await findCommunityOr404(id);
    await assertModerator(community.id, user);

    const updated = await prisma.community.update({
      where: { id: community.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.coverUrl !== undefined ? { coverUrl: body.coverUrl } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.rules !== undefined ? { rules: body.rules } : {}),
      },
      include: COMMUNITY_INCLUDE,
    });

    return { community: serializeCommunity(updated, { role: await memberRole(id, user.id) }) };
  });

  // ------------------------------------------------------------ katıl
  app.post("/:id/join", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ message: z.string().max(300).optional() }).safeParse(request.body ?? {});

    const community = await findCommunityOr404(id);
    await assertCanJoin(community, user);

    const existing = await memberRole(community.id, user.id);
    if (existing) return { joined: true, role: existing };

    if (community.visibility === "PRIVATE") {
      const request_ = await prisma.communityJoinRequest.upsert({
        where: { communityId_userId: { communityId: community.id, userId: user.id } },
        update: { status: "PENDING", message: body.success ? body.data.message : undefined },
        create: {
          communityId: community.id,
          userId: user.id,
          message: body.success ? body.data.message : undefined,
        },
        select: { id: true },
      });

      const mods = await prisma.communityMember.findMany({
        where: { communityId: community.id, role: { in: ["OWNER", "MODERATOR"] } },
        select: { userId: true },
      });
      await Promise.all(
        mods.map((m) =>
          notify({
            userId: m.userId,
            type: "COMMUNITY_JOIN_REQUEST",
            actorId: user.id,
            text: `${user.displayName} "${community.name}" topluluğuna katılmak istiyor`,
            link: `/topluluk/${community.slug}/istekler`,
            entityId: request_.id,
          }),
        ),
      );

      return { joined: false, pending: true };
    }

    const member = await joinCommunity(community.id, user.id);
    return { joined: true, role: member.role };
  });

  // ------------------------------------------------------------ ayrıl
  app.delete("/:id/leave", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const community = await findCommunityOr404(id);
    await leaveCommunity(community.id, user.id);
    return { left: true };
  });

  // ------------------------------------------------------------ üyeler
  app.get("/:id/members", { preHandler: app.optionalAuth }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const query = z
      .object({
        q: z.string().trim().max(50).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(30),
      })
      .parse(request.query);

    const community = await findCommunityOr404(id);
    await assertCanView(community, request.user);

    const where = {
      communityId: community.id,
      ...(query.q
        ? {
            user: {
              OR: [
                { username: { contains: query.q, mode: "insensitive" as const } },
                { displayName: { contains: query.q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };

    const [total, members] = await Promise.all([
      prisma.communityMember.count({ where }),
      prisma.communityMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true, username: true, displayName: true, avatarUrl: true,
              department: true, classYear: true, karma: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: members.map((m) => ({
        ...serializeMiniUser(m.user),
        department: m.user.department,
        classYear: m.user.classYear,
        karma: m.user.karma,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      total,
      hasMore: query.page * query.limit < total,
    };
  });

  // ------------------------------------------------------------ rol değiştir
  app.patch("/:id/members/:userId", { preHandler: app.authenticate }, async (request) => {
    const actor = requireUser(request);
    const { id, userId } = z.object({ id: z.string(), userId: z.string() }).parse(request.params);
    const { role } = z
      .object({ role: z.enum(["OWNER", "MODERATOR", "MEMBER"]) })
      .parse(request.body);

    const community = await findCommunityOr404(id);
    const actorRole = await assertModerator(community.id, actor);

    // Kurucu atamasını yalnızca kurucu yapabilir.
    if (role === "OWNER" && actorRole !== "OWNER" && actor.role !== "ADMIN") {
      throw forbidden("Sadece kurucu, kurucu atayabilir");
    }

    const target = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
      select: { role: true },
    });
    if (!target) throw notFound("Kullanıcı bu topluluğun üyesi değil");
    if (target.role === "OWNER" && actorRole !== "OWNER" && actor.role !== "ADMIN") {
      throw forbidden("Kurucunun rolünü değiştiremezsiniz");
    }

    await prisma.communityMember.update({
      where: { communityId_userId: { communityId: community.id, userId } },
      data: { role },
    });

    await notify({
      userId,
      type: "SYSTEM",
      actorId: actor.id,
      text: `"${community.name}" topluluğundaki rolün güncellendi: ${
        { OWNER: "Kurucu", MODERATOR: "Moderatör", MEMBER: "Üye" }[role]
      }`,
      link: `/topluluk/${community.slug}`,
      entityId: community.id,
    });

    return { ok: true, role };
  });

  // ------------------------------------------------------------ üye çıkar
  app.delete("/:id/members/:userId", { preHandler: app.authenticate }, async (request) => {
    const actor = requireUser(request);
    const { id, userId } = z.object({ id: z.string(), userId: z.string() }).parse(request.params);

    const community = await findCommunityOr404(id);
    const actorRole = await assertModerator(community.id, actor);

    const target = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
      select: { role: true },
    });
    if (!target) throw notFound("Kullanıcı bu topluluğun üyesi değil");
    if (target.role === "OWNER") throw forbidden("Kurucu topluluktan çıkarılamaz");
    if (target.role === "MODERATOR" && actorRole !== "OWNER" && actor.role !== "ADMIN") {
      throw forbidden("Moderatörü sadece kurucu çıkarabilir");
    }

    await leaveCommunity(community.id, userId);
    return { ok: true };
  });

  // ------------------------------------------------------------ katılım istekleri
  app.get("/:id/join-requests", { preHandler: app.authenticate }, async (request) => {
    const actor = requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const community = await findCommunityOr404(id);
    await assertModerator(community.id, actor);

    const requests = await prisma.communityJoinRequest.findMany({
      where: { communityId: community.id, status: "PENDING" },
      include: {
        user: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            department: true, classYear: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return {
      items: requests.map((r) => ({
        id: r.id,
        user: { ...serializeMiniUser(r.user), department: r.user.department, classYear: r.user.classYear },
        message: r.message,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.post("/:id/join-requests/:requestId", { preHandler: app.authenticate }, async (request) => {
    const actor = requireUser(request);
    const { id, requestId } = z
      .object({ id: z.string(), requestId: z.string() })
      .parse(request.params);
    const { action } = z.object({ action: z.enum(["APPROVE", "REJECT"]) }).parse(request.body);

    const community = await findCommunityOr404(id);
    await assertModerator(community.id, actor);

    const joinRequest = await prisma.communityJoinRequest.findFirst({
      where: { id: requestId, communityId: community.id, status: "PENDING" },
    });
    if (!joinRequest) throw notFound("İstek bulunamadı");

    await prisma.communityJoinRequest.update({
      where: { id: requestId },
      data: { status: action === "APPROVE" ? "APPROVED" : "REJECTED", resolvedAt: new Date() },
    });

    if (action === "APPROVE") {
      await joinCommunity(community.id, joinRequest.userId);
      await notify({
        userId: joinRequest.userId,
        type: "COMMUNITY_JOIN_APPROVED",
        actorId: actor.id,
        text: `"${community.name}" topluluğuna katılım isteğin onaylandı 🎉`,
        link: `/topluluk/${community.slug}`,
        entityId: community.id,
      });
    }

    return { ok: true, action };
  });
}
