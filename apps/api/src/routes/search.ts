import type { FastifyInstance } from "fastify";
import { searchSchema } from "@kampus/shared";
import { prisma } from "../db";
import { serializeUser } from "../lib/serialize";
import { serializeCommunity } from "../services/communities";
import { blockedUserIds, postInclude, serializePost, visibleCommunityFilter } from "../services/posts";

export default async function searchRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.optionalAuth }, async (request) => {
    const query = searchSchema.parse(request.query);
    const user = request.user;
    const viewerId = user?.id ?? null;
    const q = query.q;
    const wantAll = query.type === "ALL";

    const blocked = await blockedUserIds(viewerId);

    const [users, communities, posts, events, notes] = await Promise.all([
      // ---- kullanıcılar
      wantAll || query.type === "USERS"
        ? prisma.user.findMany({
            where: {
              status: "ACTIVE",
              id: { notIn: blocked.length ? blocked : ["-"] },
              OR: [
                { username: { contains: q, mode: "insensitive" } },
                { displayName: { contains: q, mode: "insensitive" } },
              ],
            },
            select: {
              id: true, username: true, displayName: true, avatarUrl: true, bio: true,
              department: true, classYear: true, karma: true, showDepartment: true,
              verifiedAt: true, createdAt: true,
              university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
              badges: { select: { code: true } },
            },
            orderBy: { karma: "desc" },
            take: query.limit,
          })
        : [],

      // ---- topluluklar
      wantAll || query.type === "COMMUNITIES"
        ? prisma.community.findMany({
            where: {
              isArchived: false,
              AND: [
                {
                  OR: [
                    { visibility: "PUBLIC" },
                    ...(user ? [{ members: { some: { userId: user.id } } }] : []),
                  ],
                },
                {
                  OR: [
                    { scope: "GLOBAL" },
                    ...(user?.universityId ? [{ universityId: user.universityId }] : []),
                  ],
                },
                {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } },
                    { tags: { has: q.toLowerCase() } },
                    { department: { contains: q, mode: "insensitive" } },
                  ],
                },
              ],
            },
            include: {
              university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
              ...(user ? { members: { where: { userId: user.id }, select: { role: true } } } : {}),
            },
            orderBy: { memberCount: "desc" },
            take: query.limit,
          })
        : [],

      // ---- gönderiler
      wantAll || query.type === "POSTS"
        ? (async () => {
            const visibility = await visibleCommunityFilter(user);
            return prisma.post.findMany({
              where: {
                deletedAt: null,
                content: { contains: q, mode: "insensitive" },
                ...(blocked.length ? { authorId: { notIn: blocked } } : {}),
                ...(visibility ?? {}),
              },
              include: postInclude(viewerId),
              orderBy: [{ hotScore: "desc" }, { createdAt: "desc" }],
              take: query.limit,
            });
          })()
        : [],

      // ---- etkinlikler
      wantAll || query.type === "EVENTS"
        ? prisma.event.findMany({
            where: {
              isCancelled: false,
              startsAt: { gte: new Date() },
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { location: { contains: q, mode: "insensitive" } },
              ],
            },
            select: {
              id: true, title: true, startsAt: true, coverUrl: true, isOnline: true,
              location: true, attendeeCount: true,
              community: { select: { id: true, slug: true, name: true } },
            },
            orderBy: { startsAt: "asc" },
            take: query.limit,
          })
        : [],

      // ---- ders notları
      wantAll || query.type === "NOTES"
        ? prisma.note.findMany({
            where: {
              deletedAt: null,
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { courseName: { contains: q, mode: "insensitive" } },
                { courseCode: { contains: q, mode: "insensitive" } },
              ],
              AND: [
                {
                  OR: [
                    { visibility: "GLOBAL" },
                    ...(user?.universityId
                      ? [{ visibility: "UNIVERSITY" as const, universityId: user.universityId }]
                      : []),
                  ],
                },
              ],
            },
            select: {
              id: true, title: true, courseCode: true, courseName: true,
              ratingSum: true, ratingCount: true, downloadCount: true,
              uploader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            },
            orderBy: { downloadCount: "desc" },
            take: query.limit,
          })
        : [],
    ]);

    return {
      users: users.map((u) => serializeUser(u)),
      communities: communities.map((c) =>
        serializeCommunity(c, {
          role: (c as { members?: { role: "OWNER" | "MODERATOR" | "MEMBER" }[] }).members?.[0]?.role ?? null,
        }),
      ),
      posts: posts.map((p) => serializePost(p, { id: viewerId, role: user?.role })),
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        coverUrl: e.coverUrl,
        isOnline: e.isOnline,
        location: e.location,
        attendeeCount: e.attendeeCount,
        community: e.community,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        courseCode: n.courseCode,
        courseName: n.courseName,
        ratingAvg: n.ratingCount > 0 ? Number((n.ratingSum / n.ratingCount).toFixed(1)) : 0,
        downloadCount: n.downloadCount,
        uploader: n.uploader,
      })),
    };
  });

  /** Arama çubuğu için hızlı öneriler (kullanıcı + topluluk). */
  app.get("/quick", { preHandler: app.optionalAuth }, async (request) => {
    const query = searchSchema.parse(request.query);
    const user = request.user;

    const [users, communities] = await Promise.all([
      prisma.user.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { username: { startsWith: query.q.toLowerCase() } },
            { displayName: { contains: query.q, mode: "insensitive" } },
          ],
        },
        select: { id: true, username: true, displayName: true, avatarUrl: true, department: true },
        orderBy: { karma: "desc" },
        take: 5,
      }),
      prisma.community.findMany({
        where: {
          isArchived: false,
          visibility: "PUBLIC",
          name: { contains: query.q, mode: "insensitive" },
          OR: [
            { scope: "GLOBAL" },
            ...(user?.universityId ? [{ universityId: user.universityId }] : []),
          ],
        },
        select: { id: true, slug: true, name: true, avatarUrl: true, memberCount: true },
        orderBy: { memberCount: "desc" },
        take: 5,
      }),
    ]);

    return { users, communities };
  });
}
