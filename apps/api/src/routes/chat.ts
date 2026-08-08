import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SOCKET_EVENTS, createConversationSchema, sendMessageSchema } from "@kampus/shared";
import { prisma } from "../db";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { decodeCursor, encodeCursor, serializeMiniUser } from "../lib/serialize";
import { requireUser } from "../plugins/auth";
import { emitToConversation } from "../realtime/io";
import {
  assertMember,
  getOrCreateCommunityConversation,
  getOrCreateDirectConversation,
  markConversationRead,
  sendMessage,
  serializeMessage,
} from "../services/chat";
import { memberRole } from "../services/communities";

const idParam = z.object({ id: z.string().min(1) });

const CONVERSATION_INCLUDE = {
  members: {
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
    take: 30,
  },
  community: { select: { id: true, slug: true, name: true, avatarUrl: true } },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      replyTo: { select: { id: true, content: true, sender: { select: { displayName: true } } } },
      sharedPost: { select: { id: true, content: true, media: true, author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } },
    },
  },
} as const;

type ConversationRow = Awaited<
  ReturnType<typeof prisma.conversation.findFirstOrThrow<{ include: typeof CONVERSATION_INCLUDE }>>
>;

function serializeConversation(conversation: ConversationRow, viewerId: string, unreadCount: number) {
  const others = conversation.members.filter((m) => m.userId !== viewerId);
  const isDirect = conversation.type === "DIRECT";
  const peer = isDirect ? others[0]?.user : null;

  return {
    id: conversation.id,
    type: conversation.type,
    title: isDirect ? peer?.displayName ?? "Silinmiş kullanıcı" : conversation.title,
    avatarUrl: isDirect ? peer?.avatarUrl ?? null : conversation.avatarUrl,
    peerUsername: peer?.username ?? null,
    community: conversation.community,
    members: conversation.members.map((m) => serializeMiniUser(m.user)),
    lastMessage: conversation.messages[0] ? serializeMessage(conversation.messages[0]) : null,
    unreadCount,
    updatedAt: conversation.lastMessageAt.toISOString(),
  };
}

