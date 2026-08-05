import type { MediaAsset } from "@kampus/shared";
import { SOCKET_EVENTS } from "@kampus/shared";
import { prisma } from "../db";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { serializeMiniUser, toMedia } from "../lib/serialize";
import { notify } from "../lib/notify";
import { emitToConversation, emitToUsers } from "../realtime/io";

export function directKeyFor(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export async function assertMember(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { conversationId: true },
  });
  if (!membership) throw forbidden("Bu sohbete erişiminiz yok");
  return membership;
}

/** İki kullanıcı arasındaki DM'yi bulur, yoksa oluşturur. */
export async function getOrCreateDirectConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw badRequest("Kendinizle sohbet başlatamazsınız");

  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true, status: true },
  });
  if (!other || other.status !== "ACTIVE") throw notFound("Kullanıcı bulunamadı");

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    },
    select: { blockerId: true },
  });
  if (blocked) throw forbidden("Bu kullanıcıyla mesajlaşamazsınız");

  const key = directKeyFor(userId, otherUserId);
  const existing = await prisma.conversation.findUnique({ where: { directKey: key } });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      type: "DIRECT",
      directKey: key,
      members: { create: [{ userId }, { userId: otherUserId }] },
    },
  });
}

export function serializeMessage(message: {
  id: string;
  conversationId: string;
  content: string;
  attachments: unknown;
  createdAt: Date;
  deletedAt: Date | null;
  sender: { id: string; username: string; displayName: string; avatarUrl: string | null };
  replyTo?: { id: string; content: string; sender: { displayName: string } } | null;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: serializeMiniUser(message.sender),
    content: message.deletedAt ? "" : message.content,
    attachments: message.deletedAt ? [] : toMedia(message.attachments),
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.content.slice(0, 120),
          senderName: message.replyTo.sender.displayName,
        }
      : null,
    createdAt: message.createdAt.toISOString(),
    isDeleted: !!message.deletedAt,
  };
}

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  replyTo: { select: { id: true, content: true, sender: { select: { displayName: true } } } },
} as const;

export interface SendMessageArgs {
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: MediaAsset[];
  replyToId?: string | null;
  clientNonce?: string;
}

export async function sendMessage(args: SendMessageArgs) {
  await assertMember(args.conversationId, args.senderId);

  // Aynı nonce ile gelen tekrar denemesi -> mevcut mesajı döndür.
  if (args.clientNonce) {
    const duplicate = await prisma.message.findUnique({
      where: {
        conversationId_senderId_clientNonce: {
          conversationId: args.conversationId,
          senderId: args.senderId,
          clientNonce: args.clientNonce,
        },
      },
      include: MESSAGE_INCLUDE,
    });
    if (duplicate) return { message: serializeMessage(duplicate), duplicated: true };
  }

  if (args.replyToId) {
    const parent = await prisma.message.findFirst({
      where: { id: args.replyToId, conversationId: args.conversationId },
      select: { id: true },
    });
    if (!parent) throw badRequest("Yanıtlanan mesaj bulunamadı");
  }

  const created = await prisma.message.create({
    data: {
      conversationId: args.conversationId,
      senderId: args.senderId,
      content: args.content,
      attachments: (args.attachments ?? []) as object,
      replyToId: args.replyToId ?? null,
      clientNonce: args.clientNonce ?? null,
    },
    include: MESSAGE_INCLUDE,
  });

  await prisma.conversation.update({
    where: { id: args.conversationId },
    data: { lastMessageAt: created.createdAt },
  });

  const payload = serializeMessage(created);
  emitToConversation(args.conversationId, SOCKET_EVENTS.MESSAGE_NEW, payload);

  // Sohbet odasında olmayan üyeler için de listeyi tazele + bildirim üret.
  const members = await prisma.conversationMember.findMany({
    where: { conversationId: args.conversationId, userId: { not: args.senderId } },
    select: { userId: true, isMuted: true },
  });

  emitToUsers(
    members.map((m) => m.userId),
    SOCKET_EVENTS.CONVERSATION_UPDATED,
    { conversationId: args.conversationId, lastMessage: payload },
  );

  const conversation = await prisma.conversation.findUnique({
    where: { id: args.conversationId },
    select: { type: true, title: true, community: { select: { name: true } } },
  });

  const preview = created.content.slice(0, 60) || "📎 Dosya";
  const where =
    conversation?.type === "COMMUNITY"
      ? ` (${conversation.community?.name ?? "topluluk"})`
      : conversation?.type === "GROUP"
        ? ` (${conversation.title ?? "grup"})`
        : "";

  await Promise.all(
    members
      .filter((m) => !m.isMuted)
      .map((m) =>
        notify({
          userId: m.userId,
          type: "MESSAGE",
          actorId: args.senderId,
          text: `${created.sender.displayName}${where}: ${preview}`,
          link: `/mesajlar/${args.conversationId}`,
          entityId: args.conversationId,
        }).catch(() => undefined),
      ),
  );

  return { message: payload, duplicated: false };
}

export async function markConversationRead(conversationId: string, userId: string) {
  await assertMember(conversationId, userId);
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
}

/** Topluluğun sohbet odasını döndürür, yoksa oluşturur. */
export async function getOrCreateCommunityConversation(communityId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { communityId, type: "COMMUNITY" },
  });
  if (existing) return existing;

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, avatarUrl: true },
  });
  if (!community) throw notFound("Topluluk bulunamadı");

  const conversation = await prisma.conversation.create({
    data: {
      type: "COMMUNITY",
      communityId,
      title: community.name,
      avatarUrl: community.avatarUrl,
    },
  });

  // Mevcut üyeleri sohbete ekle
  const members = await prisma.communityMember.findMany({
    where: { communityId },
    select: { userId: true },
  });
  if (members.length > 0) {
    await prisma.conversationMember.createMany({
      data: members.map((m) => ({ conversationId: conversation.id, userId: m.userId })),
      skipDuplicates: true,
    });
  }

  return conversation;
}
