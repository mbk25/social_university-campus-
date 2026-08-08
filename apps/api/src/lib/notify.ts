import type { NotificationType } from "@prisma/client";
import { SOCKET_EVENTS } from "@kampus/shared";
import { prisma } from "../db";
import { emitToUser } from "../realtime/io";
import { serializeMiniUser } from "./serialize";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  text: string;
  link?: string | null;
  entityId?: string | null;
}

/**
 * Bildirim oluşturur ve alıcı çevrimiçiyse anında iletir.
 * Kullanıcı kendi eylemi için bildirim almaz.
 */
export async function notify(input: NotifyInput): Promise<void> {
  // Mesajlar kendi sohbet akışında ve Mesajlar rozetiyle takip edilir; genel
  // sosyal bildirim merkezinde ikinci kez gösterilmez.
  if (input.type === "MESSAGE") return;

  if (input.actorId && input.actorId === input.userId) return;

  // Engellenmiş kullanıcıdan bildirim gitmesin.
  if (input.actorId) {
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: input.userId, blockedId: input.actorId },
          { blockerId: input.actorId, blockedId: input.userId },
        ],
      },
      select: { blockerId: true },
    });
    if (blocked) return;
  }

  const created = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      actorId: input.actorId ?? null,
      text: input.text,
      link: input.link ?? null,
      entityId: input.entityId ?? null,
    },
    include: {
      actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  emitToUser(input.userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
    id: created.id,
    type: created.type,
    actor: created.actor ? serializeMiniUser(created.actor) : null,
    text: created.text,
    link: created.link,
    isRead: false,
    createdAt: created.createdAt.toISOString(),
  });
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  await Promise.all(inputs.map((i) => notify(i).catch(() => undefined)));
}

/** @kullanıcı bahsedilenlere bildirim gönderir. */
export async function notifyMentions(opts: {
  usernames: string[];
  actorId: string;
  actorName: string;
  text: string;
  link: string;
  entityId: string;
}): Promise<void> {
  if (opts.usernames.length === 0) return;
  const users = await prisma.user.findMany({
    where: { username: { in: opts.usernames.slice(0, 10) }, status: "ACTIVE" },
    select: { id: true },
  });
  await notifyMany(
    users.map((u) => ({
      userId: u.id,
      type: "MENTION" as NotificationType,
      actorId: opts.actorId,
      text: opts.text,
      link: opts.link,
      entityId: opts.entityId,
    })),
  );
}

/** Karma (itibar) puanı ekler; rozet kontrolünü tetikler. */
export async function addKarma(userId: string, amount: number): Promise<void> {
  if (amount === 0) return;
  await prisma.user.update({ where: { id: userId }, data: { karma: { increment: amount } } });
}

/** Koşulu sağlanan rozetleri verir ve bildirir. */
export async function grantBadge(userId: string, code: string, label: string): Promise<void> {
  const existing = await prisma.userBadge.findUnique({
    where: { userId_code: { userId, code } },
    select: { code: true },
  });
  if (existing) return;

  await prisma.userBadge.create({ data: { userId, code } });
  await notify({
    userId,
    type: "BADGE_EARNED",
    text: `Yeni rozet kazandın: ${label}`,
    link: `/profil`,
    entityId: code,
  });
}
