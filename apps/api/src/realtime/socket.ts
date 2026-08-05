import type { Server as HttpServer } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import { SOCKET_EVENTS, sendMessageSchema } from "@kampus/shared";
import { corsOrigins } from "../env";
import { prisma } from "../db";
import { verifyAccessToken } from "../lib/tokens";
import {
  assertMember,
  markConversationRead,
  sendMessage,
} from "../services/chat";
import { conversationRoom, setIo, userRoom } from "./io";

interface SocketData {
  userId: string;
  username: string;
  displayName: string;
}

/** Olay adları çalışma zamanında SOCKET_EVENTS'ten geldiği için serbest bırakılıyor. */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type LooseEvents = Record<string, (...args: any[]) => void>;
type AppSocket = Socket<LooseEvents, LooseEvents, LooseEvents, SocketData>;

/** Basit token-bucket: kullanıcı başına saniyede N olay. */
class RateBucket {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private limit: number, private windowMs: number) {}

  allow(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  clear(key: string) {
    this.hits.delete(key);
  }
}

const messageLimiter = new RateBucket(10, 10_000); // 10 sn'de 10 mesaj
const typingLimiter = new RateBucket(20, 10_000);

export function setupSocket(server: HttpServer): SocketServer {
  const io = new SocketServer(server, {
    cors: { origin: corsOrigins, credentials: true },
    path: "/socket.io",
    maxHttpBufferSize: 1e6,
    pingTimeout: 25_000,
  });

  // ---- Kimlik doğrulama
  io.use(async (socket: AppSocket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);

      if (!token) return next(new Error("UNAUTHORIZED"));

      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, displayName: true, status: true },
      });
      if (!user || user.status !== "ACTIVE") return next(new Error("UNAUTHORIZED"));

      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.displayName = user.displayName;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", async (socket: AppSocket) => {
    const { userId } = socket.data;
    socket.join(userRoom(userId));

    // Kullanıcının tüm sohbet odalarına otomatik katıl (bildirim rozetleri için).
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
      take: 200,
    });
    for (const m of memberships) socket.join(conversationRoom(m.conversationId));

    socket.broadcast.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, online: true });

    // ---- Sohbete katıl / ayrıl
    socket.on(SOCKET_EVENTS.JOIN_CONVERSATION, async (conversationId: unknown, ack?: (r: unknown) => void) => {
      if (typeof conversationId !== "string") return;
      try {
        await assertMember(conversationId, userId);
        socket.join(conversationRoom(conversationId));
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: "FORBIDDEN" });
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Bu sohbete erişiminiz yok" });
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_CONVERSATION, (conversationId: unknown) => {
      if (typeof conversationId === "string") socket.leave(conversationRoom(conversationId));
    });

    // ---- Mesaj gönder
    socket.on(
      SOCKET_EVENTS.SEND_MESSAGE,
      async (raw: unknown, ack?: (r: unknown) => void) => {
        if (!messageLimiter.allow(userId)) {
          ack?.({ ok: false, error: "RATE_LIMITED" });
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Çok hızlı mesaj gönderiyorsunuz" });
          return;
        }

        const input = raw as { conversationId?: unknown } | null;
        const conversationId = input?.conversationId;
        if (typeof conversationId !== "string") {
          ack?.({ ok: false, error: "BAD_REQUEST" });
          return;
        }

        const parsed = sendMessageSchema.safeParse(raw);
        if (!parsed.success) {
          ack?.({ ok: false, error: "VALIDATION", issues: parsed.error.issues });
          return;
        }

        try {
          const result = await sendMessage({
            conversationId,
            senderId: userId,
            content: parsed.data.content,
            attachments: parsed.data.attachments,
            replyToId: parsed.data.replyToId ?? null,
            clientNonce: parsed.data.clientNonce,
          });
          ack?.({ ok: true, message: result.message });
        } catch (err) {
          ack?.({ ok: false, error: (err as Error).message });
          socket.emit(SOCKET_EVENTS.ERROR, { message: (err as Error).message });
        }
      },
    );

    // ---- Yazıyor göstergesi
    socket.on(SOCKET_EVENTS.TYPING, (raw: unknown) => {
      const data = raw as { conversationId?: unknown; isTyping?: unknown };
      if (typeof data?.conversationId !== "string") return;
      if (!typingLimiter.allow(userId)) return;
      socket.to(conversationRoom(data.conversationId)).emit(SOCKET_EVENTS.TYPING_UPDATE, {
        conversationId: data.conversationId,
        userId,
        displayName: socket.data.displayName,
        isTyping: data.isTyping !== false,
      });
    });

    // ---- Okundu bilgisi
    socket.on(SOCKET_EVENTS.MARK_READ, async (conversationId: unknown) => {
      if (typeof conversationId !== "string") return;
      await markConversationRead(conversationId, userId).catch(() => undefined);
    });

    socket.on("disconnect", async () => {
      const remaining = await io.in(userRoom(userId)).fetchSockets();
      if (remaining.length === 0) {
        socket.broadcast.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, online: false });
        messageLimiter.clear(userId);
        typingLimiter.clear(userId);
        prisma.user
          .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);
      }
    });
  });

  setIo(io);
  return io;
}
