import type { Server as SocketIOServer, Socket } from "socket.io";
import { unsealSessionCookie, sessionOptions } from "@/lib/session";
import {
  getMembership,
  getCampaignMembers,
  addMessage,
  type CampaignMessage,
} from "@/lib/campaigns";
import { sendMessageSchema } from "@/lib/validation/campaign";

interface SocketData {
  userId: number;
  username: string;
}

type Ack = (res: { ok: true } | { error: string }) => void;

// In-memory only — fine for a single self-hosted process; presence resets on restart.
// campaignId -> userId -> set of live socket ids for that user
const presence = new Map<number, Map<number, Set<string>>>();

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    if (trimmed.slice(0, idx) === name) {
      return decodeURIComponent(trimmed.slice(idx + 1));
    }
  }
  return null;
}

function data(socket: Socket): SocketData {
  return socket.data as SocketData;
}

function broadcastPresence(
  io: SocketIOServer,
  campaignId: number,
  campaignPresence: Map<number, Set<string>>,
) {
  io.to(`campaign:${campaignId}`).emit("presence_update", {
    onlineUserIds: Array.from(campaignPresence.keys()),
  });
}

function emitMessage(io: SocketIOServer, message: CampaignMessage) {
  io.to(`campaign:${message.campaignId}`).emit("new_message", message);
}

export function registerSocketHandlers(io: SocketIOServer) {
  io.use(async (socket, next) => {
    const raw = getCookieValue(socket.handshake.headers.cookie, sessionOptions.cookieName!);
    const session = raw ? await unsealSessionCookie(raw) : null;
    if (!session) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data = { userId: session.userId, username: session.username } satisfies SocketData;
    next();
  });

  io.on("connection", (socket) => {
    let joinedCampaignId: number | null = null;

    socket.on("join_campaign", (campaignId: number, ack?: Ack) => {
      const membership = getMembership(campaignId, data(socket).userId);
      if (!membership || membership.status !== "active") {
        ack?.({ error: "Not a member of this campaign" });
        return;
      }

      joinedCampaignId = campaignId;
      socket.join(`campaign:${campaignId}`);

      let campaignPresence = presence.get(campaignId);
      if (!campaignPresence) {
        campaignPresence = new Map();
        presence.set(campaignId, campaignPresence);
      }
      const wasOffline = !campaignPresence.has(data(socket).userId);
      const sockets = campaignPresence.get(data(socket).userId) ?? new Set<string>();
      sockets.add(socket.id);
      campaignPresence.set(data(socket).userId, sockets);

      if (wasOffline) {
        emitMessage(
          io,
          addMessage({
            campaignId,
            senderType: "system",
            userId: null,
            characterId: null,
            content: `${data(socket).username} joined the session.`,
          }),
        );
        // A brand-new member's row wouldn't otherwise reach clients already
        // in the room until they refresh — push the current roster too.
        io.to(`campaign:${campaignId}`).emit("members_update", getCampaignMembers(campaignId));
      }

      broadcastPresence(io, campaignId, campaignPresence);
      ack?.({ ok: true });
    });

    socket.on("send_message", (payload: unknown, ack?: Ack) => {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: parsed.error.issues[0]?.message ?? "Invalid message" });
        return;
      }
      const { campaignId, content } = parsed.data;
      const membership = getMembership(campaignId, data(socket).userId);
      if (!membership || membership.status !== "active") {
        ack?.({ error: "Not a member of this campaign" });
        return;
      }

      emitMessage(
        io,
        addMessage({
          campaignId,
          senderType: "player",
          userId: data(socket).userId,
          characterId: membership.characterId,
          content,
        }),
      );
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      if (joinedCampaignId === null) return;
      const campaignPresence = presence.get(joinedCampaignId);
      if (!campaignPresence) return;

      const sockets = campaignPresence.get(data(socket).userId);
      if (!sockets) return;
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        campaignPresence.delete(data(socket).userId);
        emitMessage(
          io,
          addMessage({
            campaignId: joinedCampaignId,
            senderType: "system",
            userId: null,
            characterId: null,
            content: `${data(socket).username} left the session.`,
          }),
        );
      }

      broadcastPresence(io, joinedCampaignId, campaignPresence);
    });
  });
}
