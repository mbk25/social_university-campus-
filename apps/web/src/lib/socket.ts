"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL, tokens } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = tokens.access();
  if (!token) return null;

  if (socket?.connected || socket?.active) {
    return socket;
  }

  socket = io(API_URL, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
    reconnectionDelay: 800,
  });

  // Erişim jetonu yenilendiğinde bağlantıyı da tazele.
  socket.on("connect_error", (err) => {
    if (err.message === "UNAUTHORIZED") {
      socket?.disconnect();
      socket = null;
    }
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Oturum değişince soketi sıfırla. */
if (typeof window !== "undefined") {
  window.addEventListener("kampus:auth-changed", () => {
    if (!tokens.access()) disconnectSocket();
  });
}
