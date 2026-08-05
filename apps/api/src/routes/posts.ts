import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createCommentSchema,
  createPostSchema,
  extractHashtags,
  extractMentions,
  generateAnonymousAlias,
} from "@kampus/shared";
import { prisma } from "../db";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { addKarma, notify, notifyMentions } from "../lib/notify";
import { decodeCursor, encodeCursor, serializeUser } from "../lib/serialize";
import { requireUser } from "../plugins/auth";
import { assertCanView, memberRole } from "../services/communities";
import { hotScore, postInclude, refreshHotScore, serializePost } from "../services/posts";
import { emitToCommunity } from "../realtime/io";
import { SOCKET_EVENTS } from "@kampus/shared";

const idParam = z.object({ id: z.string().min(1) });

async function loadPostOr404(id: string, viewerId: string | null) {
  const post = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    include: postInclude(viewerId),
  });
  if (!post) throw notFound("Gönderi bulunamadı");
  return post;
}

export default async function postRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ oluştur
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const body = createPostSchema.parse(request.body);

    // Spam koruması: son 1 dakikada en fazla 5 gönderi
    const recent = await prisma.post.count({
      where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 5) throw forbidden("Çok hızlı paylaşım yapıyorsunuz, biraz bekleyin");

    if (body.communityId) {
      const community = await prisma.community.findUnique({
        where: { id: body.communityId },
        select: {
          id: true, slug: true, name: true, scope: true, visibility: true,
          universityId: true, department: true, isArchived: true,
        },
      });
      if (!community || community.isArchived) throw notFound("Topluluk bulunamadı");

      const role = await memberRole(community.id, user.id);
      if (!role && user.role !== "ADMIN") {
        throw forbidden("Bu topluluğa paylaşım yapmak için üye olmalısınız");
      }
      await assertCanView(community, user);
    }

    const hashtags = extractHashtags(body.content);

    const post = await prisma.post.create({
      data: {
        content: body.content,
        media: (body.media ?? []) as object,
        authorId: user.id,
        communityId: body.communityId ?? null,
        isAnonymous: body.isAnonymous,
        anonymousAlias: body.isAnonymous ? generateAnonymousAlias(`${user.id}-${Date.now()}`) : null,
        hashtags,
        hotScore: hotScore(0, 0, new Date()),
        ...(body.poll
          ? {
              poll: {
                create: {
                  question: body.poll.question,
                  endsAt: new Date(Date.now() + body.poll.endsInHours * 3_600_000),
                  options: {
                    create: body.poll.options.map((text, position) => ({ text, position })),
                  },
                },
              },
            }
          : {}),
      },
      include: postInclude(user.id),
    });

    if (body.communityId) {
      await prisma.community.update({
        where: { id: body.communityId },
        data: { postCount: { increment: 1 } },
      });
      emitToCommunity(body.communityId, SOCKET_EVENTS.POST_LIVE, { postId: post.id });
    }

    await addKarma(user.id, 2);

    // @bahsetmeler (anonim gönderide bildirim gönderilmez)
    if (!body.isAnonymous) {
      await notifyMentions({
        usernames: extractMentions(body.content),
        actorId: user.id,
        actorName: user.displayName,
        text: `${user.displayName} bir gönderide senden bahsetti`,
        link: `/gonderi/${post.id}`,
        entityId: post.id,
      });
    }

    reply.code(201);
    return { post: serializePost(post, { id: user.id, role: user.role }) };
  });

  // ------------------------------------------------------------ tek gönderi
  app.get("/:id", { preHandler: app.optionalAuth }, async (request) => {
    const { id } = idParam.parse(request.params);
    const user = request.user;
    const post = await loadPostOr404(id, user?.id ?? null);

    if (post.community) {
      const community = await prisma.community.findUniqueOrThrow({
        where: { id: post.community.id },
        select: { id: true, scope: true, visibility: true, universityId: true, department: true },
      });
      await assertCanView(community, user);
    }

    return { post: serializePost(post, { id: user?.id ?? null, role: user?.role }) };
  });

  // ------------------------------------------------------------ düzenle
  app.patch("/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const { content } = z.object({ content: z.string().trim().min(1).max(2000) }).parse(request.body);

    const existing = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { authorId: true, createdAt: true },
    });
    if (!existing) throw notFound("Gönderi bulunamadı");
    if (existing.authorId !== user.id) throw forbidden("Sadece kendi gönderinizi düzenleyebilirsiniz");
    if (Date.now() - existing.createdAt.getTime() > 30 * 60_000) {
      throw forbidden("Gönderiler yalnızca ilk 30 dakika içinde düzenlenebilir");
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { content, hashtags: extractHashtags(content), editedAt: new Date() },
      include: postInclude(user.id),
    });

    return { post: serializePost(updated, { id: user.id, role: user.role }) };
  });

  // ------------------------------------------------------------ sil
  app.delete("/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, communityId: true },
    });
    if (!post) throw notFound("Gönderi bulunamadı");

    const isStaff = user.role === "ADMIN" || user.role === "MODERATOR";
    const isCommunityMod = post.communityId
      ? ["OWNER", "MODERATOR"].includes((await memberRole(post.communityId, user.id)) ?? "")
      : false;

    if (post.authorId !== user.id && !isStaff && !isCommunityMod) {
      throw forbidden("Bu gönderiyi silme yetkiniz yok");
    }

    await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
    if (post.communityId) {
      await prisma.community.update({
        where: { id: post.communityId },
        data: { postCount: { decrement: 1 } },
      });
    }

    return { deleted: true };
  });

  // ------------------------------------------------------------ beğeni
  app.post("/:id/like", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, isAnonymous: true },
    });
    if (!post) throw notFound("Gönderi bulunamadı");

    const created = await prisma.postLike.createMany({
      data: [{ postId: id, userId: user.id }],
      skipDuplicates: true,
    });

    if (created.count > 0) {
      const updated = await prisma.post.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      await refreshHotScore(id);
      await addKarma(post.authorId, 1);

      if (!post.isAnonymous) {
        await notify({
          userId: post.authorId,
          type: "POST_LIKE",
          actorId: user.id,
          text: `${user.displayName} gönderini beğendi`,
          link: `/gonderi/${id}`,
          entityId: id,
        });
      }
      return { liked: true, likeCount: updated.likeCount };
    }

    const current = await prisma.post.findUniqueOrThrow({
      where: { id },
      select: { likeCount: true },
    });
    return { liked: true, likeCount: current.likeCount };
  });

  app.delete("/:id/like", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const removed = await prisma.postLike.deleteMany({ where: { postId: id, userId: user.id } });
    if (removed.count === 0) {
      const current = await prisma.post.findUnique({ where: { id }, select: { likeCount: true } });
      return { liked: false, likeCount: current?.likeCount ?? 0 };
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true, authorId: true },
    });
    await refreshHotScore(id);
    await addKarma(updated.authorId, -1);

    return { liked: false, likeCount: Math.max(0, updated.likeCount) };
  });

  // ------------------------------------------------------------ kaydet
  app.post("/:id/bookmark", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    await prisma.bookmark.createMany({
      data: [{ postId: id, userId: user.id }],
      skipDuplicates: true,
    });
    return { bookmarked: true };
  });

  app.delete("/:id/bookmark", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    await prisma.bookmark.deleteMany({ where: { postId: id, userId: user.id } });
    return { bookmarked: false };
  });

  // ------------------------------------------------------------ beğenenler
  app.get("/:id/likes", { preHandler: app.optionalAuth }, async (request) => {
    const { id } = idParam.parse(request.params);
    const likes = await prisma.postLike.findMany({
      where: { postId: id },
      include: {
        user: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            department: true, verifiedAt: true, createdAt: true, karma: true,
            university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items: likes.map((l) => serializeUser(l.user)) };
  });

  // ------------------------------------------------------------ anket oyu
  app.post("/:id/poll/vote", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const { optionId } = z.object({ optionId: z.string().min(1) }).parse(request.body);

    const poll = await prisma.poll.findUnique({
      where: { postId: id },
      include: { options: { select: { id: true } } },
    });
    if (!poll) throw notFound("Bu gönderide anket yok");
    if (poll.endsAt < new Date()) throw badRequest("Anket sona erdi");
    if (!poll.options.some((o) => o.id === optionId)) throw badRequest("Geçersiz seçenek");

    const existing = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: user.id } },
      select: { optionId: true },
    });

    if (existing?.optionId === optionId) {
      // Aynı seçeneğe tekrar tıklamak oyu geri çeker.
      await prisma.$transaction([
        prisma.pollVote.delete({ where: { pollId_userId: { pollId: poll.id, userId: user.id } } }),
        prisma.pollOption.update({ where: { id: optionId }, data: { voteCount: { decrement: 1 } } }),
      ]);
    } else if (existing) {
      await prisma.$transaction([
        prisma.pollVote.update({
          where: { pollId_userId: { pollId: poll.id, userId: user.id } },
          data: { optionId },
        }),
        prisma.pollOption.update({
          where: { id: existing.optionId },
          data: { voteCount: { decrement: 1 } },
        }),
        prisma.pollOption.update({ where: { id: optionId }, data: { voteCount: { increment: 1 } } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.pollVote.create({ data: { pollId: poll.id, userId: user.id, optionId } }),
        prisma.pollOption.update({ where: { id: optionId }, data: { voteCount: { increment: 1 } } }),
      ]);
    }

    const post = await loadPostOr404(id, user.id);
    return { post: serializePost(post, { id: user.id, role: user.role }) };
  });

  // ------------------------------------------------------------ sabitle
  app.post("/:id/pin", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const { pinned } = z.object({ pinned: z.boolean() }).parse(request.body);

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { communityId: true },
    });
    if (!post?.communityId) throw badRequest("Sadece topluluk gönderileri sabitlenebilir");

    const role = await memberRole(post.communityId, user.id);
    if (!["OWNER", "MODERATOR"].includes(role ?? "") && user.role !== "ADMIN") {
      throw forbidden("Bu işlem için topluluk yöneticisi olmalısınız");
    }

    await prisma.post.update({ where: { id }, data: { isPinned: pinned } });
    return { pinned };
  });

  // ------------------------------------------------------------ yorumlar
  app.get("/:id/comments", { preHandler: app.optionalAuth }, async (request) => {
    const { id } = idParam.parse(request.params);
    const query = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        sort: z.enum(["NEW", "TOP"]).default("NEW"),
      })
      .parse(request.query);

    const viewerId = request.user?.id ?? null;
    const cursor = decodeCursor(query.cursor);

    const comments = await prisma.comment.findMany({
      where: {
        postId: id,
        parentId: null,
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: cursor.date } } : {}),
      },
      include: {
        author: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            department: true, showDepartment: true, verifiedAt: true, karma: true, createdAt: true,
            university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
          },
        },
        ...(viewerId ? { likes: { where: { userId: viewerId }, select: { userId: true } } } : {}),
        replies: {
          where: { deletedAt: null },
          take: 3,
          orderBy: { createdAt: "asc" },
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
        },
      },
      orderBy: query.sort === "TOP" ? [{ likeCount: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      take: query.limit + 1,
    });

    const hasMore = comments.length > query.limit;
    const items = hasMore ? comments.slice(0, query.limit) : comments;

    type CommentRow = (typeof items)[number];
    const shape = (c: CommentRow | CommentRow["replies"][number]) => ({
      id: c.id,
      postId: c.postId,
      parentId: c.parentId,
      content: c.content,
      author: serializeUser(c.author),
      likeCount: c.likeCount,
      replyCount: "replyCount" in c ? c.replyCount : 0,
      createdAt: c.createdAt.toISOString(),
      viewer: {
        hasLiked: ((c as { likes?: unknown[] }).likes?.length ?? 0) > 0,
        canDelete:
          c.authorId === viewerId ||
          request.user?.role === "ADMIN" ||
          request.user?.role === "MODERATOR",
      },
    });

    return {
      items: items.map((c) => ({
        ...shape(c),
        replies: c.replies.map(shape),
      })),
      nextCursor:
        hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
          : null,
    };
  });

  app.post("/:id/comments", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const body = createCommentSchema.parse(request.body);

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, isAnonymous: true },
    });
    if (!post) throw notFound("Gönderi bulunamadı");

    if (body.parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: body.parentId, postId: id, deletedAt: null },
        select: { id: true, parentId: true, authorId: true },
      });
      if (!parent) throw badRequest("Yanıtlanan yorum bulunamadı");
      // Tek seviye iç içe yanıt: yanıtın yanıtı üst yoruma bağlanır.
      if (parent.parentId) body.parentId = parent.parentId;
    }

    const comment = await prisma.comment.create({
      data: {
        postId: id,
        authorId: user.id,
        parentId: body.parentId ?? null,
        content: body.content,
      },
      include: {
        author: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            department: true, showDepartment: true, verifiedAt: true, karma: true, createdAt: true,
            university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
          },
        },
      },
    });

    await prisma.post.update({ where: { id }, data: { commentCount: { increment: 1 } } });
    if (body.parentId) {
      await prisma.comment.update({
        where: { id: body.parentId },
        data: { replyCount: { increment: 1 } },
      });
    }
    await refreshHotScore(id);
    await addKarma(user.id, 1);

    if (!post.isAnonymous) {
      await notify({
        userId: post.authorId,
        type: "COMMENT",
        actorId: user.id,
        text: `${user.displayName} gönderine yorum yaptı: "${body.content.slice(0, 50)}"`,
        link: `/gonderi/${id}`,
        entityId: id,
      });
    }

    if (body.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: body.parentId },
        select: { authorId: true },
      });
      if (parent && parent.authorId !== post.authorId) {
        await notify({
          userId: parent.authorId,
          type: "COMMENT_REPLY",
          actorId: user.id,
          text: `${user.displayName} yorumunu yanıtladı`,
          link: `/gonderi/${id}`,
          entityId: comment.id,
        });
      }
    }

    await notifyMentions({
      usernames: extractMentions(body.content),
      actorId: user.id,
      actorName: user.displayName,
      text: `${user.displayName} bir yorumda senden bahsetti`,
      link: `/gonderi/${id}`,
      entityId: comment.id,
    });

    reply.code(201);
    return {
      comment: {
        id: comment.id,
        postId: comment.postId,
        parentId: comment.parentId,
        content: comment.content,
        author: serializeUser(comment.author),
        likeCount: 0,
        replyCount: 0,
        createdAt: comment.createdAt.toISOString(),
        viewer: { hasLiked: false, canDelete: true },
        replies: [],
      },
    };
  });
}
