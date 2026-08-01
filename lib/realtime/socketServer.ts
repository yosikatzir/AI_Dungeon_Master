import type { Server as SocketIOServer, Socket } from "socket.io";
import { unsealSessionCookie, sessionOptions } from "@/lib/session";
import {
  getMembership,
  getCampaignMembers,
  addMessage,
  getCampaign,
  setPendingRollRequest,
  setPendingImageConfirmation,
  type CampaignMessage,
} from "@/lib/campaigns";
import { getCharacterRecord } from "@/lib/characters";
import { sendMessageSchema } from "@/lib/validation/campaign";
import {
  rollDiceSchema,
  hpMutationSchema,
  spellSlotSchema,
  longRestSchema,
  campaignIdSchema,
  requestImageSchema,
} from "@/lib/validation/engine";
import { performRoll, formatRollOutcome } from "@/lib/engine/rolls";
import {
  applyDamage,
  applyHealing,
  consumeSpellSlot,
  longRest,
  EngineValidationError,
} from "@/lib/engine/mutations";
import { rollInitiative, nextTurn, endCombat, getCombatState } from "@/lib/engine/combat";
import { getCampaignPresence } from "@/lib/realtime/presence";
import { runDmTurn } from "@/lib/ai/dm";
import type { DmContextOptions } from "@/lib/ai/context";
import { generateCampaignImage } from "@/lib/ai/images";
import { AiError } from "@/lib/ai/openai";

function triggerDmTurn(campaignId: number, options?: DmContextOptions) {
  runDmTurn(campaignId, options).catch((err) => {
    console.error(`DM turn failed for campaign ${campaignId}:`, err);
  });
}

interface SocketData {
  userId: number;
  username: string;
}

type Ack = (res: { ok: true } | { error: string }) => void;

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

function emitCharacterUpdate(io: SocketIOServer, campaignId: number, characterId: number) {
  io.to(`campaign:${campaignId}`).emit("character_update", { characterId });
}

/** Every mechanical action requires active campaign membership; character-affecting
 *  actions are further restricted to the player's own enrolled character — there's
 *  no DM yet to act on anyone else's behalf. */