export default async function chatRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------ sohbet listesi
  app.get("/conversations", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(30) })
      .parse(request.query);

    const memberships = await prisma.conversationMember.findMany({
      where: { userId: user.id },
      select: { conversationId: true, lastReadAt: true },
    });
    if (memberships.length === 0) return { items: [] };

    const readMap = new Map(memberships.map((m) => [m.conversationId, m.lastReadAt]));

    const conversations = await prisma.conversation.findMany({
      where: { id: { in: memberships.map((m) => m.conversationId) } },
      include: CONVERSATION_INCLUDE,
      orderBy: { lastMessageAt: "desc" },
      take: limit,
    });

    const unreadCounts = await Promise.all(
      conversations.map((c) =>
        prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: user.id },
            deletedAt: null,
            createdAt: { gt: readMap.get(c.id) ?? new Date(0) },
          },
        }),
      ),
    );

    return {
      items: conversations.map((c, i) => serializeConversation(c, user.id, unreadCounts[i])),
      totalUnread: unreadCounts.reduce((a, b) => a + b, 0),
    };
  });

  // ------------------------------------------------------------ sohbet başlat
  app.post("/conversations", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const body = createConversationSchema.parse(request.body);

    if (body.type === "DIRECT") {
      if (body.memberIds.length !== 1) throw badRequest("Birebir sohbet için tek kullanıcı seçin");
      const conversation = await getOrCreateDirectConversation(user.id, body.memberIds[0]);
      const full = await prisma.conversation.findUniqueOrThrow({
        where: { id: conversation.id },
        include: CONVERSATION_INCLUDE,
      });
      reply.code(201);
      return { conversation: serializeConversation(full, user.id, 0) };
    }

    // Grup sohbeti
    const members = await prisma.user.findMany({
      where: { id: { in: body.memberIds }, status: "ACTIVE" },
      select: { id: true },
    });
    if (members.length === 0) throw badRequest("Geçerli kullanıcı bulunamadı");

    const conversation = await prisma.conversation.create({
      data: {
        type: "GROUP",
        title: body.title ?? "Grup sohbeti",
        members: {
          create: [{ userId: user.id }, ...members.filter((m) => m.id !== user.id).map((m) => ({ userId: m.id }))],
        },
      },
      include: CONVERSATION_INCLUDE,
    });

    reply.code(201);
    return { conversation: serializeConversation(conversation, user.id, 0) };
  });

  // ------------------------------------------------------------ topluluk sohbeti
  app.get("/conversations/community/:communityId", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { communityId } = z.object({ communityId: z.string() }).parse(request.params);

    const community = await prisma.community.findFirst({
      where: { OR: [{ id: communityId }, { slug: communityId }] },
      select: { id: true },
    });
    if (!community) throw notFound("Topluluk bulunamadı");

    const role = await memberRole(community.id, user.id);
    if (!role) throw forbidden("Topluluk sohbetine katılmak için üye olmalısınız");

    const conversation = await getOrCreateCommunityConversation(community.id);
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: conversation.id, userId: user.id } },
      update: {},
      create: { conversationId: conversation.id, userId: user.id },
    });

    const full = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: CONVERSATION_INCLUDE,
    });

    return { conversation: serializeConversation(full, user.id, 0) };
  });

  // ------------------------------------------------------------ tek sohbet
  app.get("/conversations/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    await assertMember(id, user.id);

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: CONVERSATION_INCLUDE,
    });

    return { conversation: serializeConversation(conversation, user.id, 0) };
  });

  // ------------------------------------------------------------ mesajlar
  app.get("/conversations/:id/messages", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const query = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(60).default(30),
      })
      .parse(request.query);

    await assertMember(id, user.id);
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      select: {
        type: true,
        members: { select: { userId: true, lastReadAt: true } },
      },
    });
    const cursor = decodeCursor(query.cursor);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(cursor ? { createdAt: { lt: cursor.date } } : {}),
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        replyTo: { select: { id: true, content: true, sender: { select: { displayName: true } } } },
        sharedPost: { select: { id: true, content: true, media: true, author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    const hasMore = messages.length > query.limit;
    const items = hasMore ? messages.slice(0, query.limit) : messages;
    const peerReadAt =
      conversation.type === "DIRECT"
        ? conversation.members.find((member) => member.userId !== user.id)?.lastReadAt ?? null
        : null;

    return {
      // İstemci eskiden yeniye sıralı bekliyor.
      items: items
        .slice()
        .reverse()
        .map((m) => ({
          ...serializeMessage(m),
          isMine: m.senderId === user.id,
          seenByPeer: m.senderId === user.id && !!peerReadAt && m.createdAt <= peerReadAt,
        })),
      nextCursor:
        hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
          : null,
    };
  });

  // ------------------------------------------------------------ mesaj gönder (REST yedeği)
  app.post("/conversations/:id/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const body = sendMessageSchema.parse(request.body);

    const result = await sendMessage({
      conversationId: id,
      senderId: user.id,
      content: body.content,
      attachments: body.attachments,
      replyToId: body.replyToId ?? null,
      sharedPostId: body.sharedPostId ?? null,
      clientNonce: body.clientNonce,
    });

    reply.code(result.duplicated ? 200 : 201);
    return { message: result.message };
  });

  // ------------------------------------------------------------ okundu
  app.post("/conversations/:id/read", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const readAt = await markConversationRead(id, user.id);
    emitToConversation(id, SOCKET_EVENTS.CONVERSATION_READ, {
      conversationId: id,
      userId: user.id,
      readAt: readAt.toISOString(),
    });
    return { ok: true };
  });

  // ------------------------------------------------------------ sessize al
  app.post("/conversations/:id/mute", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);
    const { muted } = z.object({ muted: z.boolean() }).parse(request.body);

    await assertMember(id, user.id);
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      data: { isMuted: muted },
    });
    return { muted };
  });

  // ------------------------------------------------------------ mesaj sil
  app.delete("/messages/:id", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const message = await prisma.message.findUnique({
      where: { id },
      select: { id: true, senderId: true, conversationId: true, deletedAt: true },
    });
    if (!message || message.deletedAt) throw notFound("Mesaj bulunamadı");
    if (message.senderId !== user.id && user.role !== "ADMIN") {
      throw forbidden("Sadece kendi mesajınızı silebilirsiniz");
    }

    await prisma.message.update({ where: { id }, data: { deletedAt: new Date(), content: "" } });
    emitToConversation(message.conversationId, SOCKET_EVENTS.MESSAGE_DELETED, {
      messageId: id,
      conversationId: message.conversationId,
    });

    return { deleted: true };
  });

  // ------------------------------------------------------------ gruptan ayrıl
  app.delete("/conversations/:id/leave", { preHandler: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const { id } = idParam.parse(request.params);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { type: true },
    });
    if (!conversation) throw notFound("Sohbet bulunamadı");
    if (conversation.type === "DIRECT") throw badRequest("Birebir sohbetten ayrılamazsınız");

    await prisma.conversationMember
      .delete({ where: { conversationId_userId: { conversationId: id, userId: user.id } } })
      .catch(() => undefined);

    return { left: true };
  });
}
