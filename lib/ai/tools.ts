import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import {
  resolveCharacterInCampaign,
  updateCampaignMemory,
  setPendingRollRequest,
  setPendingImageConfirmation,
  getCampaign,
  type PendingRollRequest,
  type PendingImageConfirmation,
} from "@/lib/campaigns";
import { findEquipmentByName } from "@/lib/content";
import {
  applyDamage,
  applyHealing,
  consumeSpellSlot,
  grantItem,
  removeItem,
  awardXp,
  applyCondition,
  removeCondition,
  EngineValidationError,
} from "@/lib/engine/mutations";
import { ABILITIES } from "@/lib/rules/constants";

export class ToolExecutionError extends Error {}

export interface ToolExecutionResult {
  /** Fed back to the model as the tool call's result. */
  resultText: string;
  /** If set, persisted + broadcast to the campaign room as a system message. */
  broadcastContent?: string;
  /** request_roll / request_image_confirmation: stop the DM's turn here and wait for the player. */
  endTurn?: boolean;
  /** request_roll only: broadcast structurally so the requested player's dice tray can highlight itself. */
  rollRequest?: PendingRollRequest;
  /** request_image_confirmation only: broadcast structurally so the room can show a confirm button. */
  imageConfirmation?: PendingImageConfirmation;
}

const characterNameProp = {
  characterName: {
    type: "string",
    description: "The exact character name as it appears in the party list.",
  },
} as const;

/** Bedrock Converse's tool shape: {toolSpec: {name, description, inputSchema: {json}}} — the
 *  JSON Schema itself (`schema`) is identical to what OpenAI's `parameters` used to hold. */
function tool(name: string, description: string, schema: Record<string, unknown>): Tool {
  // Cast needed: the SDK's recursive DocumentType doesn't structurally accept
  // a plain Record<string, unknown> JSON Schema object without one.
  return { toolSpec: { name, description, inputSchema: { json: schema } } } as Tool;
}

export const DM_TOOLS: Tool[] = [
  tool(
    "request_roll",
    "Ask a player to make a d20 roll (ability check, saving throw, skill check, or attack). Never roll or invent the result yourself — this ends your turn; you'll be prompted again once the player rolls.",
    {
      type: "object",
      properties: {
        ...characterNameProp,
        rollType: {
          type: "string",
          enum: ["ability_check", "saving_throw", "skill_check", "attack"],
        },
        ability: { type: "string", enum: ABILITIES, description: "Required for ability_check/saving_throw." },
        skill: { type: "string", description: "Required for skill_check, e.g. 'stealth', 'perception'." },
        dc: { type: "number", description: "Difficulty class or target AC, if there is one." },
        reason: { type: "string", description: "One short phrase for why this roll is needed." },
      },
      required: ["characterName", "rollType", "reason"],
    },
  ),
  tool("apply_damage", "Deal damage to a character.", {
    type: "object",
    properties: { ...characterNameProp, amount: { type: "number" }, reason: { type: "string" } },
    required: ["characterName", "amount"],
  }),
  tool("apply_healing", "Restore hit points to a character.", {
    type: "object",
    properties: { ...characterNameProp, amount: { type: "number" }, reason: { type: "string" } },
    required: ["characterName", "amount"],
  }),
  tool("consume_spell_slot", "Mark one of a character's spell slots as used when they cast a leveled spell.", {
    type: "object",
    properties: { ...characterNameProp, level: { type: "number", minimum: 1, maximum: 9 } },
    required: ["characterName", "level"],
  }),
  tool("grant_item", "Give a character an item (loot, a purchase, a quest reward).", {
    type: "object",
    properties: {
      ...characterNameProp,
      itemName: { type: "string", description: "The item's name, e.g. 'Longsword' or 'Healer's Kit'." },
      quantity: { type: "number", minimum: 1 },
    },
    required: ["characterName", "itemName"],
  }),
  tool("remove_item", "Take an item away from a character (used, lost, sold, stolen).", {
    type: "object",
    properties: {
      ...characterNameProp,
      itemName: { type: "string" },
      quantity: { type: "number", minimum: 1 },
    },
    required: ["characterName", "itemName"],
  }),
  tool("award_xp", "Award experience points at a natural story milestone.", {
    type: "object",
    properties: { ...characterNameProp, amount: { type: "number", minimum: 1 }, reason: { type: "string" } },
    required: ["characterName", "amount"],
  }),
  tool("apply_condition", "Apply a status condition (e.g. 'prone', 'poisoned', 'frightened') to a character.", {
    type: "object",
    properties: { ...characterNameProp, condition: { type: "string" } },
    required: ["characterName", "condition"],
  }),
  tool("remove_condition", "Remove a status condition from a character.", {
    type: "object",
    properties: { ...characterNameProp, condition: { type: "string" } },
    required: ["characterName", "condition"],
  }),
  tool("advance_scene", "Record that the scene/location has changed, so future context reflects where the party is.", {
    type: "object",
    properties: {
      description: { type: "string", description: "Where the party is now and what's notable about it." },
    },
    required: ["description"],
  }),
  tool(
    "update_npc",
    "Add or update an entry in the NPC roster — do this whenever you introduce or develop a named NPC.",
    {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string", description: "One line: who they are and what they look like." },
        disposition: { type: "string", description: "e.g. 'friendly', 'suspicious of the party', 'hostile'." },
      },
      required: ["name", "description"],
    },
  ),
  tool(
    "log_plot_event",
    "Record a plot beat future sessions should remember (a decision made, a secret learned, a promise given).",
    {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  ),
  tool(
    "request_image_confirmation",
    "Only call this if a player asked for an illustration. Asks them to confirm before any image is generated — this ends your turn.",
    {
      type: "object",
      properties: {
        subject: { type: "string", description: "What the image would depict." },
        subjects: {
          type: "array",
          items: { type: "string" },
          description:
            "Exact names of every character, NPC, and named location actually depicted in the scene (e.g. present party members from the party list, NPCs from the roster). Always list everyone visible — this lets each of them keep their established look.",
        },
      },
      required: ["subject"],
    },
  ),
];

