import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createNoteSchema, rateNoteSchema } from "@kampus/shared";
import { prisma } from "../db";
import { forbidden, notFound } from "../lib/errors";
import { addKarma, grantBadge } from "../lib/notify";
import { serializeMiniUser, serializeUniversity, toMedia } from "../lib/serialize";
import { requireUser } from "../plugins/auth";

const idParam = z.object({ id: z.string().min(1) });

const NOTE_INCLUDE = {
  uploader: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  university: { select: { id: true, name: true, shortName: true, city: true, type: true } },
} as const;

type NoteRow = Awaited<
  ReturnType<typeof prisma.note.findFirstOrThrow<{ include: typeof NOTE_INCLUDE }>>
>;

function serializeNote(note: NoteRow, viewer?: { myRating: number | null; canDelete: boolean }) {
  return {
    id: note.id,
    title: note.title,
    description: note.description,
    courseCode: note.courseCode,
    courseName: note.courseName,
    department: note.department,
    visibility: note.visibility,
    files: toMedia(note.files),
    uploader: serializeMiniUser(note.uploader),
    university: serializeUniversity(note.university),
    downloadCount: note.downloadCount,
    ratingAvg: note.ratingCount > 0 ? Number((note.ratingSum / note.ratingCount).toFixed(2)) : 0,
    ratingCount: note.ratingCount,
    createdAt: note.createdAt.toISOString(),
    ...(viewer ? { viewer } : {}),
  };
}

