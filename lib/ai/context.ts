import type { Message, SystemContentBlock } from "@aws-sdk/client-bedrock-runtime";
import { getCampaign, getCampaignMembers, listRecentMessages, type Campaign } from "@/lib/campaigns";
import { resolveCharacter } from "@/lib/characters";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { getCombatState } from "@/lib/engine/combat";
import { getOnlineUserIds } from "@/lib/realtime/presence";
import { formatNpcStatLine } from "@/lib/npcs";
import { buildDmSystemPrompt, buildMetaSystemPrompt } from "@/prompts/dm-system";
import { RECENT_MESSAGE_WINDOW } from "@/lib/ai/config";

/** Full text beyond this length is ellipsized — keeps a multi-character party from blowing the context budget every turn. */
export const APPEARANCE_MAX_CHARS = 300;
export const BACKSTORY_MAX_CHARS = 150;

export function truncateForContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

export interface PresentCharacterInfo {
  name: string;
  speciesName: string;
  className: string;
  backgroundName: string;
  level: number;
  alignment: string | null;
  hpCurrent: number;
  hpMax: number;
  armorClass: number;
  conditions: string[];
  appearance: string | null;
  backstory: string | null;
  playedBy: string;
}

/** One PRESENT-block entry: identity/stats line, plus appearance/backstory so
 *  NPCs can react to what a character actually looks like without the player
 *  having to narrate it themselves. */
export function formatPresentCharacterLine(info: PresentCharacterInfo): string {
  const conditionsText = info.conditions.length > 0 ? info.conditions.join(", ") : "none";
  const alignmentText = info.alignment ? `, ${info.alignment}` : "";
  const lines = [
    `${info.name} (${info.speciesName} ${info.className}, ${info.backgroundName} background, level ${info.level}${alignmentText}) — HP ${info.hpCurrent}/${info.hpMax}, AC ${info.armorClass}, conditions: ${conditionsText}. Played by ${info.playedBy}.`,
  ];
  if (info.appearance && info.appearance.trim()) {
    lines.push(`  Appearance: ${truncateForContext(info.appearance.trim(), APPEARANCE_MAX_CHARS)}`);
  }
  if (info.backstory && info.backstory.trim()) {
    lines.push(`  Backstory: ${truncateForContext(info.backstory.trim(), BACKSTORY_MAX_CHARS)}`);
  }
  return lines.join("\n");
}

