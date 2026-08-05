import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createEventSchema } from "@kampus/shared";
import { prisma } from "../db";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { grantBadge, notify } from "../lib/notify";
import { serializeMiniUser, serializeUniversity } from "../lib/serialize";
import { requireUser } from "../plugins/auth";
import { memberRole } from "../services/communities";

const idParam = z.object({ id: z.string().min(1) });

const EVENT_INCLUDE = {
  creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  community: { select: { id: true, slug: true, name: true } },
  university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
} as const;

type EventRow = Awaited<
  ReturnType<typeof prisma.event.findFirstOrThrow<{ include: typeof EVENT_INCLUDE }>>
>;

function serializeEvent(
  event: EventRow,
  viewer?: { isAttending: boolean; canEdit: boolean },
) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    isOnline: event.isOnline,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    coverUrl: event.coverUrl,
    capacity: event.capacity,
    attendeeCount: event.attendeeCount,
    isCancelled: event.isCancelled,
    creator: serializeMiniUser(event.creator),
    community: event.community,
    university: serializeUniversity(event.university),
    ...(viewer ? { viewer } : {}),
  };
}

export default async function eventRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ listeleme
  app.get("/", { preHandler: app.optionalAuth }, async (request) => {
    const user = request.user;
    const query = z
      .object({
        scope: z.enum(["ALL", "UNIVERSITY", "COMMUNITY", "ATTENDING", "MINE"]).default("ALL"),
        communityId: z.string().optional(),
        when: z.enum(["UPCOMING", "PAST"]).default("UPCOMING"),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(request.query);

    const and: Prisma.EventWhereInput[] = [{ isCancelled: false }];

    and.push(
      query.when === "UPCOMING"
        ? { startsAt: { gte: new Date(Date.now() - 3 * 3_600_000) } }
        : { startsAt: { lt: new Date() } },
    );

    // Görünürlük: genel etkinlikler + kendi üniversitendekiler + üye olduğun topluluklar
    if (user?.role !== "ADMIN") {
      const memberships = user
        ? await prisma.communityMember.findMany({
            where: { userId: user.id },
            select: { communityId: true },
          })
        : [];
      and.push({
        OR: [
          { universityId: null, communityId: null },
          ...(user?.universityId ? [{ universityId: user.universityId }] : []),
          ...(memberships.length > 0
            ? [{ communityId: { in: memberships.map((m) => m.communityId) } }]
            : []),
          { community: { visibility: "PUBLIC" as const, scope: "GLOBAL" as const } },
        ],
      });
    }

    if (query.scope === "UNIVERSITY") {
      if (!user?.universityId) throw forbidden("Üniversite bilgisi yok");
      and.push({ universityId: user.universityId });
    }
    if (query.scope === "COMMUNITY") {
      if (!query.communityId) throw badRequest("Topluluk belirtilmedi");
      const community = await prisma.community.findFirst({
        where: { OR: [{ id: query.communityId }, { slug: query.communityId }] },
        select: { id: true },
      });
      if (!community) throw notFound("Topluluk bulunamadı");
      and.push({ communityId: community.id });
    }
    if (query.scope === "ATTENDING") {
      const me = requireUser(request);
      and.push({ attendees: { some: { userId: me.id } } });
    }
    if (query.scope === "MINE") {
      const me = requireUser(request);
      and.push({ creatorId: me.id });
    }

    const where: Prisma.EventWhereInput = { AND: and };

    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        include: {
          ...EVENT_INCLUDE,
          ...(user ? { attendees: { where: { userId: user.id }, select: { userId: true } } } : {}),
        },
        orderBy: { startsAt: query.when === "UPCOMING" ? "asc" : "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: events.map((e) =>
        serializeEvent(e, {
          isAttending: ((e as { attendees?: unknown[] }).attendees?.length ?? 0) > 0,
          canEdit: e.creatorId === user?.id || user?.role === "ADMIN",
        }),
      ),
      total,
      hasMore: query.page * query.limit < total,
    };
  });

  // ------------------------------------------------------------ tek etkinlik
  app.get("/:id", { preHandler: app.optionalAuth }, async (request) => {
    const { id } = idParam.parse(request.params);
    const user = request.user;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        ...EVENT_INCLUDE,
        ...(user ? { attendees: { where: { userId: user.id }, select: { userId: true } } } : {}),
      },
    });
    if (!event) throw notFound("Etkinlik bulunamadı");

    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: id },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    return {
      event: serializeEvent(event, {
        isAttending: ((event as { attendees?: unknown[] }).attendees?.length ?? 0) > 0,
        canEdit: event.creatorId === user?.id || user?.role === "ADMIN",
      }),
      attendees: attendees.map((a) => serializeMiniUser(a.user)),
    };
  });

  // ------------------------------------------------------------ oluştur
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const body = createEventSchema.parse(request.body);

    if (body.startsAt < new Date(Date.now() - 3_600_000)) {
      throw badRequest("Geçmiş bir tarih için etkinlik oluşturulamaz", { startsAt: "Geçmiş tarih" });
    }

    if (body.communityId) {
      const role = await memberRole(body.communityId, user.id);
      if (!["OWNER", "MODERATOR"].includes(role ?? "") && user.role !== "ADMIN") {
        throw forbidden("Topluluk etkinliğini yalnızca yöneticiler oluşturabilir");
      }
    }

    const event = await prisma.event.create({
      data: {
        title: body.title,
        description: body.description,
        location: body.location,
        isOnline: body.isOnline,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        capacity: body.capacity,
        coverUrl: body.coverUrl ?? null,
        creatorId: user.id,
        communityId: body.communityId ?? null,
        universityId: body.communityId ? null : user.universityId,
        attendeeCount: 1,
        attendees: { create: { userId: user.id } },
      },
      include: EVENT_INCLUDE,
    });

    const created = await prisma.event.count({ where: { creatorId: user.id } });
    if (created >= 5) await grantBadge(user.id, "EVENT_ORGANIZER", "Organizatör");

    // Topluluk üyelerine haber ver
    if (body.communityId) {
      const members = await prisma.communityMember.findMany({
        where: { communityId: body.communityId, userId: { not: user.id }, isMuted: false },
        select: { userId: true },
        take: 500,
      });
      await Promise.all(
        members.map((m) =>
          notify({
            userId: m.userId,
            type: "EVENT_NEW",
            actorId: user.id,
            text: `Yeni etkinlik: ${event.title}`,
            link: `/etkinlik/${event.id}`,
            entityId: event.id,
          }).catch(() => undefined),
        ),
      );
    }

    reply.code(201);
    return { event: serializeEvent(event, { isAttending: true, canEdit: true }) };
  });

  // ------------------------------------------------------------ katıl / ayrıl
  app.post("/:id/attend", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, capacity: true, attendeeCount: true, isCancelled: true, startsAt: true },
    });
    if (!event) throw notFound("Etkinlik bulunamadı");
    if (event.isCancelled) throw badRequest("Etkinlik iptal edildi");
    if (event.capacity && event.attendeeCount >= event.capacity) {
      throw badRequest("Etkinlik kontenjanı doldu");
    }

    const created = await prisma.eventAttendee.createMany({
      data: [{ eventId: id, userId: user.id }],
      skipDuplicates: true,
    });
    if (created.count > 0) {
      await prisma.event.update({ where: { id }, data: { attendeeCount: { increment: 1 } } });
    }

    const fresh = await prisma.event.findUniqueOrThrow({
      where: { id },
      select: { attendeeCount: true },
    });
    return { attending: true, attendeeCount: fresh.attendeeCount };
  });

  app.delete("/:id/attend", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const removed = await prisma.eventAttendee.deleteMany({ where: { eventId: id, userId: user.id } });
    if (removed.count > 0) {
      await prisma.event.update({ where: { id }, data: { attendeeCount: { decrement: 1 } } });
    }

    const fresh = await prisma.event.findUnique({ where: { id }, select: { attendeeCount: true } });
    return { attending: false, attendeeCount: Math.max(0, fresh?.attendeeCount ?? 0) };
  });

  // ------------------------------------------------------------ iptal / sil
  app.delete("/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, creatorId: true, title: true },
    });
    if (!event) throw notFound("Etkinlik bulunamadı");
    if (event.creatorId !== user.id && user.role !== "ADMIN") {
      throw forbidden("Bu etkinliği iptal etme yetkiniz yok");
    }

    await prisma.event.update({ where: { id }, data: { isCancelled: true } });

    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: id, userId: { not: user.id } },
      select: { userId: true },
    });
    await Promise.all(
      attendees.map((a) =>
        notify({
          userId: a.userId,
          type: "SYSTEM",
          actorId: user.id,
          text: `"${event.title}" etkinliği iptal edildi`,
          link: `/etkinlik/${id}`,
          entityId: id,
        }).catch(() => undefined),
      ),
    );

    return { cancelled: true };
  });
}
