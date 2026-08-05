import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { reportSchema } from "@kampus/shared";
import { prisma } from "../db";
import { forbidden, notFound } from "../lib/errors";
import { notify } from "../lib/notify";
import { serializeMiniUser } from "../lib/serialize";
import { requireUser } from "../plugins/auth";

export default async function moderationRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ şikayet et
  app.post("/reports", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const body = reportSchema.parse(request.body);

    const existing = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        targetType: body.targetType,
        targetId: body.targetId,
        status: { in: ["OPEN", "REVIEWING"] },
      },
      select: { id: true },
    });
    if (existing) {
      return { ok: true, message: "Bu içeriği zaten bildirdiniz, inceleniyor." };
    }

    await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        details: body.details,
      },
    });

    reply.code(201);
    return { ok: true, message: "Bildiriminiz alındı, en kısa sürede incelenecek." };
  });

  // ------------------------------------------------------------ yönetim: şikayet listesi
  app.get("/admin/reports", { preHandler: app.requireStaff }, async (request) => {
    const query = z
      .object({
        status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED", "ALL"]).default("OPEN"),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(30),
      })
      .parse(request.query);

    const where = query.status === "ALL" ? {} : { status: query.status };

    const [total, reports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    // Bildirilen içeriğin kısa özetini de ekle.
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let preview: string | null = null;
        let authorId: string | null = null;

        if (r.targetType === "POST") {
          const post = await prisma.post.findUnique({
            where: { id: r.targetId },
            select: { content: true, authorId: true },
          });
          preview = post?.content.slice(0, 200) ?? null;
          authorId = post?.authorId ?? null;
        } else if (r.targetType === "COMMENT") {
          const comment = await prisma.comment.findUnique({
            where: { id: r.targetId },
            select: { content: true, authorId: true },
          });
          preview = comment?.content.slice(0, 200) ?? null;
          authorId = comment?.authorId ?? null;
        } else if (r.targetType === "CONFESSION") {
          const confession = await prisma.confession.findUnique({
            where: { id: r.targetId },
            select: { content: true, authorId: true },
          });
          preview = confession?.content.slice(0, 200) ?? null;
          authorId = confession?.authorId ?? null;
        } else if (r.targetType === "USER") {
          const target = await prisma.user.findUnique({
            where: { id: r.targetId },
            select: { username: true, bio: true },
          });
          preview = target ? `@${target.username} — ${target.bio ?? ""}` : null;
          authorId = r.targetId;
        }

        return {
          id: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          reporter: serializeMiniUser(r.reporter),
          preview,
          authorId,
        };
      }),
    );

    return { items: enriched, total, hasMore: query.page * query.limit < total };
  });

  // ------------------------------------------------------------ yönetim: karar ver
  app.post("/admin/reports/:id", { preHandler: app.requireStaff }, async (request) => {
    const staff = requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        action: z.enum(["DISMISS", "DELETE_CONTENT", "SUSPEND_USER", "HIDE_CONFESSION"]),
        suspendDays: z.number().int().min(1).max(365).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(request.body);

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw notFound("Şikayet bulunamadı");

    switch (body.action) {
      case "DELETE_CONTENT": {
        if (report.targetType === "POST") {
          await prisma.post.update({
            where: { id: report.targetId },
            data: { deletedAt: new Date() },
          });
        } else if (report.targetType === "COMMENT") {
          await prisma.comment.update({
            where: { id: report.targetId },
            data: { deletedAt: new Date() },
          });
        } else if (report.targetType === "CONFESSION") {
          await prisma.confession.update({
            where: { id: report.targetId },
            data: { deletedAt: new Date() },
          });
        } else if (report.targetType === "NOTE") {
          await prisma.note.update({
            where: { id: report.targetId },
            data: { deletedAt: new Date() },
          });
        } else if (report.targetType === "MESSAGE") {
          await prisma.message.update({
            where: { id: report.targetId },
            data: { deletedAt: new Date(), content: "" },
          });
        }
        break;
      }

      case "HIDE_CONFESSION": {
        await prisma.confession.update({ where: { id: report.targetId }, data: { isHidden: true } });
        break;
      }

      case "SUSPEND_USER": {
        if (staff.role !== "ADMIN") throw forbidden("Askıya alma yetkisi yalnızca yöneticide");
        const days = body.suspendDays ?? 7;
        await prisma.user.update({
          where: { id: report.targetId },
          data: {
            status: "SUSPENDED",
            suspendedUntil: new Date(Date.now() + days * 86_400_000),
            suspendReason: body.note ?? "Topluluk kurallarının ihlali",
          },
        });
        await prisma.refreshToken.updateMany({
          where: { userId: report.targetId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        break;
      }

      case "DISMISS":
        break;
    }

    await prisma.report.update({
      where: { id },
      data: {
        status: body.action === "DISMISS" ? "DISMISSED" : "RESOLVED",
        handledBy: staff.id,
        handledAt: new Date(),
      },
    });

    await notify({
      userId: report.reporterId,
      type: "SYSTEM",
      text:
        body.action === "DISMISS"
          ? "Bildirdiğiniz içerik incelendi, kural ihlali tespit edilmedi."
          : "Bildiriminiz için teşekkürler — içerik hakkında işlem yapıldı.",
      link: null,
      entityId: report.id,
    }).catch(() => undefined);

    return { ok: true, action: body.action };
  });

  // ------------------------------------------------------------ yönetim: özet
  app.get("/admin/overview", { preHandler: app.requireStaff }, async () => {
    const dayAgo = new Date(Date.now() - 86_400_000);
    const [
      totalUsers, newUsers, activeToday, openReports, totalPosts, newPosts, communities,
    ] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { lastSeenAt: { gte: dayAgo } } }),
      prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.post.count({ where: { createdAt: { gte: dayAgo }, deletedAt: null } }),
      prisma.community.count({ where: { isArchived: false } }),
    ]);

    return {
      totalUsers, newUsers, activeToday, openReports, totalPosts, newPosts, communities,
    };
  });
}
