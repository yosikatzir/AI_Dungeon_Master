import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getCampaign, getCampaignMembers, listRecentMessages, type Campaign } from "@/lib/campaigns";
import { resolveCharacter } from "@/lib/characters";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { getCombatState } from "@/lib/engine/combat";
import { getOnlineUserIds } from "@/lib/realtime/presence";
import { buildDmSystemPrompt } from "@/prompts/dm-system";
import { RECENT_MESSAGE_WINDOW } from "@/lib/ai/config";

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
    const conditionsText =
      resolved.character.conditions.length > 0 ? resolved.character.conditions.join(", ") : "none";
    const line = `${resolved.character.name} (${resolved.species.name} ${resolved.klass.name}, level ${resolved.character.level}) — HP ${resolved.character.hpCurrent}/${sheet.hpMax}, AC ${sheet.armorClass}, conditions: ${conditionsText}. Played by ${member.username}.`;

    if (onlineUserIds.has(member.userId)) {
      present.push(line);
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

export interface DmContextOptions {
  /** Appended as a final user turn — used to kick off a brand-new campaign with no messages yet. */
  kickoffInstruction?: string;
}

export function assembleDmContext(
  campaignId: number,
  options: DmContextOptions = {},
): ChatCompletionMessageParam[] {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildDmSystemPrompt() },
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

  const recent = listRecentMessages(campaignId, RECENT_MESSAGE_WINDOW);
  for (const message of recent) {
    messages.push(messageToChatParam(message));
  }

  if (options.kickoffInstruction) {
    messages.push({ role: "user", content: options.kickoffInstruction });
  }

  return messages;
}
