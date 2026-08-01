import { z } from "zod";
import { ABILITIES } from "@/lib/rules/constants";

export const rollPurposeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("raw"), sides: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20), z.literal(100)]) }),
  z.object({ type: z.literal("ability_check"), ability: z.enum(ABILITIES), dc: z.number().int().optional() }),
  z.object({ type: z.literal("saving_throw"), ability: z.enum(ABILITIES), dc: z.number().int().optional() }),
  z.object({ type: z.literal("skill_check"), skill: z.string(), dc: z.number().int().optional() }),
  z.object({ type: z.literal("attack"), equipmentId: z.string().optional(), ac: z.number().int().optional() }),
]);

export const rollDiceSchema = z.object({
  campaignId: z.number().int().positive(),
  characterId: z.number().int().positive().nullable(),
  purpose: rollPurposeSchema,
});

export const hpMutationSchema = z.object({
  campaignId: z.number().int().positive(),
  characterId: z.number().int().positive(),
  amount: z.number().int().min(0),
});

export const spellSlotSchema = z.object({
  campaignId: z.number().int().positive(),
  characterId: z.number().int().positive(),
  level: z.number().int().min(1).max(9),
});

export const longRestSchema = z.object({
  campaignId: z.number().int().positive(),
  characterId: z.number().int().positive(),
});

export const campaignIdSchema = z.object({
  campaignId: z.number().int().positive(),
});

export const requestImageSchema = z.object({
  campaignId: z.number().int().positive(),
  subject: z.string().trim().min(1).max(500),
  kind: z.enum(["scene", "npc", "map"]).default("scene"),
});