/** The meta (table-talk) channel is out-of-character — the DM there can make
 *  rulings and remember them, but can't touch game state directly. Rulings
 *  get logged here and reach the story via the plot log, which is already
 *  injected into every story turn's context. */
export const META_DM_TOOLS: Tool[] = DM_TOOLS.filter((t) => t.toolSpec?.name === "log_plot_event");

function requireCharacter(campaignId: number, characterName: string) {
  const member = resolveCharacterInCampaign(campaignId, characterName);
  if (!member || member.characterId === null) {
    throw new ToolExecutionError(
      `No present character named "${characterName}" — check the party list and try the exact name.`,
    );
  }
  return member;
}

export async function executeTool(
  campaignId: number,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case "request_roll": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const request: PendingRollRequest = {
          characterId: member.characterId!,
          characterName: member.characterName!,
          rollType: args.rollType as PendingRollRequest["rollType"],
          ability: args.ability as string | undefined,
          skill: args.skill as string | undefined,
          dc: args.dc as number | undefined,
          reason: (args.reason as string) ?? "",
        };
        setPendingRollRequest(campaignId, request);
        return {
          resultText: `Waiting on ${member.characterName} to roll.`,
          broadcastContent: `The DM asks ${member.characterName} to make ${describeRoll(request)}${
            request.reason ? ` — ${request.reason}` : ""
          }.`,
          endTurn: true,
          rollRequest: request,
        };
      }

      case "apply_damage": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const amount = Number(args.amount);
        const result = applyDamage(member.characterId!, amount);
        return {
          resultText: `${member.characterName} is now at ${result.hpCurrent}/${result.hpMax} HP.`,
          broadcastContent: `${member.characterName} takes ${amount} damage (${result.hpCurrent}/${result.hpMax} HP).`,
        };
      }

      case "apply_healing": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const amount = Number(args.amount);
        const result = applyHealing(member.characterId!, amount);
        return {
          resultText: `${member.characterName} is now at ${result.hpCurrent}/${result.hpMax} HP.`,
          broadcastContent: `${member.characterName} regains ${amount} HP (${result.hpCurrent}/${result.hpMax}).`,
        };
      }

      case "consume_spell_slot": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const level = Number(args.level);
        consumeSpellSlot(member.characterId!, level);
        return {
          resultText: `${member.characterName} has used a level ${level} spell slot.`,
          broadcastContent: `${member.characterName} expends a level ${level} spell slot.`,
        };
      }

      case "grant_item": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const item = findEquipmentByName(args.itemName as string);
        if (!item) throw new ToolExecutionError(`No item found matching "${args.itemName}".`);
        const quantity = Number(args.quantity ?? 1);
        grantItem(member.characterId!, item.id, quantity);
        return {
          resultText: `${member.characterName} received ${quantity}x ${item.name}.`,
          broadcastContent: `${member.characterName} receives ${item.name}${quantity > 1 ? ` x${quantity}` : ""}.`,
        };
      }

      case "remove_item": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const item = findEquipmentByName(args.itemName as string);
        if (!item) throw new ToolExecutionError(`No item found matching "${args.itemName}".`);
        const quantity = Number(args.quantity ?? 1);
        removeItem(member.characterId!, item.id, quantity);
        return {
          resultText: `${item.name} removed from ${member.characterName}.`,
          broadcastContent: `${member.characterName} loses ${item.name}${quantity > 1 ? ` x${quantity}` : ""}.`,
        };
      }

      case "award_xp": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const amount = Number(args.amount);
        const result = awardXp(member.characterId!, amount);
        return {
          resultText: `${member.characterName} now has ${result.xp} XP${result.leveledUp ? ` and is now level ${result.level}!` : "."}`,
          broadcastContent: `${member.characterName} gains ${amount} XP${result.leveledUp ? ` and reaches level ${result.level}!` : "."}`,
        };
      }

      case "apply_condition": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const condition = args.condition as string;
        applyCondition(member.characterId!, condition);
        return {
          resultText: `${member.characterName} is now ${condition}.`,
          broadcastContent: `${member.characterName} is now ${condition}.`,
        };
      }

      case "remove_condition": {
        const member = requireCharacter(campaignId, args.characterName as string);
        const condition = args.condition as string;
        removeCondition(member.characterId!, condition);
        return {
          resultText: `${member.characterName} is no longer ${condition}.`,
          broadcastContent: `${member.characterName} is no longer ${condition}.`,
        };
      }

      case "advance_scene": {
        const description = args.description as string;
        updateCampaignMemory(campaignId, { currentScene: description });
        return { resultText: "Scene updated." };
      }

      case "update_npc": {
        const campaign = getCampaign(campaignId);
        if (!campaign) throw new ToolExecutionError("Campaign not found.");
        const name = args.name as string;
        const description = args.description as string;
        const disposition = (args.disposition as string) ?? "";
        const roster = campaign.npcRoster.filter((n) => n.name.toLowerCase() !== name.toLowerCase());
        roster.push({ name, description, disposition });
        updateCampaignMemory(campaignId, { npcRoster: roster });
        return { resultText: `NPC roster updated for ${name}.` };
      }

      case "log_plot_event": {
        const campaign = getCampaign(campaignId);
        if (!campaign) throw new ToolExecutionError("Campaign not found.");
        const summary = args.summary as string;
        const plotLog = [...campaign.plotLog, { summary, createdAt: new Date().toISOString() }];
        updateCampaignMemory(campaignId, { plotLog });
        return { resultText: "Logged." };
      }

      case "request_image_confirmation": {
        const subject = args.subject as string;
        const subjects = Array.isArray(args.subjects) ? (args.subjects as string[]) : undefined;
        const request: PendingImageConfirmation = { subject, kind: "scene", subjects };
        setPendingImageConfirmation(campaignId, request);
        return {
          resultText: "Waiting on player confirmation before generating an image.",
          broadcastContent: `The DM offers to illustrate: ${subject}.`,
          endTurn: true,
          imageConfirmation: request,
        };
      }

      default:
        throw new ToolExecutionError(`Unknown tool: ${toolName}`);
    }
  } catch (err) {
    if (err instanceof EngineValidationError || err instanceof ToolExecutionError) {
      return { resultText: `Could not do that: ${err.message}` };
    }
    throw err;
  }
}

function withArticle(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}

function describeRoll(request: PendingRollRequest): string {
  if (request.rollType === "ability_check") return withArticle(`${request.ability?.toUpperCase()} check`);
  if (request.rollType === "saving_throw") return withArticle(`${request.ability?.toUpperCase()} saving throw`);
  if (request.rollType === "skill_check") return withArticle(`${request.skill} check`);
  return "an attack roll";
}
