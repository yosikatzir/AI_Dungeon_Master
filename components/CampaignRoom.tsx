"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Socket } from "socket.io-client";
import { connectCampaignSocket } from "@/lib/realtime/socketClient";
import type {
  Campaign,
  CampaignMember,
  CampaignMessage,
  PendingRollRequest,
  PendingImageConfirmation,
} from "@/lib/campaigns";
import DiceTray, { type RollPurpose } from "@/components/DiceTray";
import CharacterQuickPanel, { type QuickPanelCharacter } from "@/components/CharacterQuickPanel";
import InitiativeTracker, { type CombatStateProps } from "@/components/InitiativeTracker";
import IllustrateButton from "@/components/IllustrateButton";
import VoiceRecordButton from "@/components/VoiceRecordButton";

interface Props {
  campaign: Campaign;
  initialMembers: CampaignMember[];
  initialMessages: CampaignMessage[];
  myCharacters: { id: number; name: string }[];
  myUserId: number;
  myUsername: string;
  myMembership: CampaignMember | null;
}

type Ack = (res: { ok: true } | { error: string }) => void;

const EMPTY_COMBAT: CombatStateProps = { active: false, turnOrder: [], currentTurnIndex: 0 };
const VOICE_CONFIRM_SECONDS = 3;

export default function CampaignRoom({
  campaign,
  initialMembers,
  initialMessages,
  myCharacters,
  myUserId,
  myMembership,
}: Props) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [members, setMembers] = useState(initialMembers);
  const [messages, setMessages] = useState(initialMessages);
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [joined, setJoined] = useState(myMembership?.status === "active");
  const [quickCharacter, setQuickCharacter] = useState<QuickPanelCharacter | null>(null);
  const [combat, setCombat] = useState<CombatStateProps>(EMPTY_COMBAT);
  const [dmTyping, setDmTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<{ id: number; content: string } | null>(null);
  const [pendingRollRequest, setPendingRollRequest] = useState<PendingRollRequest | null>(
    campaign.pendingRollRequest,
  );
  const [pendingImageConfirmation, setPendingImageConfirmation] = useState<PendingImageConfirmation | null>(
    campaign.pendingImageConfirmation,
  );
  const [imageGenerating, setImageGenerating] = useState(false);
  const [voiceCountdown, setVoiceCountdown] = useState<number | null>(null);

  const myCharacterId = myMembership?.characterId ?? null;

  const refreshQuickCharacter = useCallback(async () => {
    if (!myCharacterId) return;
    const res = await fetch(`/api/characters/${myCharacterId}`);
    if (!res.ok) return;
    const data = await res.json();
    setQuickCharacter({
      id: data.character.id,
      name: data.character.name,
      hpCurrent: data.character.hpCurrent,
      tempHp: data.character.tempHp,
      hpMax: data.sheet.hpMax,
      spellSlots: data.sheet.spellSlots
        ? { max: data.sheet.spellSlots.max, used: data.sheet.spellSlots.used }
        : null,
    });
  }, [myCharacterId]);

  useEffect(() => {
    if (joined) refreshQuickCharacter();
  }, [joined, refreshQuickCharacter]);

  // router.refresh() re-fetches this page's server data (e.g. after enrolling)
  // and delivers it as a fresh `initialMembers` prop — sync it into state.
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    const socket = connectCampaignSocket();
    socketRef.current = socket;

    socket.on("connect_error", () => setConnectionError("Could not connect. Retrying…"));
    socket.on("connect", () => setConnectionError(null));

    socket.on("new_message", (message: CampaignMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("presence_update", (payload: { onlineUserIds: number[] }) => {
      setOnlineUserIds(payload.onlineUserIds);
    });

    socket.on("members_update", (updated: CampaignMember[]) => {
      setMembers(updated);
    });

    socket.on("combat_update", (state: CombatStateProps) => {
      setCombat(state);
    });

    socket.on("character_update", (payload: { characterId: number }) => {
      if (payload.characterId === myCharacterId) refreshQuickCharacter();
    });

    socket.on("dm_typing", (payload: { typing: boolean }) => {
      setDmTyping(payload.typing);
    });

    socket.on("dm_stream_start", (payload: { id: number }) => {
      setStreamingMessage({ id: payload.id, content: "" });
    });

    socket.on("dm_stream_chunk", (payload: { id: number; text: string }) => {
      setStreamingMessage({ id: payload.id, content: payload.text });
    });

    socket.on("dm_stream_end", (payload: { message: CampaignMessage }) => {
      setStreamingMessage(null);
      setMessages((prev) =>
        prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message],
      );
    });

    socket.on("roll_requested", (request: PendingRollRequest | null) => {
      setPendingRollRequest(request);
    });

    socket.on("image_confirmation_requested", (request: PendingImageConfirmation | null) => {
      setPendingImageConfirmation(request);
    });

    socket.on("image_generating", (payload: { generating: boolean }) => {
      setImageGenerating(payload.generating);
    });

    if (joined) {
      socket.emit("join_campaign", campaign.id, (res: { ok: true } | { error: string }) => {
        if ("error" in res) setConnectionError(res.error);
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [campaign.id, joined, myCharacterId, refreshQuickCharacter]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, streamingMessage]);

  function emit(event: string, payload: unknown) {
    socketRef.current?.emit(event, payload, (res: { ok: true } | { error: string }) => {
      if (res && "error" in res) setConnectionError(res.error);
    });
  }

  async function handleEnroll(characterId: number | null) {
    await fetch(`/api/campaigns/${campaign.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId }),
    });
    setJoined(true);
    router.refresh();
  }

  async function handleLeave() {
    socketRef.current?.disconnect();
    await fetch(`/api/campaigns/${campaign.id}/leave`, { method: "POST" });
    router.push("/campaigns");
  }

  function clearVoiceTimer() {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    setVoiceCountdown(null);
  }

  function sendMessage() {
    const content = draft.trim();
    if (!content || !socketRef.current) return;
    clearVoiceTimer();
    const ack: Ack = (res) => {
      if ("error" in res) setConnectionError(res.error);
    };
    socketRef.current.emit("send_message", { campaignId: campaign.id, content }, ack);
    setDraft("");
  }

  function handleTranscribed(text: string) {
    setDraft(text);
    clearVoiceTimer();
    let secondsLeft = VOICE_CONFIRM_SECONDS;
    setVoiceCountdown(secondsLeft);
    voiceTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearVoiceTimer();
        sendMessage();
      } else {
        setVoiceCountdown(secondsLeft);
      }
    }, 1000);
  }

  function handleRoll(purpose: RollPurpose) {
    emit("roll_dice", { campaignId: campaign.id, characterId: myCharacterId, purpose });
  }

  function handleIllustrateRequest(subject: string) {
    emit("request_image", { campaignId: campaign.id, subject, kind: "scene" });
  }

  function confirmImage() {
    emit("confirm_image", { campaignId: campaign.id });
  }

  function dismissImageConfirmation() {
    emit("dismiss_image_confirmation", { campaignId: campaign.id });
  }

  if (!joined) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-serif text-2xl text-amber-100">{campaign.name}</h1>
        <p className="mt-2 text-sm text-amber-200/60">
          Join this campaign to see the session and chat live with the party.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {myCharacters.map((c) => (
            <button
              key={c.id}
              onClick={() => handleEnroll(c.id)}
              className="rounded border border-amber-700/40 px-4 py-2 text-left text-sm text-amber-100 hover:bg-amber-900/30"
            >
              Join as {c.name}
            </button>
          ))}
          <button
            onClick={() => handleEnroll(null)}
            className="rounded border border-amber-700/40 px-4 py-2 text-left text-sm text-amber-200/70 hover:bg-amber-900/30"
          >
            Join without a character (spectate)
          </button>
        </div>
      </main>
    );
  }

  const myPendingRequest =
    pendingRollRequest && pendingRollRequest.characterId === myCharacterId ? pendingRollRequest : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl gap-4 px-6 py-6">
      <aside className="w-56 shrink-0 border-r border-amber-800/30 pr-4">
        <h2 className="font-serif text-lg text-amber-100">{campaign.name}</h2>
        <p className="text-xs text-amber-200/50">
          {campaign.mode === "surprise" ? "DM surprise" : "Guided"}
        </p>

        <h3 className="mt-4 text-xs uppercase tracking-wide text-amber-200/50">Party</h3>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {members
            .filter((m) => m.status === "active")
            .map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-amber-100">
                <span
                  className={`h-2 w-2 rounded-full ${onlineUserIds.includes(m.userId) ? "bg-green-500" : "bg-gray-600"}`}
                />
                {m.characterName ?? m.username}
                {m.userId === myUserId && <span className="text-amber-200/40"> (you)</span>}
              </li>
            ))}
        </ul>

        <div className="mt-4">
          <InitiativeTracker
            combat={combat}
            onRollInitiative={() => emit("roll_initiative", { campaignId: campaign.id })}
            onNextTurn={() => emit("next_turn", { campaignId: campaign.id })}
            onEndCombat={() => emit("end_combat", { campaignId: campaign.id })}
          />
        </div>

        <Link
          href={`/campaigns/${campaign.id}/gallery`}
          className="mt-4 block text-xs text-amber-300 underline"
        >
          Image gallery
        </Link>

        {connectionError && <p className="mt-3 text-xs text-red-400">{connectionError}</p>}

        <button
          onClick={handleLeave}
          className="mt-6 rounded border border-red-800/40 px-3 py-1 text-xs text-red-300 hover:bg-red-950/30"
        >
          Leave campaign
        </button>
      </aside>

      <section className="flex flex-1 flex-col">
        <div ref={logRef} className="flex-1 overflow-y-auto rounded border border-amber-800/30 p-4">
          {messages.length === 0 && !streamingMessage && (
            <p className="text-sm text-amber-200/40">No messages yet. Say hello!</p>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((m) =>
              streamingMessage?.id === m.id ? null : (
                <div key={m.id} className="text-sm">
                  {m.imagePath && (
                    <a href={`/api/images/${m.imagePath}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served from an authenticated internal API route */}
                      <img
                        src={`/api/images/${m.imagePath}`}
                        alt={m.content}
                        className="mb-1 max-w-sm rounded-lg border border-amber-800/40"
                      />
                    </a>
                  )}
                  {m.senderType === "system" ? (
                    <span className="italic text-amber-200/40">{m.content}</span>
                  ) : m.senderType === "roll" ? (
                    <span className="text-purple-300">🎲 {m.content}</span>
                  ) : m.senderType === "dm" ? (
                    <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 font-serif leading-relaxed text-amber-100/90">
                      {m.content}
                    </div>
                  ) : (
                    <>
                      <span className="text-amber-300">
                        {m.characterName ?? m.username ?? "Unknown"}:
                      </span>{" "}
                      <span className="text-amber-100">{m.content}</span>
                    </>
                  )}
                </div>
              ),
            )}

            {streamingMessage && (
              <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 font-serif leading-relaxed text-amber-100/90">
                {streamingMessage.content}
                <span className="animate-pulse">▍</span>
              </div>
            )}

            {dmTyping && !streamingMessage && (
              <p className="text-xs italic text-amber-200/40">The DM is thinking…</p>
            )}

            {imageGenerating && (
              <p className="text-xs italic text-amber-200/40">Painting the scene…</p>
            )}
          </div>
        </div>

        {pendingImageConfirmation && (
          <div className="mt-3 flex items-center justify-between rounded border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-sm">
            <span className="text-amber-100">
              Illustrate: {pendingImageConfirmation.subject}?
            </span>
            <div className="flex gap-2">
              <button
                onClick={confirmImage}
                disabled={imageGenerating}
                className="rounded bg-amber-700 px-3 py-1 text-xs text-amber-50 hover:bg-amber-600 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={dismissImageConfirmation}
                className="rounded border border-amber-700/40 px-3 py-1 text-xs text-amber-200/70"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        <div className="mt-3">
          <DiceTray
            hasCharacter={myCharacterId !== null}
            pendingRequest={myPendingRequest}
            onRoll={handleRoll}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <IllustrateButton disabled={imageGenerating} onRequest={handleIllustrateRequest} />
          <VoiceRecordButton campaignId={campaign.id} onTranscribed={handleTranscribed} />
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              clearVoiceTimer();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Say something…"
            className="flex-1 rounded border border-amber-700/40 bg-black/30 px-3 py-2 text-amber-50"
          />
          <button
            onClick={sendMessage}
            className="rounded bg-amber-700 px-4 py-2 text-sm text-amber-50 hover:bg-amber-600"
          >
            Send
          </button>
        </div>
        {voiceCountdown !== null && (
          <p className="mt-1 text-xs text-amber-300">
            Sending in {voiceCountdown}s — edit above to change it, or send now.
          </p>
        )}
      </section>

      {quickCharacter && (
        <aside className="w-64 shrink-0 border-l border-amber-800/30 pl-4">
          <CharacterQuickPanel
            character={quickCharacter}
            onDamage={(amount) => emit("apply_damage", { campaignId: campaign.id, characterId: quickCharacter.id, amount })}
            onHeal={(amount) => emit("apply_healing", { campaignId: campaign.id, characterId: quickCharacter.id, amount })}
            onConsumeSlot={(level) => emit("consume_spell_slot", { campaignId: campaign.id, characterId: quickCharacter.id, level })}
            onLongRest={() => emit("long_rest", { campaignId: campaign.id, characterId: quickCharacter.id })}
          />
        </aside>
      )}
    </main>
  );
}
