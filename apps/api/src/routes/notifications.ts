import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { decodeCursor, encodeCursor, serializeMiniUser } from "../lib/serialize";
import { requireUser } from "../plugins/auth";

export default async function notificationRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const query = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(25),
        filter: z.enum(["ALL", "UNREAD", "MENTIONS"]).default("ALL"),
      })
      .parse(request.query);

    const cursor = decodeCursor(query.cursor);

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        type: { not: "MESSAGE" },
        ...(query.filter === "UNREAD" ? { isRead: false } : {}),
        ...(query.filter === "MENTIONS" ? { type: { in: ["MENTION", "COMMENT_REPLY"] } } : {}),
        ...(cursor ? { createdAt: { lt: cursor.date } } : {}),
      },
      include: {
        actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    const hasMore = notifications.length > query.limit;
    const items = hasMore ? notifications.slice(0, query.limit) : notifications;

    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        actor: n.actor ? serializeMiniUser(n.actor) : null,
        text: n.text,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor:
        hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
          : null,
    };
  });

  app.get("/unread-count", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const [notifications, messages] = await Promise.all([
      prisma.notification.count({ where: { userId: user.id, isRead: false, type: { not: "MESSAGE" } } }),
      prisma.conversationMember
        .findMany({ where: { userId: user.id }, select: { conversationId: true, lastReadAt: true } })
        .then(async (memberships) => {
          if (memberships.length === 0) return 0;
          const counts = await Promise.all(
            memberships.map((m) =>
              prisma.message.count({
                where: {
                  conversationId: m.conversationId,
                  senderId: { not: user.id },
                  deletedAt: null,
                  createdAt: { gt: m.lastReadAt },
                },
              }),
            ),
          );
          return counts.reduce((a, b) => a + b, 0);
        }),
    ]);

    return { notifications, messages };
  });

  app.post("/read", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { ids } = z.object({ ids: z.array(z.string()).optional() }).parse(request.body ?? {});

    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { isRead: true },
    });

    return { ok: true };
  });

  app.delete("/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await prisma.notification.deleteMany({ where: { id, userId: user.id } });
    return { deleted: true };
  });

  app.delete("/", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    await prisma.notification.deleteMany({ where: { userId: user.id, isRead: true } });
    return { ok: true };
  });
}
