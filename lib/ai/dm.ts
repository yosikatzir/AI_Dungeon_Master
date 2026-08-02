import { ConverseCommand, type Message, type ContentBlock, type ToolUseBlock } from "@aws-sdk/client-bedrock-runtime";
import { bedrock, withRetry } from "@/lib/ai/bedrock";
import { AiError } from "@/lib/ai/errors";
import { DM_MODEL, MAX_TOOL_ITERATIONS } from "@/lib/ai/config";
import { assembleDmContext, type DmContextOptions } from "@/lib/ai/context";
import { DM_TOOLS, META_DM_TOOLS, executeTool } from "@/lib/ai/tools";
import {
  addMessage,
  getCampaign,
  type CampaignMessage,
  type PendingRollRequest,
  type PendingImageConfirmation,
} from "@/lib/campaigns";
import { getIoInstance } from "@/lib/realtime/ioInstance";
import { maybeSummarize } from "@/lib/ai/summarize";

function roomName(campaignId: number): string {
  return `campaign:${campaignId}`;
}

function broadcastMessage(campaignId: number, message: CampaignMessage): void {
  getIoInstance()?.to(roomName(campaignId)).emit("new_message", message);
}

function setDmTyping(campaignId: number, typing: boolean, channel: "story" | "meta" = "story"): void {
  getIoInstance()?.to(roomName(campaignId)).emit("dm_typing", { typing, channel });
}

/** Reveals the DM's already-generated narration a few words at a time, so it reads as a live typing effect. */
async function streamNarration(campaignId: number, message: CampaignMessage): Promise<void> {
  const io = getIoInstance();
  if (!io) return;
  const room = roomName(campaignId);

  io.to(room).emit("dm_stream_start", { id: message.id, channel: message.channel });

  const words = message.content.split(/(\s+)/);
  let accumulated = "";
  const CHUNK_WORDS = 3;
  for (let i = 0; i < words.length; i += CHUNK_WORDS * 2) {
    accumulated += words.slice(i, i + CHUNK_WORDS * 2).join("");
    io.to(room).emit("dm_stream_chunk", { id: message.id, text: accumulated, channel: message.channel });
    await new Promise((resolve) => setTimeout(resolve, 45));
  }

  io.to(room).emit("dm_stream_end", { message });
}

function extractText(message?: Message): string {
  if (!message?.content) return "";
  return message.content
    .map((block) => block.text)
    .filter((text): text is string => Boolean(text))
    .join("");
}

function extractToolUses(message?: Message): ToolUseBlock[] {
  if (!message?.content) return [];
  return message.content
    .map((block) => block.toolUse)
    .filter((toolUse): toolUse is ToolUseBlock => toolUse !== undefined);
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

  const channel: "story" | "meta" = options.channel === "meta" ? "meta" : "story";
  const tools = channel === "meta" ? META_DM_TOOLS : DM_TOOLS;

  setDmTyping(campaignId, true, channel);
  try {
    const { system, messages } = assembleDmContext(campaignId, options);
    let finalContent: string | null = null;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const completion = await withRetry(() =>
        bedrock.send(
          new ConverseCommand({
            modelId: DM_MODEL,
            system,
            messages,
            toolConfig: { tools },
          }),
        ),
      );

      const responseMessage = completion.output?.message;
      if (!responseMessage) break;
      messages.push(responseMessage);

      const toolUses = extractToolUses(responseMessage);
      if (completion.stopReason !== "tool_use" || toolUses.length === 0) {
        finalContent = extractText(responseMessage);
        break;
      }

      let turnShouldEnd = false;
      const toolResultBlocks: ContentBlock[] = [];

      for (const toolCall of toolUses) {
        let resultText: string;
        let broadcastContent: string | undefined;
        let endTurn: boolean | undefined;
        let rollRequest: PendingRollRequest | undefined;
        let imageConfirmation: PendingImageConfirmation | undefined;
        let status: "success" | "error" = "success";

        try {
          const result = await executeTool(
            campaignId,
            toolCall.name ?? "",
            (toolCall.input as Record<string, unknown>) ?? {},
          );
          resultText = result.resultText;
          broadcastContent = result.broadcastContent;
          endTurn = result.endTurn;
          rollRequest = result.rollRequest;
          imageConfirmation = result.imageConfirmation;
        } catch (err) {
          status = "error";
          resultText = err instanceof Error ? `Error: ${err.message}` : "Tool failed unexpectedly.";
        }

        toolResultBlocks.push({
          toolResult: { toolUseId: toolCall.toolUseId ?? "", content: [{ text: resultText }], status },
        });

        if (broadcastContent) {
          broadcastMessage(
            campaignId,
            addMessage({
              campaignId,
              senderType: "system",
              userId: null,
              characterId: null,
              content: broadcastContent,
              channel,
            }),
          );
        }
        if (rollRequest) {
          getIoInstance()?.to(roomName(campaignId)).emit("roll_requested", rollRequest);
        }
        if (imageConfirmation) {
          getIoInstance()?.to(roomName(campaignId)).emit("image_confirmation_requested", imageConfirmation);
        }
        if (endTurn) turnShouldEnd = true;
      }

      // Bedrock groups all of one turn's tool results into a single user
      // message (unlike OpenAI's one "tool"-role message per call).
      messages.push({ role: "user", content: toolResultBlocks });

      if (turnShouldEnd) {
        finalContent = extractText(responseMessage);
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
        channel,
      });
      await streamNarration(campaignId, dmMessage);
      if (channel === "story") {
        await maybeSummarize(campaignId).catch(() => {});
      }
      return dmMessage.content;
    }
  } catch (err) {
    const userFacing =
      err instanceof AiError ? err.userFacing : "The DM hit a snag and will pick back up shortly.";
    broadcastMessage(
      campaignId,
      addMessage({
        campaignId,
        senderType: "system",
        userId: null,
        characterId: null,
        content: userFacing,
        channel,
      }),
    );
  } finally {
    setDmTyping(campaignId, false, channel);
  }

  return null;
}
