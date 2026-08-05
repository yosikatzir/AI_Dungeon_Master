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
// Static SRD data, not the seeded table — the tool schema is built at module
// load, before the DB is necessarily ready, and these ids never differ.
import { MONSTERS } from "@/content/srd/monsters";
import {
  buildNpcStatBlock,
  isNpcDefeated,
  npcPassivePerception,
  type NpcRosterEntry,
} from "@/lib/npcs";
import { performNpcRoll, describeNpcRoll, type NpcRollPurpose } from "@/lib/engine/npcRolls";
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
import { ABILITIES, type Ability } from "@/lib/rules/constants";

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

const MONSTER_IDS = MONSTERS.map((m) => m.id);

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
        dc: {
          type: "number",
          description:
            "The number to beat, and you should almost always set it — without it the engine can't judge success and you'd be eyeballing the result. Use the opposing creature's passive Perception/Insight from the NPC roster when someone specific is being beaten, that character's AC for an attack, or the standard ladder otherwise (10 easy, 15 moderate, 20 hard, 25 near-impossible).",
        },
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
    "Add or update an entry in the NPC roster — do this whenever you introduce or develop a named NPC. Give stats to anyone the party might have to sneak past, fight, deceive, or otherwise roll against; a purely decorative NPC doesn't need them. Prefer `monsterId` when a standard creature fits — those numbers are already balanced.",
    {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string", description: "One line: who they are and what they look like." },
        disposition: { type: "string", description: "e.g. 'friendly', 'suspicious of the party', 'hostile'." },
        monsterId: {
          type: "string",
          description: `Standard creature to base stats on. Available: ${MONSTER_IDS.join(", ")}. Omit for an original NPC.`,
        },
        ac: { type: "number", description: "Armor Class. Overrides the monster's, or sets it for an original NPC." },
        hpMax: { type: "number", description: "Maximum hit points. Overrides the monster's." },
        abilities: {
          type: "object",
          description: "Ability SCORES (not modifiers), 1-30. Any omitted default to 10.",
          properties: Object.fromEntries(ABILITIES.map((a) => [a, { type: "number" }])),
        },
        skills: {
          type: "object",
          description:
            "Total skill bonuses including the ability modifier, keyed by skill id (e.g. {\"perception\": 4, \"stealth\": 6}). Only list skills this NPC is notably good at.",
        },
        savingThrows: {
          type: "object",
          description: "Total saving-throw bonuses for proficient saves only, keyed by ability (e.g. {\"wis\": 5}).",
        },
        cr: { type: "string", description: "Challenge rating, e.g. '1/4' or '3'." },
      },
      required: ["name", "description"],
    },
  ),
  tool(
    "roll_npc",
    "Roll dice FOR an NPC or monster — their Perception to spot someone, their attack against a player's AC, their saving throw against a spell. Returns the real result immediately; you do NOT wait for a player. Use this any time the NPC's side of an action is uncertain, instead of deciding what happens.",
    {
      type: "object",
      properties: {
        npcName: { type: "string", description: "Exact name from the NPC roster. Must already have stats." },
        rollType: { type: "string", enum: ["ability_check", "saving_throw", "skill_check", "attack"] },
        ability: { type: "string", enum: ABILITIES, description: "Required for ability_check/saving_throw." },
        skill: { type: "string", description: "Required for skill_check, e.g. 'perception'." },
        toHit: { type: "number", description: "Required for attack: the attack bonus from the NPC's stat block." },
        dc: { type: "number", description: "DC to beat, or the target's AC for an attack. Omit for an open roll." },
        reason: { type: "string", description: "One short phrase for why this roll is happening." },
      },
      required: ["npcName", "rollType"],
    },
  ),
  tool(
    "damage_npc",
    "Deal damage to an NPC or monster after a player's attack connects. Tracks their HP so a fight actually ends when they run out.",
    {
      type: "object",
      properties: {
        npcName: { type: "string", description: "Exact name from the NPC roster. Must already have stats." },
        amount: { type: "number", minimum: 0 },
        reason: { type: "string" },
      },
      required: ["npcName", "amount"],
    },
  ),
  tool("heal_npc", "Restore hit points to an NPC or monster.", {
    type: "object",
    properties: {
      npcName: { type: "string", description: "Exact name from the NPC roster. Must already have stats." },
      amount: { type: "number", minimum: 0 },
    },
    required: ["npcName", "amount"],
  }),
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

/** NPC rolls and HP changes need real numbers — an unstatted NPC is a hard
 *  error rather than an improvised default, so the DM is pushed to stat anyone
 *  it wants to resolve mechanically instead of guessing on their behalf. */
function requireStattedNpc(campaignId: number, npcName: string) {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new ToolExecutionError("Campaign not found.");
  const entry = campaign.npcRoster.find((n) => n.name.toLowerCase() === (npcName ?? "").toLowerCase());
  if (!entry) {
    throw new ToolExecutionError(
      `No NPC named "${npcName}" in the roster. Call update_npc to add them first.`,
    );
  }
  if (!entry.stats) {
    throw new ToolExecutionError(
      `${entry.name} has no stat block. Call update_npc for them with a monsterId (or ac/hpMax/abilities) before rolling against them.`,
    );
  }
  return { entry, stats: entry.stats };
}

