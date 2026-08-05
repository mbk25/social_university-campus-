import type { Server as SocketServer } from "socket.io";

let io: SocketServer | null = null;

export function setIo(instance: SocketServer) {
  io = instance;
}

export function getIo(): SocketServer | null {
  return io;
}

export const userRoom = (userId: string) => `user:${userId}`;
export const conversationRoom = (conversationId: string) => `conv:${conversationId}`;
export const communityRoom = (communityId: string) => `community:${communityId}`;
export const feedRoom = (universityId: string) => `uni:${universityId}`;

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function emitToUsers(userIds: string[], event: string, payload: unknown) {
  if (!io || userIds.length === 0) return;
  io.to(userIds.map(userRoom)).emit(event, payload);
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  io?.to(conversationRoom(conversationId)).emit(event, payload);
}

export function emitToCommunity(communityId: string, event: string, payload: unknown) {
  io?.to(communityRoom(communityId)).emit(event, payload);
}

/** Kullanıcının şu an bağlı olup olmadığı (çevrimiçi göstergesi). */
export async function isUserOnline(userId: string): Promise<boolean> {
  if (!io) return false;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  return sockets.length > 0;
}
