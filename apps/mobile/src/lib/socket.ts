import { io, type Socket } from "socket.io-client";
import { API_URL, tokens } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = tokens.access();
  if (!token) return null;
  if (socket) return socket;

  socket = io(API_URL, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket"],
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
  });

  socket.on("connect_error", (err) => {
    if (err.message === "UNAUTHORIZED") disconnectSocket();
  });

  return socket;
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
