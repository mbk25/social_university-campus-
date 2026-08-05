import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { forbidden, notFound } from "../lib/errors";
import { decodeCursor, encodeCursor } from "../lib/serialize";
import { requireUser } from "../plugins/auth";
import { assertCanView } from "../services/communities";
import { blockedUserIds, postInclude, serializePost, visibleCommunityFilter } from "../services/posts";

const feedQuerySchema = z.object({
  tab: z
    .enum(["HOME", "EXPLORE", "UNIVERSITY", "DEPARTMENT", "COMMUNITY", "USER", "BOOKMARKS", "HASHTAG"])
    .default("HOME"),
  community: z.string().optional(),
  username: z.string().optional(),
  hashtag: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(15),
});

export default async function feedRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.optionalAuth }, async (request) => {
    const query = feedQuerySchema.parse(request.query);
    const user = request.user;
    const viewerId = user?.id ?? null;
    const cursor = decodeCursor(query.cursor);

    const and: Prisma.PostWhereInput[] = [{ deletedAt: null }];

    // Engellenen kullanıcıların gönderileri hiçbir sekmede görünmez.
    const blocked = await blockedUserIds(viewerId);
    if (blocked.length > 0) and.push({ authorId: { notIn: blocked } });

    // Gizli/erişilemeyen topluluk içeriğini filtrele.
    const visibility = await visibleCommunityFilter(user);
    if (visibility) and.push(visibility as Prisma.PostWhereInput);

    let orderBy: Prisma.PostOrderByWithRelationInput[] = [{ createdAt: "desc" }];
    let useHotScore = false;

    switch (query.tab) {
      case "HOME": {
        if (!user) {
          // Misafir: genel toplulukların popüler gönderileri
          and.push({ community: { scope: "GLOBAL", visibility: "PUBLIC" } });
          useHotScore = true;
          break;
        }
        const [following, memberships] = await Promise.all([
          prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
          prisma.communityMember.findMany({
            where: { userId: user.id },
            select: { communityId: true },
          }),
        ]);
        and.push({
          OR: [
            { authorId: user.id },
            ...(following.length > 0
              ? [{ authorId: { in: following.map((f) => f.followingId) }, communityId: null }]
              : []),
            ...(memberships.length > 0
              ? [{ communityId: { in: memberships.map((m) => m.communityId) } }]
              : []),
          ],
        });
        break;
      }

      case "EXPLORE": {
        useHotScore = true;
        // Son 7 günün öne çıkanları
        and.push({ createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } });
        if (user?.universityId) {
          and.push({
            OR: [
              { community: { scope: "GLOBAL" } },
              { community: { universityId: user.universityId } },
              { communityId: null, author: { universityId: user.universityId } },
            ],
          });
        }
        break;
      }

      case "UNIVERSITY": {
        if (!user?.universityId) throw forbidden("Üniversite bilgisi bulunamadı");
        and.push({
          OR: [
            { author: { universityId: user.universityId } },
            { community: { universityId: user.universityId } },
          ],
        });
        break;
      }

      case "DEPARTMENT": {
        if (!user?.department) throw forbidden("Bölüm bilgisi bulunamadı");
        and.push({
          OR: [
            { author: { universityId: user.universityId, department: user.department } },
            { community: { scope: "DEPARTMENT", department: user.department } },
          ],
        });
        break;
      }

      case "COMMUNITY": {
        if (!query.community) throw notFound("Topluluk belirtilmedi");
        const community = await prisma.community.findFirst({
          where: { OR: [{ id: query.community }, { slug: query.community }] },
          select: {
            id: true, scope: true, visibility: true, universityId: true, department: true,
          },
        });
        if (!community) throw notFound("Topluluk bulunamadı");
        await assertCanView(community, user);
        and.push({ communityId: community.id });
        orderBy = [{ isPinned: "desc" }, { createdAt: "desc" }];
        break;
      }

      case "USER": {
        if (!query.username) throw notFound("Kullanıcı belirtilmedi");
        const target = await prisma.user.findUnique({
          where: { username: query.username.toLowerCase() },
          select: { id: true, isPrivate: true },
        });
        if (!target) throw notFound("Kullanıcı bulunamadı");

        if (target.isPrivate && target.id !== viewerId) {
          const follows = viewerId
            ? await prisma.follow.findUnique({
                where: { followerId_followingId: { followerId: viewerId, followingId: target.id } },
                select: { followerId: true },
              })
            : null;
          if (!follows) throw forbidden("Bu hesap gizli");
        }

        // Anonim gönderiler profilde görünmez.
        and.push({ authorId: target.id, isAnonymous: false });
        break;
      }

      case "BOOKMARKS": {
        const me = requireUser(request);
        and.push({ bookmarks: { some: { userId: me.id } } });
        break;
      }

      case "HASHTAG": {
        if (!query.hashtag) throw notFound("Etiket belirtilmedi");
        and.push({ hashtags: { has: query.hashtag.toLocaleLowerCase("tr") } });
        useHotScore = true;
        break;
      }
    }

    if (cursor) {
      and.push(
        useHotScore
          ? { createdAt: { lt: cursor.date } }
          : { createdAt: { lt: cursor.date } },
      );
    }

    if (useHotScore) orderBy = [{ hotScore: "desc" }, { createdAt: "desc" }];

    const posts = await prisma.post.findMany({
      where: { AND: and },
      include: postInclude(viewerId),
      orderBy,
      take: query.limit + 1,
    });

    const hasMore = posts.length > query.limit;
    const items = hasMore ? posts.slice(0, query.limit) : posts;

    return {
      items: items.map((p) => serializePost(p, { id: viewerId, role: user?.role })),
      nextCursor:
        hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
          : null,
    };
  });

  // ------------------------------------------------------------ gündem
  app.get("/trending", { preHandler: app.optionalAuth }, async (request) => {
    const user = request.user;
    const since = new Date(Date.now() - 3 * 86_400_000);

    const posts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: since },
        hashtags: { isEmpty: false },
        ...(user?.universityId
          ? {
              OR: [
                { community: { scope: "GLOBAL" } },
                { author: { universityId: user.universityId } },
                { community: { universityId: user.universityId } },
              ],
            }
          : {}),
      },
      select: { hashtags: true, likeCount: true, commentCount: true },
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    const counts = new Map<string, { posts: number; score: number }>();
    for (const post of posts) {
      for (const tag of post.hashtags) {
        const entry = counts.get(tag) ?? { posts: 0, score: 0 };
        entry.posts += 1;
        entry.score += 1 + post.likeCount * 0.5 + post.commentCount;
        counts.set(tag, entry);
      }
    }

    const trending = Array.from(counts.entries())
      .map(([tag, v]) => ({ tag, postCount: v.posts, score: Math.round(v.score) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Ayrıca önerilen topluluklar
    const suggestedCommunities = await prisma.community.findMany({
      where: {
        isArchived: false,
        visibility: "PUBLIC",
        ...(user
          ? {
              members: { none: { userId: user.id } },
              OR: [
                { scope: "GLOBAL" },
                ...(user.universityId ? [{ universityId: user.universityId }] : []),
              ],
            }
          : { scope: "GLOBAL" }),
      },
      select: {
        id: true, slug: true, name: true, avatarUrl: true, memberCount: true,
        scope: true, department: true,
      },
      orderBy: { memberCount: "desc" },
      take: 5,
    });

    return { trending, suggestedCommunities };
  });
}
