import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrock, withRetry } from "@/lib/ai/bedrock";
import { SUMMARIZER_MODEL, SUMMARIZE_EVERY_N_MESSAGES } from "@/lib/ai/config";
import { getCampaign, listMessagesAfter, updateCampaignMemory, type NpcRosterEntry } from "@/lib/campaigns";

interface SummarizerOutput {
  summary: string;
  npcRoster: NpcRosterEntry[];
  newPlotEvents: string[];
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
 * Never send full history to the model. Once enough new messages have
 * piled up since the last summary, fold them into the rolling summary
 * (and update the NPC roster / plot log) so the DM's context stays small
 * while still "remembering" the whole campaign.
 */
export async function maybeSummarize(campaignId: number): Promise<void> {
  const campaign = getCampaign(campaignId);
  if (!campaign) return;

  const newMessages = listMessagesAfter(campaignId, campaign.lastSummarizedMessageId);
  if (newMessages.length < SUMMARIZE_EVERY_N_MESSAGES) return;

  const transcript = newMessages.map(transcriptLine).join("\n");

  const prompt = `You maintain the persistent memory for an AI Dungeon Master running a D&D campaign. You're given the existing rolling summary, the existing NPC roster, and a new stretch of session transcript. Produce an updated memory state.

Rules:
- The updated summary should read as a concise narrative recap (a paragraph or two total, not a blow-by-blow) that folds the new events into the existing summary — don't just append, actually rewrite for concision.
- The updated NPC roster should merge: keep existing NPCs (updating them if the transcript develops them further), add any new named NPCs introduced, don't duplicate. Do NOT include the player characters themselves (the party) — the roster is only for NPCs the DM controls: townsfolk, monsters, allies, villains, and the like.
- List any new plot events from this stretch worth remembering long-term (decisions made, secrets learned, promises given) — omit anything trivial.

EXISTING SUMMARY:
${campaign.summary || "(none yet — this is the first summarization pass)"}

EXISTING NPC ROSTER (JSON):
${JSON.stringify(campaign.npcRoster)}

NEW TRANSCRIPT TO FOLD IN:
${transcript}

Respond with ONLY a JSON object of this exact shape:
{"summary": string, "npcRoster": [{"name": string, "description": string, "disposition": string}], "newPlotEvents": string[]}`;

  // Bedrock/Claude has no response_format:"json_object" mode like OpenAI's.
  // Standard workaround: seed the model's own turn with an opening "{" (the
  // "assistant prefill" technique) so it continues valid JSON from there
  // rather than wrapping the object in prose or markdown fences.
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
  if (!continuation) return;

  let parsed: SummarizerOutput;
  try {
    parsed = JSON.parse(`{${continuation}`);
  } catch {
    return; // a malformed summary shouldn't take down the DM turn that triggered it
  }

  const plotLog = [
    ...campaign.plotLog,
    ...(parsed.newPlotEvents ?? []).map((summary) => ({ summary, createdAt: new Date().toISOString() })),
  ];

  updateCampaignMemory(campaignId, {
    summary: parsed.summary,
    npcRoster: mergeRosterPreservingStats(campaign.npcRoster, parsed.npcRoster),
    plotLog,
    lastSummarizedMessageId: newMessages[newMessages.length - 1].id,
  });
}

/**
 * The summarizer rewrites NPC prose, but it is never shown stat blocks and
 * cannot return them — so its roster is merged over the existing one by name
 * rather than replacing it. Without this, every summarization pass would
 * silently strip the numbers the DM rolls against, and a wounded monster would
 * come back at full health with no AC.
 */
export function mergeRosterPreservingStats(
  existing: NpcRosterEntry[],
  incoming: NpcRosterEntry[] | undefined,
): NpcRosterEntry[] {
  if (!incoming || incoming.length === 0) return existing;
  const statsByName = new Map(
    existing.filter((n) => n.stats).map((n) => [n.name.toLowerCase(), n.stats!]),
  );
  return incoming.map((entry) => {
    const stats = statsByName.get(entry.name.toLowerCase());
    return stats ? { ...entry, stats } : entry;
  });
}
