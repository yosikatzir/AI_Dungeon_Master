import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { openai, withRetry, AiError } from "@/lib/ai/openai";
import { DM_MODEL, MAX_TOOL_ITERATIONS } from "@/lib/ai/config";
import { assembleDmContext, type DmContextOptions } from "@/lib/ai/context";
import { DM_TOOLS, executeTool } from "@/lib/ai/tools";
import { addMessage, getCampaign, type CampaignMessage, type PendingRollRequest } from "@/lib/campaigns";
import { getIoInstance } from "@/lib/realtime/ioInstance";
import { maybeSummarize } from "@/lib/ai/summarize";

function roomName(campaignId: number): string {
  return `campaign:${campaignId}`;
}

function broadcastMessage(campaignId: number, message: CampaignMessage): void {
  getIoInstance()?.to(roomName(campaignId)).emit("new_message", message);
}

function setDmTyping(campaignId: number, typing: boolean): void {
  getIoInstance()?.to(roomName(campaignId)).emit("dm_typing", { typing });
}

/** Reveals the DM's already-generated narration a few words at a time, so it reads as a live typing effect. */
async function streamNarration(campaignId: number, message: CampaignMessage): Promise<void> {
  const io = getIoInstance();
  if (!io) return;
  const room = roomName(campaignId);

  io.to(room).emit("dm_stream_start", { id: message.id });

  const words = message.content.split(/(\s+)/);
  let accumulated = "";
  const CHUNK_WORDS = 3;
  for (let i = 0; i < words.length; i += CHUNK_WORDS * 2) {
    accumulated += words.slice(i, i + CHUNK_WORDS * 2).join("");
    io.to(room).emit("dm_stream_chunk", { id: message.id, text: accumulated });
    await new Promise((resolve) => setTimeout(resolve, 45));
  }

  io.to(room).emit("dm_stream_end", { message });
}

/**
 * Runs one full DM turn: assembles context, loops through tool calls the
 * model makes (executing each via the game engine and feeding the result
 * back), and streams the final narration once the model has nothing more to
 * do mechanically. request_roll / request_image_confirmation end the turn
 * early — the DM waits for the player, and a fresh turn gets triggered once
 * they respond (a roll comes in, or a message is sent).
 */
export async function runDmTurn(
  campaignId: number,
  options: DmContextOptions = {},
): Promise<string | null> {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;

  setDmTyping(campaignId, true);
  try {
    const messages: ChatCompletionMessageParam[] = assembleDmContext(campaignId, options);
    let finalContent: string | null = null;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const completion = await withRetry(() =>
        openai.chat.completions.create({
          model: DM_MODEL,
          messages,
          tools: DM_TOOLS,
          tool_choice: "auto",
        }),
      );

      const responseMessage = completion.choices[0]?.message;
      if (!responseMessage) break;
      messages.push(responseMessage);

      const toolCalls = responseMessage.tool_calls?.filter((tc) => tc.type === "function") ?? [];
      if (toolCalls.length === 0) {
        finalContent = responseMessage.content ?? "";
        break;
      }

      let turnShouldEnd = false;
      for (const toolCall of toolCalls) {
        let resultText: string;
        let broadcastContent: string | undefined;
        let endTurn: boolean | undefined;
        let rollRequest: PendingRollRequest | undefined;

        try {
          const result = await executeTool(campaignId, toolCall.function.name, toolCall.function.arguments);
          resultText = result.resultText;
          broadcastContent = result.broadcastContent;
          endTurn = result.endTurn;
          rollRequest = result.rollRequest;
        } catch (err) {
          resultText = err instanceof Error ? `Error: ${err.message}` : "Tool failed unexpectedly.";
        }

        messages.push({ role: "tool", tool_call_id: toolCall.id, content: resultText });

        if (broadcastContent) {
          broadcastMessage(
            campaignId,
            addMessage({
              campaignId,
              senderType: "system",
              userId: null,
              characterId: null,
              content: broadcastContent,
            }),
          );
        }
        if (rollRequest) {
          getIoInstance()?.to(roomName(campaignId)).emit("roll_requested", rollRequest);
        }
        if (endTurn) turnShouldEnd = true;
      }

      if (turnShouldEnd) {
        finalContent = responseMessage.content ?? null;
        break;
      }
    }

    if (finalContent && finalContent.trim().length > 0) {
      const dmMessage = addMessage({
        campaignId,
        senderType: "dm",
        userId: null,
        characterId: null,
        content: finalContent.trim(),
      });
      await streamNarration(campaignId, dmMessage);
      await maybeSummarize(campaignId).catch(() => {});
      return dmMessage.content;
    }
  } catch (err) {
    const userFacing =
      err instanceof AiError ? err.userFacing : "The DM hit a snag and will pick back up shortly.";
    broadcastMessage(
      campaignId,
      addMessage({ campaignId, senderType: "system", userId: null, characterId: null, content: userFacing }),
    );
  } finally {
    setDmTyping(campaignId, false);
  }

  return null;
}
