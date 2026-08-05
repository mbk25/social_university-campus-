import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createConfessionSchema, generateAnonymousAlias } from "@kampus/shared";
import { prisma } from "../db";
import { forbidden, notFound } from "../lib/errors";
import { decodeCursor, encodeCursor, serializeUniversity } from "../lib/serialize";
import { requireUser } from "../plugins/auth";

const idParam = z.object({ id: z.string().min(1) });

/**
 * Anonim itiraflar. `authorId` yalnızca moderasyon için saklanır ve
 * hiçbir yanıt gövdesinde dışarı verilmez — serializer bunu garanti eder.
 */
type ConfessionRow = {
  id: string;
  content: string;
  alias: string;
  topic: string | null;
  scope: "UNIVERSITY" | "GLOBAL";
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  authorId: string;
  university: {
    id: string; name: string; shortName: string; city: string;
    type: "STATE" | "FOUNDATION" | "OTHER";
  } | null;
  likes?: { userId: string }[];
};

function serializeConfession(confession: ConfessionRow, viewerId: string | null) {
  return {
    id: confession.id,
    content: confession.content,
    alias: confession.alias,
    topic: confession.topic,
    scope: confession.scope,
    university: serializeUniversity(confession.university),
    likeCount: confession.likeCount,
    commentCount: confession.commentCount,
    createdAt: confession.createdAt.toISOString(),
    viewer: {
      hasLiked: (confession.likes?.length ?? 0) > 0,
      // Kullanıcı kendi itirafını silebilsin diye sadece "benim mi" bilgisi döner.
      isMine: viewerId !== null && confession.authorId === viewerId,
    },
  };
}

export default async function confessionRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ listeleme
  app.get("/", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const query = z
      .object({
        scope: z.enum(["UNIVERSITY", "GLOBAL", "MINE"]).default("UNIVERSITY"),
        topic: z.string().trim().max(30).optional(),
        sort: z.enum(["NEW", "TOP"]).default("NEW"),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(30).default(20),
      })
      .parse(request.query);

    const cursor = decodeCursor(query.cursor);
    const and: Prisma.ConfessionWhereInput[] = [{ deletedAt: null, isHidden: false }];

    if (query.scope === "MINE") {
      and.push({ authorId: user.id });
    } else if (query.scope === "UNIVERSITY") {
      if (!user.universityId) throw forbidden("Üniversite bilgisi bulunamadı");
      and.push({ scope: "UNIVERSITY", universityId: user.universityId });
    } else {
      and.push({ scope: "GLOBAL" });
    }

    if (query.topic) and.push({ topic: query.topic });
    if (cursor) and.push({ createdAt: { lt: cursor.date } });

    const confessions = await prisma.confession.findMany({
      where: { AND: and },
      include: {
        university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
        likes: { where: { userId: user.id }, select: { userId: true } },
      },
      orderBy: query.sort === "TOP" ? [{ likeCount: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      take: query.limit + 1,
    });

    const hasMore = confessions.length > query.limit;
    const items = hasMore ? confessions.slice(0, query.limit) : confessions;

    return {
      items: items.map((c) => serializeConfession(c, user.id)),
      nextCursor:
        hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
          : null,
    };
  });

  // ------------------------------------------------------------ paylaş
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const body = createConfessionSchema.parse(request.body);

    // Spam koruması: saatte en fazla 5 itiraf
    const recent = await prisma.confession.count({
      where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= 5) throw forbidden("Saatte en fazla 5 itiraf paylaşabilirsiniz");

    if (body.scope === "UNIVERSITY" && !user.universityId) {
      throw forbidden("Üniversite bilgisi olmadan üniversiteye özel itiraf paylaşılamaz");
    }

    const confession = await prisma.confession.create({
      data: {
        content: body.content,
        topic: body.topic,
        scope: body.scope,
        alias: generateAnonymousAlias(`${user.id}-${Date.now()}`),
        authorId: user.id,
        universityId: body.scope === "UNIVERSITY" ? user.universityId : null,
      },
      include: {
        university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
      },
    });

    reply.code(201);
    return { confession: serializeConfession({ ...confession, likes: [] }, user.id) };
  });

  // ------------------------------------------------------------ beğeni
  app.post("/:id/like", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const created = await prisma.confessionLike.createMany({
      data: [{ confessionId: id, userId: user.id }],
      skipDuplicates: true,
    });
    if (created.count > 0) {
      const updated = await prisma.confession.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated.likeCount };
    }

    const current = await prisma.confession.findUnique({ where: { id }, select: { likeCount: true } });
    return { liked: true, likeCount: current?.likeCount ?? 0 };
  });

  app.delete("/:id/like", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const removed = await prisma.confessionLike.deleteMany({
      where: { confessionId: id, userId: user.id },
    });
    if (removed.count === 0) {
      const current = await prisma.confession.findUnique({
        where: { id },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: current?.likeCount ?? 0 };
    }

    const updated = await prisma.confession.update({
      where: { id },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    });
    return { liked: false, likeCount: Math.max(0, updated.likeCount) };
  });

  // ------------------------------------------------------------ sil
  app.delete("/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const confession = await prisma.confession.findFirst({
      where: { id, deletedAt: null },
      select: { authorId: true },
    });
    if (!confession) throw notFound("İtiraf bulunamadı");
    if (confession.authorId !== user.id && user.role !== "ADMIN" && user.role !== "MODERATOR") {
      throw forbidden("Bu itirafı silme yetkiniz yok");
    }

    await prisma.confession.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  });

  // ------------------------------------------------------------ konu başlıkları
  app.get("/topics", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const grouped = await prisma.confession.groupBy({
      by: ["topic"],
      where: {
        deletedAt: null,
        isHidden: false,
        topic: { not: null },
        OR: [
          { scope: "GLOBAL" },
          ...(user.universityId
            ? [{ scope: "UNIVERSITY" as const, universityId: user.universityId }]
            : []),
        ],
      },
      _count: { _all: true },
      orderBy: { _count: { topic: "desc" } },
      take: 12,
    });

    return {
      items: grouped
        .filter((g) => g.topic)
        .map((g) => ({ topic: g.topic as string, count: g._count._all })),
    };
  });
}