function saveNpcStats(campaignId: number, npcName: string, stats: NpcRosterEntry["stats"]): void {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new ToolExecutionError("Campaign not found.");
  const roster = campaign.npcRoster.map((n) =>
    n.name.toLowerCase() === npcName.toLowerCase() ? { ...n, stats } : n,
  );
  updateCampaignMemory(campaignId, { npcRoster: roster });
}

function buildNpcRollPurpose(args: Record<string, unknown>): NpcRollPurpose {
  const rollType = args.rollType as string;
  const dc = args.dc as number | undefined;
  switch (rollType) {
    case "ability_check":
    case "saving_throw": {
      const ability = args.ability as Ability | undefined;
      if (!ability || !ABILITIES.includes(ability)) {
        throw new ToolExecutionError(`${rollType} needs an "ability" (one of: ${ABILITIES.join(", ")}).`);
      }
      return rollType === "ability_check"
        ? { type: "ability_check", ability, dc }
        : { type: "saving_throw", ability, dc };
    }
    case "skill_check": {
      const skill = args.skill as string | undefined;
      if (!skill) throw new ToolExecutionError('skill_check needs a "skill", e.g. "perception".');
      return { type: "skill_check", skill, dc };
    }
    case "attack": {
      const toHit = Number(args.toHit);
      if (!Number.isFinite(toHit)) {
        throw new ToolExecutionError('attack needs a "toHit" bonus from the NPC\'s stat block.');
      }
      return { type: "attack", toHit, ac: dc, attackName: (args.reason as string) || undefined };
    }
    default:
      throw new ToolExecutionError(`Unknown rollType "${rollType}".`);
  }
}

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
        const existing = campaign.npcRoster.find((n) => n.name.toLowerCase() === name.toLowerCase());

        const wantsStats =
          args.monsterId !== undefined ||
          args.ac !== undefined ||
          args.hpMax !== undefined ||
          args.abilities !== undefined ||
          args.skills !== undefined ||
          args.savingThrows !== undefined ||
          args.cr !== undefined;

        if (args.monsterId !== undefined && !MONSTER_IDS.includes(args.monsterId as string)) {
          throw new ToolExecutionError(
            `Unknown monsterId "${args.monsterId}". Available: ${MONSTER_IDS.join(", ")}. Omit it and give ac/hpMax/abilities directly for an original creature.`,
          );
        }

        // Re-statting an NPC mid-scene would silently restore its HP, so an
        // existing stat block is kept unless this call actually supplies stats.
        const stats = wantsStats
          ? buildNpcStatBlock({
              monsterId: args.monsterId as string | undefined,
              ac: args.ac as number | undefined,
              hpMax: args.hpMax as number | undefined,
              abilities: args.abilities as Record<string, number> | undefined,
              skills: args.skills as Record<string, number> | undefined,
              savingThrows: args.savingThrows as Record<string, number> | undefined,
              cr: args.cr as string | undefined,
            })
          : existing?.stats;

        const entry: NpcRosterEntry = { name, description, disposition, ...(stats ? { stats } : {}) };
        const roster = campaign.npcRoster.filter((n) => n.name.toLowerCase() !== name.toLowerCase());
        roster.push(entry);
        updateCampaignMemory(campaignId, { npcRoster: roster });

        return {
          resultText: stats
            ? `NPC roster updated for ${name}. AC ${stats.ac}, HP ${stats.hpCurrent}/${stats.hpMax}, passive Perception ${npcPassivePerception(stats)}.`
            : `NPC roster updated for ${name} (no stats — they can't be rolled against).`,
        };
      }

      case "roll_npc": {
        const { entry, stats } = requireStattedNpc(campaignId, args.npcName as string);
        const purpose = buildNpcRollPurpose(args);
        const outcome = performNpcRoll(entry.name, stats, purpose);
        const reason = (args.reason as string) ?? "";
        return {
          resultText: `${describeNpcRoll(outcome)}${reason ? ` (${reason})` : ""}`,
          broadcastContent: `${describeNpcRoll(outcome)}${reason ? ` — ${reason}` : ""}`,
        };
      }

      case "damage_npc": {
        const { entry, stats } = requireStattedNpc(campaignId, args.npcName as string);
        const amount = Math.max(0, Math.round(Number(args.amount)));
        const updated = { ...stats, hpCurrent: Math.max(0, stats.hpCurrent - amount) };
        saveNpcStats(campaignId, entry.name, updated);
        const defeated = isNpcDefeated(updated);
        return {
          resultText: `${entry.name} is at ${updated.hpCurrent}/${updated.hpMax} HP${defeated ? " — defeated." : "."}`,
          broadcastContent: `${entry.name} takes ${amount} damage${defeated ? " and is defeated!" : ` (${updated.hpCurrent}/${updated.hpMax} HP).`}`,
        };
      }

      case "heal_npc": {
        const { entry, stats } = requireStattedNpc(campaignId, args.npcName as string);
        const amount = Math.max(0, Math.round(Number(args.amount)));
        const updated = { ...stats, hpCurrent: Math.min(stats.hpMax, stats.hpCurrent + amount) };
        saveNpcStats(campaignId, entry.name, updated);
        return {
          resultText: `${entry.name} is at ${updated.hpCurrent}/${updated.hpMax} HP.`,
          broadcastContent: `${entry.name} regains ${amount} HP (${updated.hpCurrent}/${updated.hpMax}).`,
        };
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
