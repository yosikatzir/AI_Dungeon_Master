import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrock, withRetry } from "@/lib/ai/bedrock";
import { SUMMARIZER_MODEL, SCENE_PROMPT_MESSAGE_WINDOW } from "@/lib/ai/config";
import { getCampaign, getCampaignMembers, listRecentMessages } from "@/lib/campaigns";
import { getOnlineUserIds } from "@/lib/realtime/presence";

export interface ComposedScenePrompt {
  /** A self-contained visual description of the moment, ready to hand to the image model. */
  description: string;
  /** Exactly who appears, named as the party/NPC roster names them. */
  characters: string[];
}

function transcriptLine(m: {
  senderType: string;
  username: string | null;
  characterName: string | null;
  content: string;
}): string {
  if (m.senderType === "dm") return `DM: ${m.content}`;
  if (m.senderType === "player") return `${m.characterName ?? m.username ?? "Player"}: ${m.content}`;
  if (m.senderType === "roll") return `[Roll] ${m.content}`;
  return `[Event] ${m.content}`;
}

/**
 * Turns "illustrate what's happening right now" into a concrete image prompt
 * by asking the DM model itself.
 *
 * The naive alternative — reusing the campaign's stored `currentScene` — is
 * badly stale in practice: that field only changes when the DM chooses to
 * call its `advance_scene` tool, which it does far less often than the story
 * actually moves. A fight breaking out belowdecks would still illustrate the
 * bard's earlier performance up on deck, because no tool call had fired since.
 * The recent transcript is the real record of where the story is, and the
 * model that wrote it is the thing best placed to describe it visually and to
 * say who is actually in frame.
 *
 * Returns null on any failure — callers fall back to the stored scene rather
 * than losing the image entirely.
 */
export async function composeSceneImagePrompt(
  campaignId: number,
  playerHint?: string,
): Promise<ComposedScenePrompt | null> {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;

  const recent = listRecentMessages(campaignId, SCENE_PROMPT_MESSAGE_WINDOW, "story");
  if (recent.length === 0) return null;

  const onlineUserIds = new Set(getOnlineUserIds(campaignId));
  const members = getCampaignMembers(campaignId).filter(
    (m) => m.status === "active" && m.characterId !== null && m.characterName,
  );
  const presentNames = members.filter((m) => onlineUserIds.has(m.userId)).map((m) => m.characterName!);
  const absentNames = members.filter((m) => !onlineUserIds.has(m.userId)).map((m) => m.characterName!);

  const npcLines =
    campaign.npcRoster.length > 0
      ? campaign.npcRoster.map((n) => `- ${n.name}: ${n.description}`).join("\n")
      : "(none)";

  const hint = playerHint?.trim();

  const prompt = `You are the Dungeon Master of an ongoing D&D campaign. A player just asked for an illustration of what is happening right now. Write the description that will be handed to an image generator.

Base it on the MOST RECENT events in the transcript below — the last thing that actually happened, not where the session started. If the party moved somewhere new, or a fight broke out, or the situation changed, illustrate THAT.

Write the description as a single vivid paragraph of purely VISUAL detail: setting, who is present and what they are physically doing, lighting, mood, camera angle. Describe only what a viewer would see. Do not mention dice, rules, hit points, player names, or game mechanics. Do not narrate dialogue or events over time — capture one frozen moment.

Also list which characters are visible in that moment. Use their names EXACTLY as spelled in the rosters below, and include only characters genuinely present in the scene you are describing.

PARTY MEMBERS PRESENT THIS SESSION: ${presentNames.length > 0 ? presentNames.join(", ") : "(none)"}
PARTY MEMBERS OFF-SCREEN: ${absentNames.length > 0 ? absentNames.join(", ") : "(none)"}

NPC ROSTER:
${npcLines}

LAST KNOWN SCENE (may be out of date — the transcript wins if they disagree):
${campaign.currentScene || "(not set)"}

RECENT TRANSCRIPT (oldest first, the last line is the most recent):
${recent.map(transcriptLine).join("\n")}
${hint ? `\nThe player also asked specifically for: ${hint}\nHonor this within the current moment — it refines the shot (angle, focus, emphasis), it does not replace the scene.\n` : ""}
Respond with ONLY a JSON object of this exact shape:
{"description": string, "characters": string[]}`;

  try {
    // Same assistant-prefill trick as the summarizer: Bedrock/Claude has no
    // JSON response mode, so seeding the model's turn with "{" keeps it from
    // wrapping the object in prose or markdown fences.
    const completion = await withRetry(() =>
      bedrock.send(
        new ConverseCommand({
          modelId: SUMMARIZER_MODEL,
          messages: [
            { role: "user", content: [{ text: prompt }] },
            { role: "assistant", content: [{ text: "{" }] },
          ],
        }),
      ),
    );

    const continuation = completion.output?.message?.content
      ?.map((block) => block.text)
      .filter((text): text is string => Boolean(text))
      .join("");
    if (!continuation) return null;

    return parseComposedPrompt(`{${continuation}`);
  } catch {
    return null;
  }
}

/** Split out from the network call so the parsing/validation rules are unit-testable. */
export function parseComposedPrompt(json: string): ComposedScenePrompt | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { description, characters } = parsed as { description?: unknown; characters?: unknown };
  if (typeof description !== "string" || description.trim().length === 0) return null;

  const names = Array.isArray(characters)
    ? characters.filter((c): c is string => typeof c === "string" && c.trim().length > 0).map((c) => c.trim())
    : [];

  return { description: description.trim(), characters: names };
}
