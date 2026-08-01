import { z } from "zod";
import { ABILITIES } from "@/lib/rules/constants";

const abilityScoresSchema = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  con: z.number().int(),
  int: z.number().int(),
  wis: z.number().int(),
  cha: z.number().int(),
});

const abilityBonusAllocationSchema = z.union([
  z.object({
    mode: z.literal("2-1"),
    plus2: z.enum(ABILITIES),
    plus1: z.enum(ABILITIES),
  }),
  z.object({ mode: z.literal("1-1-1") }),
]);

export const createCharacterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  speciesId: z.string().min(1),
  classId: z.string().min(1),
  backgroundId: z.string().min(1),
  abilityMethod: z.enum(["point_buy", "standard_array", "manual"]),
  baseAbilityScores: abilityScoresSchema,
  abilityBonusAllocation: abilityBonusAllocationSchema,
  skillProficiencies: z.array(z.string()).max(6),
  cantripsKnown: z.array(z.string()).default([]),
  spellsKnown: z.array(z.string()).default([]),
  classChoices: z.record(z.string(), z.unknown()).default({}),
  alignment: z.string().max(40).optional(),
  appearance: z.string().max(2000).optional(),
  backstory: z.string().max(4000).optional(),
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

export const updateCharacterSchema = z.object({
  hpCurrent: z.number().int().min(0).optional(),
  tempHp: z.number().int().min(0).optional(),
  hitDiceUsed: z.number().int().min(0).optional(),
  inspiration: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
  conditions: z.array(z.string()).optional(),
  spellSlotsUsed: z.record(z.string(), z.number().int().min(0)).optional(),
});

export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