export default async function noteRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ listeleme
  app.get("/", { preHandler: app.optionalAuth }, async (request) => {
    const user = request.user;
    const query = z
      .object({
        q: z.string().trim().max(80).optional(),
        courseCode: z.string().trim().max(20).optional(),
        department: z.string().trim().max(80).optional(),
        scope: z.enum(["ALL", "UNIVERSITY", "MINE"]).default("ALL"),
        sort: z.enum(["NEW", "TOP", "DOWNLOADS"]).default("NEW"),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(request.query);

    const and: Prisma.NoteWhereInput[] = [{ deletedAt: null }];

    // Üniversiteye özel notları sadece o üniversitenin öğrencileri görür.
    if (user?.role !== "ADMIN") {
      and.push({
        OR: [
          { visibility: "GLOBAL" },
          ...(user?.universityId
            ? [{ visibility: "UNIVERSITY" as const, universityId: user.universityId }]
            : []),
        ],
      });
    }

    if (query.scope === "UNIVERSITY") {
      if (!user?.universityId) throw forbidden("Üniversite bilgisi yok");
      and.push({ universityId: user.universityId });
    }
    if (query.scope === "MINE") {
      const me = requireUser(request);
      and.push({ uploaderId: me.id });
    }
    if (query.courseCode) {
      and.push({ courseCode: { equals: query.courseCode, mode: "insensitive" } });
    }
    if (query.department) and.push({ department: query.department });
    if (query.q) {
      and.push({
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { courseName: { contains: query.q, mode: "insensitive" } },
          { courseCode: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.NoteWhereInput = { AND: and };
    const orderBy: Prisma.NoteOrderByWithRelationInput[] =
      query.sort === "DOWNLOADS"
        ? [{ downloadCount: "desc" }]
        : query.sort === "TOP"
          ? [{ ratingSum: "desc" }, { ratingCount: "desc" }]
          : [{ createdAt: "desc" }];

    const [total, notes] = await Promise.all([
      prisma.note.count({ where }),
      prisma.note.findMany({
        where,
        include: {
          ...NOTE_INCLUDE,
          ...(user ? { ratings: { where: { userId: user.id }, select: { rating: true } } } : {}),
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: notes.map((n) =>
        serializeNote(n, {
          myRating: (n as { ratings?: { rating: number }[] }).ratings?.[0]?.rating ?? null,
          canDelete: n.uploaderId === user?.id || user?.role === "ADMIN",
        }),
      ),
      total,
      hasMore: query.page * query.limit < total,
    };
  });

  // ------------------------------------------------------------ popüler dersler
  app.get("/courses", { preHandler: app.optionalAuth }, async (request) => {
    const user = request.user;
    const grouped = await prisma.note.groupBy({
      by: ["courseCode", "courseName"],
      where: {
        deletedAt: null,
        ...(user?.universityId
          ? {
              OR: [
                { visibility: "GLOBAL" as const },
                { universityId: user.universityId },
              ],
            }
          : { visibility: "GLOBAL" }),
      },
      _count: { _all: true },
      orderBy: { _count: { courseName: "desc" } },
      take: 20,
    });

    return {
      items: grouped.map((g) => ({
        courseCode: g.courseCode,
        courseName: g.courseName,
        noteCount: g._count._all,
      })),
    };
  });

  // ------------------------------------------------------------ tek not
  app.get("/:id", { preHandler: app.optionalAuth }, async (request) => {
    const { id } = idParam.parse(request.params);
    const user = request.user;

    const note = await prisma.note.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...NOTE_INCLUDE,
        ...(user ? { ratings: { where: { userId: user.id }, select: { rating: true } } } : {}),
      },
    });
    if (!note) throw notFound("Not bulunamadı");

    if (
      note.visibility === "UNIVERSITY" &&
      note.universityId !== user?.universityId &&
      user?.role !== "ADMIN"
    ) {
      throw forbidden("Bu not yalnızca kendi üniversitesinin öğrencilerine açık");
    }

    return {
      note: serializeNote(note, {
        myRating: (note as { ratings?: { rating: number }[] }).ratings?.[0]?.rating ?? null,
        canDelete: note.uploaderId === user?.id || user?.role === "ADMIN",
      }),
    };
  });

  // ------------------------------------------------------------ yükle
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const body = createNoteSchema.parse(request.body);

    const note = await prisma.note.create({
      data: {
        title: body.title,
        description: body.description,
        courseCode: body.courseCode?.toUpperCase(),
        courseName: body.courseName,
        department: body.department ?? user.department,
        visibility: body.visibility,
        files: body.files as object,
        uploaderId: user.id,
        universityId: user.universityId,
      },
      include: NOTE_INCLUDE,
    });

    await addKarma(user.id, 5);
    const count = await prisma.note.count({ where: { uploaderId: user.id, deletedAt: null } });
    if (count >= 10) await grantBadge(user.id, "NOTE_HERO", "Not Kahramanı");

    reply.code(201);
    return { note: serializeNote(note, { myRating: null, canDelete: true }) };
  });

  // ------------------------------------------------------------ indirme sayacı
  app.post("/:id/download", { preHandler: app.authenticate }, async (request) => {
    const { id } = idParam.parse(request.params);
    const note = await prisma.note.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, files: true, visibility: true, universityId: true, uploaderId: true },
    });
    if (!note) throw notFound("Not bulunamadı");

    const user = requireUser(request);
    if (
      note.visibility === "UNIVERSITY" &&
      note.universityId !== user.universityId &&
      user.role !== "ADMIN"
    ) {
      throw forbidden("Bu nota erişiminiz yok");
    }

    await prisma.note.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
    if (note.uploaderId !== user.id) await addKarma(note.uploaderId, 1);

    return { files: toMedia(note.files) };
  });

  // ------------------------------------------------------------ puanla
  app.post("/:id/rate", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const { rating } = rateNoteSchema.parse(request.body);

    const note = await prisma.note.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, uploaderId: true },
    });
    if (!note) throw notFound("Not bulunamadı");
    if (note.uploaderId === user.id) throw forbidden("Kendi notunuzu puanlayamazsınız");

    const existing = await prisma.noteRating.findUnique({
      where: { noteId_userId: { noteId: id, userId: user.id } },
      select: { rating: true },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.noteRating.update({
          where: { noteId_userId: { noteId: id, userId: user.id } },
          data: { rating },
        }),
        prisma.note.update({
          where: { id },
          data: { ratingSum: { increment: rating - existing.rating } },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.noteRating.create({ data: { noteId: id, userId: user.id, rating } }),
        prisma.note.update({
          where: { id },
          data: { ratingSum: { increment: rating }, ratingCount: { increment: 1 } },
        }),
      ]);
    }

    const fresh = await prisma.note.findUniqueOrThrow({
      where: { id },
      select: { ratingSum: true, ratingCount: true },
    });

    return {
      myRating: rating,
      ratingAvg: fresh.ratingCount > 0 ? Number((fresh.ratingSum / fresh.ratingCount).toFixed(2)) : 0,
      ratingCount: fresh.ratingCount,
    };
  });

  // ------------------------------------------------------------ sil
  app.delete("/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const note = await prisma.note.findFirst({
      where: { id, deletedAt: null },
      select: { uploaderId: true },
    });
    if (!note) throw notFound("Not bulunamadı");
    if (note.uploaderId !== user.id && user.role !== "ADMIN") {
      throw forbidden("Bu notu silme yetkiniz yok");
    }

    await prisma.note.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  });
}
