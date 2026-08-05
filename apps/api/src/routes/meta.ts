import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BADGES, DEPARTMENTS } from "@kampus/shared";
import { prisma } from "../db";

export default async function metaRoutes(app: FastifyInstance) {
  /** Kayıt formu ve filtreler için üniversite listesi. */
  app.get("/universities", async (request) => {
    const { q, limit } = z
      .object({
        q: z.string().trim().max(60).optional(),
        limit: z.coerce.number().int().min(1).max(300).default(300),
      })
      .parse(request.query);

    const universities = await prisma.university.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { shortName: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true, name: true, shortName: true, city: true, type: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return {
      items: universities.map((u) => ({
        id: u.id,
        name: u.name,
        shortName: u.shortName,
        city: u.city,
        type: u.type,
        studentCount: u._count.users,
      })),
    };
  });

  /** Bölüm listesi (fakülteye göre gruplu). */
  app.get("/departments", async () => ({ groups: DEPARTMENTS }));

  /** Rozet kataloğu. */
  app.get("/badges", async () => ({
    items: Object.entries(BADGES).map(([code, b]) => ({ code, ...b })),
  }));

  /** Ana sayfa istatistikleri. */
  app.get("/stats", async () => {
    const [users, universities, communities, posts, notes, events] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.university.count({ where: { isActive: true, users: { some: {} } } }),
      prisma.community.count({ where: { isArchived: false } }),
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.note.count({ where: { deletedAt: null } }),
      prisma.event.count({ where: { isCancelled: false, startsAt: { gte: new Date() } } }),
    ]);

    return { users, universities, communities, posts, notes, upcomingEvents: events };
  });

  /** Üniversite sıralaması (en aktif kampüsler). */
  app.get("/leaderboard", async (request) => {
    const { scope } = z
      .object({ scope: z.enum(["UNIVERSITIES", "USERS"]).default("UNIVERSITIES") })
      .parse(request.query);

    if (scope === "USERS") {
      const users = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true, username: true, displayName: true, avatarUrl: true, karma: true,
          department: true,
          university: { select: { shortName: true, name: true } },
        },
        orderBy: { karma: "desc" },
        take: 20,
      });
      return { items: users };
    }

    const universities = await prisma.university.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, shortName: true, city: true,
        _count: { select: { users: true, communities: true } },
      },
      orderBy: { users: { _count: "desc" } },
      take: 20,
    });

    return {
      items: universities
        .filter((u) => u._count.users > 0)
        .map((u) => ({
          id: u.id,
          name: u.name,
          shortName: u.shortName,
          city: u.city,
          studentCount: u._count.users,
          communityCount: u._count.communities,
        })),
    };
  });
}
