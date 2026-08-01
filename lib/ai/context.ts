import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getCampaign, getCampaignMembers, listRecentMessages, type Campaign } from "@/lib/campaigns";
import { resolveCharacter } from "@/lib/characters";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { getCombatState } from "@/lib/engine/combat";
import { getOnlineUserIds } from "@/lib/realtime/presence";
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

  const npcRosterText =
    campaign.npcRoster.length > 0
      ? campaign.npcRoster
          .map((n) => `- ${n.name}: ${n.description}${n.disposition ? ` (${n.disposition})` : ""}`)
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

function messageToChatParam(message: {
  senderType: string;
  username: string | null;
  characterName: string | null;
  content: string;
}): ChatCompletionMessageParam {
  if (message.senderType === "dm") {
    return { role: "assistant", content: message.content };
  }
  if (message.senderType === "player") {
    const speaker = message.characterName ?? message.username ?? "A player";
    return { role: "user", content: `${speaker}: ${message.content}` };
  }
  if (message.senderType === "roll") {
    return { role: "user", content: `[Roll result] ${message.content}` };
  }
  // system: presence/mutation notes — useful context, tagged so the model
  // doesn't mistake it for something a player said in character.
  return { role: "user", content: `[System] ${message.content}` };
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

export function assembleDmContext(
  campaignId: number,
  options: DmContextOptions = {},
): ChatCompletionMessageParam[] {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  const isMeta = options.channel === "meta";

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: isMeta ? buildMetaSystemPrompt() : buildDmSystemPrompt() },
    { role: "system", content: buildStateBlock(campaign) },
  ];

  if (campaign.summary) {
    messages.push({ role: "system", content: `ROLLING SUMMARY OF EARLIER EVENTS:\n${campaign.summary}` });
  }
  if (campaign.plotLog.length > 0) {
    messages.push({
      role: "system",
      content: `PLOT LOG:\n${campaign.plotLog.map((p) => `- ${p.summary}`).join("\n")}`,
    });
  }

  if (isMeta) {
    const recentMeta = listRecentMessages(campaignId, RECENT_MESSAGE_WINDOW, "meta");
    for (const message of recentMeta) {
      messages.push(messageToChatParam(message));
    }
  } else {
    const recent = listRecentMessages(campaignId, RECENT_MESSAGE_WINDOW, "story");
    for (const message of recent) {
      messages.push(messageToChatParam(message));
    }

    const recentTableTalk = listRecentMessages(campaignId, 10, "meta");
    if (recentTableTalk.length > 0) {
      messages.push({
        role: "system",
        content: `TABLE TALK (out-of-character — honor any DM rulings made here):\n${recentTableTalk
          .map(tableTalkLine)
          .join("\n")}`,
      });
    }
  }

  if (options.kickoffInstruction) {
    messages.push({ role: "user", content: options.kickoffInstruction });
  }

  return messages;
}