function buildStateBlock(campaign: Campaign): string {
  const members = getCampaignMembers(campaign.id).filter((m) => m.status === "active");
  const onlineUserIds = new Set(getOnlineUserIds(campaign.id));

  const present: string[] = [];
  const absent: string[] = [];

  for (const member of members) {
    if (member.characterId === null) continue;
    const resolved = resolveCharacter(member.characterId);
    if (!resolved) continue;
    const sheet = computeCharacterSheet(resolved);

    if (onlineUserIds.has(member.userId)) {
      present.push(
        formatPresentCharacterLine({
          name: resolved.character.name,
          speciesName: resolved.species.name,
          className: resolved.klass.name,
          backgroundName: resolved.background.name,
          level: resolved.character.level,
          alignment: resolved.character.alignment,
          hpCurrent: resolved.character.hpCurrent,
          hpMax: sheet.hpMax,
          armorClass: sheet.armorClass,
          conditions: resolved.character.conditions,
          appearance: resolved.character.appearance,
          backstory: resolved.character.backstory,
          playedBy: member.username,
        }),
      );
    } else {
      absent.push(`${resolved.character.name} (off-screen this session)`);
    }
  }

  const combat = getCombatState(campaign.id);
  const combatText = combat.active
    ? `Combat is active. Initiative order: ${combat.turnOrder
        .map((t, i) => `${i + 1}. ${t.name} (${t.initiative})${i === combat.currentTurnIndex ? " ← current turn" : ""}`)
        .join("; ")}.`
    : "Not currently in combat.";

  // Statted NPCs get their numbers inline: these are the DCs and targets the
  // DM sets checks against, so they have to be visible every turn rather than
  // recalled or invented. Unstatted NPCs are flagged as such so the DM knows
  // it needs to stat them before rolling against them.
  const npcRosterText =
    campaign.npcRoster.length > 0
      ? campaign.npcRoster
          .map((n) => {
            const head = `- ${n.name}: ${n.description}${n.disposition ? ` (${n.disposition})` : ""}`;
            if (!n.stats) return `${head}\n    [no stats — cannot be rolled against yet]`;
            const lines = [`${head}\n    ${formatNpcStatLine(n)}`];
            if (n.stats.hpCurrent <= 0) lines.push(`    DEFEATED`);
            if (n.stats.actions?.length) {
              lines.push(
                ...n.stats.actions.map((a) => `    Action — ${a.name}: ${a.description}`),
              );
            }
            return lines.join("\n");
          })
          .join("\n")
      : "(none yet)";

  const questsText = campaign.activeQuests.length > 0 ? campaign.activeQuests.join("; ") : "(none yet)";

  return [
    `CAMPAIGN STATE`,
    `Party size: ${members.length}. Present this session: ${present.length}, off-screen: ${absent.length}.`,
    `PRESENT:\n${present.length > 0 ? present.join("\n") : "(no one with a character is currently online)"}`,
    absent.length > 0 ? `OFF-SCREEN:\n${absent.join("\n")}` : "",
    `Current scene: ${campaign.currentScene || "(the adventure has not begun yet)"}`,
    `Active quests: ${questsText}`,
    combatText,
    `NPC ROSTER:\n${npcRosterText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface RawTurn {
  role: "user" | "assistant";
  text: string;
}

function messageToRawTurn(message: {
  senderType: string;
  username: string | null;
  characterName: string | null;
  content: string;
}): RawTurn {
  if (message.senderType === "dm") {
    return { role: "assistant", text: message.content };
  }
  if (message.senderType === "player") {
    const speaker = message.characterName ?? message.username ?? "A player";
    return { role: "user", text: `${speaker}: ${message.content}` };
  }
  if (message.senderType === "roll") {
    return { role: "user", text: `[Roll result] ${message.content}` };
  }
  // system: presence/mutation notes — useful context, tagged so the model
  // doesn't mistake it for something a player said in character.
  return { role: "user", text: `[System] ${message.content}` };
}

/** Bedrock's Converse API requires strict user/assistant alternation and
 *  rejects consecutive same-role turns — unlike OpenAI's chat completions,
 *  which tolerates an arbitrary role sequence. Real multiplayer chat easily
 *  produces two "player" messages back-to-back with no DM reply between
 *  them, so consecutive same-role turns get folded into one message with
 *  multiple text blocks rather than sent as separate messages. Also drops a
 *  leading assistant turn, if any, since a conversation must start on user —
 *  losing one DM line from the verbatim recent-window edge is harmless (the
 *  rolling summary covers anything older anyway). */
function coalesceTurns(turns: RawTurn[]): Message[] {
  const messages: Message[] = [];
  for (const turn of turns) {
    const last = messages[messages.length - 1];
    if (last?.role === turn.role) {
      last.content!.push({ text: turn.text });
    } else {
      messages.push({ role: turn.role, content: [{ text: turn.text }] });
    }
  }
  if (messages[0]?.role === "assistant") messages.shift();
  return messages;
}

/** Plain "Speaker: content" rendering for the out-of-character table-talk
 *  block appended to story turns — deliberately not a ChatCompletionMessageParam
 *  since it's folded into one system message, not a real turn-by-turn transcript. */
function tableTalkLine(message: { senderType: string; username: string | null; characterName: string | null; content: string }): string {
  if (message.senderType === "dm") return `DM: ${message.content}`;
  const speaker = message.characterName ?? message.username ?? "A player";
  return `${speaker}: ${message.content}`;
}

export interface DmContextOptions {
  /** Appended as a final user turn — used to kick off a brand-new campaign with no messages yet. */
  kickoffInstruction?: string;
  /** "meta" assembles context for the out-of-character table-talk channel
   *  instead of the story: a different system prompt, the meta message
   *  history instead of the story's, and no restriction on which tools the
   *  caller passes (that's enforced by the caller using META_DM_TOOLS). */
  channel?: "story" | "meta";
}

export interface DmTurnContext {
  system: SystemContentBlock[];
  messages: Message[];
}

export function assembleDmContext(campaignId: number, options: DmContextOptions = {}): DmTurnContext {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  const isMeta = options.channel === "meta";

  const system: SystemContentBlock[] = [
    { text: isMeta ? buildMetaSystemPrompt() : buildDmSystemPrompt() },
    { text: buildStateBlock(campaign) },
  ];

  if (campaign.summary) {
    system.push({ text: `ROLLING SUMMARY OF EARLIER EVENTS:\n${campaign.summary}` });
  }
  if (campaign.plotLog.length > 0) {
    system.push({ text: `PLOT LOG:\n${campaign.plotLog.map((p) => `- ${p.summary}`).join("\n")}` });
  }

  const turns: RawTurn[] = [];

  if (isMeta) {
    const recentMeta = listRecentMessages(campaignId, RECENT_MESSAGE_WINDOW, "meta");
    for (const message of recentMeta) {
      turns.push(messageToRawTurn(message));
    }
  } else {
    const recent = listRecentMessages(campaignId, RECENT_MESSAGE_WINDOW, "story");
    for (const message of recent) {
      turns.push(messageToRawTurn(message));
    }

    const recentTableTalk = listRecentMessages(campaignId, 10, "meta");
    if (recentTableTalk.length > 0) {
      // Background context, not a conversation turn — goes in `system` like
      // the summary/plot log, since Converse has no mid-conversation system role.
      system.push({
        text: `TABLE TALK (out-of-character — honor any DM rulings made here):\n${recentTableTalk
          .map(tableTalkLine)
          .join("\n")}`,
      });
    }
  }

  const messages = coalesceTurns(turns);

  if (options.kickoffInstruction) {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      last.content!.push({ text: options.kickoffInstruction });
    } else {
      messages.push({ role: "user", content: [{ text: options.kickoffInstruction }] });
    }
  }

  return { system, messages };
}
