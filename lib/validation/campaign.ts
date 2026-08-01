import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mode: z.enum(["surprise", "guided"]),
  guidelines: z.string().trim().max(4000).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const joinCampaignSchema = z.object({
  characterId: z.number().int().positive().nullable().optional(),
});

export const sendMessageSchema = z.object({
  campaignId: z.number().int().positive(),
  content: z.string().trim().min(1).max(4000),
  channel: z.enum(["story", "meta"]).default("story"),
  /** Meta-channel only: post the message AND trigger a meta DM turn. Plain
   *  table talk (players chatting with each other) never calls the model. */
  askDm: z.boolean().default(false),
});
