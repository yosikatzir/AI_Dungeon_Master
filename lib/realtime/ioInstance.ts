import type { Server as SocketIOServer } from "socket.io";

// server.ts creates the one Socket.IO server instance for the process and
// registers it here so plain Next.js API routes (which don't otherwise have
// a reference to it — e.g. the campaign-creation route kicking off the DM's
// opening scene) can still broadcast to a campaign room.
let io: SocketIOServer | null = null;

export function setIoInstance(instance: SocketIOServer): void {
  io = instance;
}

export function getIoInstance(): SocketIOServer | null {
  return io;
}
