import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db";
import { forbidden, notFound } from "../lib/errors";
import { addKarma, grantBadge, notify } from "../lib/notify";
import { serializeUser } from "../lib/serialize";
import { requireUser } from "../plugins/auth";
import { refreshHotScore } from "../services/posts";

const idParam = z.object({ id: z.string().min(1) });

export default async function commentRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ yanıtlar
  app.get("/:id/replies", { preHandler: app.optionalAuth }, async (request) => {
    const { id } = idParam.parse(request.params);
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(20) })
      .parse(request.query);

    const viewerId = request.user?.id ?? null;
    const replies = await prisma.comment.findMany({
      where: { parentId: id, deletedAt: null },
      include: {
        author: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            department: true, showDepartment: true, verifiedAt: true, karma: true, createdAt: true,
            university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
          },
        },
        ...(viewerId ? { likes: { where: { userId: viewerId }, select: { userId: true } } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return {
      items: replies.map((c) => ({
        id: c.id,
        postId: c.postId,
        parentId: c.parentId,
        content: c.content,
        author: serializeUser(c.author),
        likeCount: c.likeCount,
        replyCount: 0,
        createdAt: c.createdAt.toISOString(),
        viewer: {
          hasLiked: ((c as { likes?: unknown[] }).likes?.length ?? 0) > 0,
          canDelete: c.authorId === viewerId || request.user?.role === "ADMIN",
        },
      })),
    };
  });

  // ------------------------------------------------------------ beğeni
  app.post("/:id/like", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const comment = await prisma.comment.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, postId: true },
    });
    if (!comment) throw notFound("Yorum bulunamadı");

    const created = await prisma.commentLike.createMany({
      data: [{ commentId: id, userId: user.id }],
      skipDuplicates: true,
    });
    if (created.count === 0) {
      const current = await prisma.comment.findUniqueOrThrow({
        where: { id },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: current.likeCount };
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    await addKarma(comment.authorId, 1);

    await notify({
      userId: comment.authorId,
      type: "COMMENT_LIKE",
      actorId: user.id,
      text: `${user.displayName} yorumunu beğendi`,
      link: `/gonderi/${comment.postId}`,
      entityId: id,
    });

    // "Yardımsever" rozeti: toplam yorum beğenisi 500'ü geçince
    const totalLikes = await prisma.comment.aggregate({
      where: { authorId: comment.authorId, deletedAt: null },
      _sum: { likeCount: true },
    });
    if ((totalLikes._sum.likeCount ?? 0) >= 500) {
      await grantBadge(comment.authorId, "HELPFUL", "Yardımsever");
    }

    return { liked: true, likeCount: updated.likeCount };
  });

  app.delete("/:id/like", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const removed = await prisma.commentLike.deleteMany({
      where: { commentId: id, userId: user.id },
    });
    if (removed.count === 0) {
      const current = await prisma.comment.findUnique({ where: { id }, select: { likeCount: true } });
      return { liked: false, likeCount: current?.likeCount ?? 0 };
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true, authorId: true },
    });
    await addKarma(updated.authorId, -1);
    return { liked: false, likeCount: Math.max(0, updated.likeCount) };
  });

  // ------------------------------------------------------------ sil
  app.delete("/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const comment = await prisma.comment.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, postId: true, parentId: true },
    });
    if (!comment) throw notFound("Yorum bulunamadı");

    const isStaff = user.role === "ADMIN" || user.role === "MODERATOR";
    if (comment.authorId !== user.id && !isStaff) {
      throw forbidden("Bu yorumu silme yetkiniz yok");
    }

    await prisma.comment.update({ where: { id }, data: { deletedAt: new Date() } });
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });
    if (comment.parentId) {
      await prisma.comment.update({
        where: { id: comment.parentId },
        data: { replyCount: { decrement: 1 } },
      });
    }
    await refreshHotScore(comment.postId);

    return { deleted: true };
  });
}