function requireOwnCharacterInCampaign(
  socket: Socket,
  campaignId: number,
  characterId: number,
): string | null {
  const membership = getMembership(campaignId, data(socket).userId);
  if (!membership || membership.status !== "active") {
    return "Not a member of this campaign";
  }
  const character = getCharacterRecord(characterId);
  if (!character || character.userId !== data(socket).userId) {
    return "That's not your character";
  }
  if (character.isDeleted) {
    return "That character has been deleted";
  }
  return null;
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

      const campaignPresence = getCampaignPresence(campaignId);
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

    socket.on("roll_dice", (payload: unknown, ack?: Ack) => {
      const parsed = rollDiceSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: parsed.error.issues[0]?.message ?? "Invalid roll request" });
        return;
      }
      const { campaignId, characterId, purpose } = parsed.data;

      const membership = getMembership(campaignId, data(socket).userId);
      if (!membership || membership.status !== "active") {
        ack?.({ error: "Not a member of this campaign" });
        return;
      }
      if (characterId !== null) {
        const err = requireOwnCharacterInCampaign(socket, campaignId, characterId);
        if (err) {
          ack?.({ error: err });
          return;
        }
      }

      try {
        const outcome = performRoll(characterId, purpose);
        emitMessage(
          io,
          addMessage({
            campaignId,
            senderType: "roll",
            userId: data(socket).userId,
            characterId,
            content: formatRollOutcome(outcome),
            rollData: outcome,
          }),
        );

        const campaign = getCampaign(campaignId);
        if (campaign?.pendingRollRequest?.characterId === characterId) {
          setPendingRollRequest(campaignId, null);
          io.to(`campaign:${campaignId}`).emit("roll_requested", null);
        }
        triggerDmTurn(campaignId);

        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: err instanceof EngineValidationError ? err.message : "Roll failed" });
      }
    });

    socket.on("apply_damage", (payload: unknown, ack?: Ack) => {
      const parsed = hpMutationSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
        return;
      }
      const { campaignId, characterId, amount } = parsed.data;
      const err = requireOwnCharacterInCampaign(socket, campaignId, characterId);
      if (err) {
        ack?.({ error: err });
        return;
      }
      try {
        const character = getCharacterRecord(characterId)!;
        const result = applyDamage(characterId, amount);
        emitMessage(
          io,
          addMessage({
            campaignId,
            senderType: "system",
            userId: null,
            characterId,
            content: `${character.name} takes ${amount} damage (${result.hpCurrent}/${result.hpMax} HP${result.tempHp > 0 ? `, ${result.tempHp} temp` : ""}).`,
          }),
        );
        emitCharacterUpdate(io, campaignId, characterId);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ error: e instanceof EngineValidationError ? e.message : "Could not apply damage" });
      }
    });

    socket.on("apply_healing", (payload: unknown, ack?: Ack) => {
      const parsed = hpMutationSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
        return;
      }
      const { campaignId, characterId, amount } = parsed.data;
      const err = requireOwnCharacterInCampaign(socket, campaignId, characterId);
      if (err) {
        ack?.({ error: err });
        return;
      }
      try {
        const character = getCharacterRecord(characterId)!;
        const result = applyHealing(characterId, amount);
        emitMessage(
          io,
          addMessage({
            campaignId,
            senderType: "system",
            userId: null,
            characterId,
            content: `${character.name} regains ${amount} HP (${result.hpCurrent}/${result.hpMax}).`,
          }),
        );
        emitCharacterUpdate(io, campaignId, characterId);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ error: e instanceof EngineValidationError ? e.message : "Could not apply healing" });
      }
    });

    socket.on("consume_spell_slot", (payload: unknown, ack?: Ack) => {
      const parsed = spellSlotSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
        return;
      }
      const { campaignId, characterId, level } = parsed.data;
      const err = requireOwnCharacterInCampaign(socket, campaignId, characterId);
      if (err) {
        ack?.({ error: err });
        return;
      }
      try {
        const character = getCharacterRecord(characterId)!;
        consumeSpellSlot(characterId, level);
        emitMessage(
          io,
          addMessage({
            campaignId,
            senderType: "system",
            userId: null,
            characterId,
            content: `${character.name} expends a level ${level} spell slot.`,
          }),
        );
        emitCharacterUpdate(io, campaignId, characterId);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ error: e instanceof EngineValidationError ? e.message : "Could not consume spell slot" });
      }
    });

    socket.on("long_rest", (payload: unknown, ack?: Ack) => {
      const parsed = longRestSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
        return;
      }
      const { campaignId, characterId } = parsed.data;
      const err = requireOwnCharacterInCampaign(socket, campaignId, characterId);
      if (err) {
        ack?.({ error: err });
        return;
      }
      const character = getCharacterRecord(characterId)!;
      longRest(characterId);
      emitMessage(
        io,
        addMessage({
          campaignId,
          senderType: "system",
          userId: null,
          characterId,
          content: `${character.name} takes a long rest and recovers fully.`,
        }),
      );
      emitCharacterUpdate(io, campaignId, characterId);
      ack?.({ ok: true });
    });

    socket.on("roll_initiative", (payload: unknown, ack?: Ack) => {
      const parsed = campaignIdSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: "Invalid request" });
        return;
      }
      const { campaignId } = parsed.data;
      const membership = getMembership(campaignId, data(socket).userId);
      if (!membership || membership.status !== "active") {
        ack?.({ error: "Not a member of this campaign" });
        return;
      }
      const state = rollInitiative(campaignId);
      io.to(`campaign:${campaignId}`).emit("combat_update", state);
      emitMessage(
        io,
        addMessage({
          campaignId,
          senderType: "system",
          userId: null,
          characterId: null,
          content: `Initiative rolled: ${state.turnOrder.map((t) => `${t.name} (${t.initiative})`).join(", ")}.`,
        }),
      );
      ack?.({ ok: true });
    });

    socket.on("next_turn", (payload: unknown, ack?: Ack) => {
      const parsed = campaignIdSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: "Invalid request" });
        return;
      }
      const { campaignId } = parsed.data;
      const membership = getMembership(campaignId, data(socket).userId);
      if (!membership || membership.status !== "active") {
        ack?.({ error: "Not a member of this campaign" });
        return;
      }
      try {
        const state = nextTurn(campaignId);
        io.to(`campaign:${campaignId}`).emit("combat_update", state);
        ack?.({ ok: true });
      } catch {
        ack?.({ error: "No active combat" });
      }
    });

    socket.on("end_combat", (payload: unknown, ack?: Ack) => {
      const parsed = campaignIdSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: "Invalid request" });
        return;
      }
      const { campaignId } = parsed.data;
      const membership = getMembership(campaignId, data(socket).userId);
      if (!membership || membership.status !== "active") {
        ack?.({ error: "Not a member of this campaign" });
        return;
      }
      endCombat(campaignId);
      io.to(`campaign:${campaignId}`).emit("combat_update", getCombatState(campaignId));
      emitMessage(
        io,
        addMessage({
          campaignId,
          senderType: "system",
          userId: null,
          characterId: null,
          content: "Combat has ended.",
        }),
      );
      ack?.({ ok: true });
    });

    async function generateAndPostImage(
      campaignId: number,
      subject: string,
      kind: "scene" | "npc" | "map",
    ) {
      const room = `campaign:${campaignId}`;
      io.to(room).emit("image_generating", { generating: true });
      try {
        // If the subject names a present character, pass their portrait as a
        // reference so generated art stays visually consistent with them.
        const members = getCampaignMembers(campaignId).filter(
          (m) => m.status === "active" && m.characterId !== null,
        );
        const matchedMember = members.find((m) =>
          subject.toLowerCase().includes((m.characterName ?? "").toLowerCase()),
        );
        const subjectTags = [subject.toLowerCase()];
        if (matchedMember?.characterName) subjectTags.push(matchedMember.characterName.toLowerCase());

        const { filePath } = await generateCampaignImage({
          campaignId,
          kind,
          subject,
          subjectTags,
          characterIdForReference: matchedMember?.characterId ?? undefined,
        });

        emitMessage(
          io,
          addMessage({
            campaignId,
            senderType: "system",
            userId: null,
            characterId: null,
            content: `Illustrated: ${subject}`,
            imagePath: filePath,
          }),
        );
      } catch (err) {
        const userFacing = err instanceof AiError ? err.userFacing : "Could not generate that image.";
        emitMessage(
          io,
          addMessage({
            campaignId,
            senderType: "system",
            userId: null,
            characterId: null,
            content: userFacing,
          }),
        );
      } finally {
        io.to(room).emit("image_generating", { generating: false });
      }
    }

    socket.on("request_image", (payload: unknown, ack?: Ack) => {
      const parsed = requestImageSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
        return;
      }
      const { campaignId, subject, kind } = parsed.data;
      const membership = getMembership(campaignId, data(socket).userId);
      if (!membership || membership.status !== "active") {
        ack?.({ error: "Not a member of this campaign" });
        return;
      }
      ack?.({ ok: true });
      generateAndPostImage(campaignId, subject, kind);
    });

    socket.on("confirm_image", (payload: unknown, ack?: Ack) => {
      const parsed = campaignIdSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: "Invalid request" });
        return;
      }
      const { campaignId } = parsed.data;
      const membership = getMembership(campaignId, data(socket).userId);
      if (!membership || membership.status !== "active") {
        ack?.({ error: "Not a member of this campaign" });
        return;
      }
      const campaign = getCampaign(campaignId);
      const request = campaign?.pendingImageConfirmation;
      if (!request) {
        ack?.({ error: "No pending image to confirm" });
        return;
      }
      setPendingImageConfirmation(campaignId, null);
      io.to(`campaign:${campaignId}`).emit("image_confirmation_requested", null);
      ack?.({ ok: true });
      generateAndPostImage(campaignId, request.subject, request.kind);
    });

    socket.on("dismiss_image_confirmation", (payload: unknown, ack?: Ack) => {
      const parsed = campaignIdSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: "Invalid request" });
        return;
      }
      const { campaignId } = parsed.data;
      setPendingImageConfirmation(campaignId, null);
      io.to(`campaign:${campaignId}`).emit("image_confirmation_requested", null);
      ack?.({ ok: true });
    });

    socket.on("send_message", (payload: unknown, ack?: Ack) => {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ error: parsed.error.issues[0]?.message ?? "Invalid message" });
        return;
      }
      const { campaignId, content, channel, askDm } = parsed.data;
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
          channel,
        }),
      );

      // Table talk never advances the story on its own — only an explicit
      // "Ask the DM" triggers a (separately tool-restricted) meta turn.
      if (channel === "story") {
        triggerDmTurn(campaignId);
      } else if (askDm) {
        triggerDmTurn(campaignId, { channel: "meta" });
      }
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      if (joinedCampaignId === null) return;
      const campaignPresence = getCampaignPresence(joinedCampaignId);

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
