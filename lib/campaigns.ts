import db from "@/lib/db";
import type { CreateCampaignInput } from "@/lib/validation/campaign";

export interface Campaign {
  id: number;
  name: string;
  ownerUserId: number;
  mode: "surprise" | "guided";
  guidelines: string | null;
  premise: string | null;
  openingScene: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMember {
  id: number;
  campaignId: number;
  userId: number;
  username: string;
  characterId: number | null;
  characterName: string | null;
  status: "active" | "left";
  joinedAt: string;
}

export interface CampaignMessage {
  id: number;
  campaignId: number;
  senderType: "player" | "system" | "dm";
  userId: number | null;
  username: string | null;
  characterId: number | null;
  characterName: string | null;
  content: string;
  createdAt: string;
}

function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    mode: row.mode,
    guidelines: row.guidelines,
    premise: row.premise,
    openingScene: row.opening_scene,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCampaign(ownerUserId: number, input: CreateCampaignInput): number {
  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (name, owner_user_id, mode, guidelines)
    VALUES (?, ?, ?, ?)
  `);
  const result = insertCampaign.run(
    input.name,
    ownerUserId,
    input.mode,
    input.guidelines ?? null,
  );
  const campaignId = Number(result.lastInsertRowid);

  db.prepare(`
    INSERT INTO campaign_members (campaign_id, user_id, status)
    VALUES (?, ?, 'active')
  `).run(campaignId, ownerUserId);

  return campaignId;
}

export function listActiveCampaigns(): Campaign[] {
  return db
    .prepare("SELECT * FROM campaigns WHERE status = 'active' ORDER BY updated_at DESC")
    .all()
    .map(rowToCampaign);
}

export function getCampaign(id: number): Campaign | null {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  return row ? rowToCampaign(row) : null;
}

export function getCampaignMembers(campaignId: number): CampaignMember[] {
  const rows = db
    .prepare(
      `SELECT cm.*, u.username, c.name AS character_name
       FROM campaign_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN characters c ON c.id = cm.character_id
       WHERE cm.campaign_id = ?
       ORDER BY cm.joined_at ASC`,
    )
    .all(campaignId) as any[];

  return rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    username: row.username,
    characterId: row.character_id,
    characterName: row.character_name,
    status: row.status,
    joinedAt: row.joined_at,
  }));
}

export function getMembership(campaignId: number, userId: number): CampaignMember | null {
  const row = db
    .prepare(
      `SELECT cm.*, u.username, c.name AS character_name
       FROM campaign_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN characters c ON c.id = cm.character_id
       WHERE cm.campaign_id = ? AND cm.user_id = ?`,
    )
    .get(campaignId, userId) as any;
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    userId: row.user_id,
    username: row.username,
    characterId: row.character_id,
    characterName: row.character_name,
    status: row.status,
    joinedAt: row.joined_at,
  };
}

export function joinCampaign(
  campaignId: number,
  userId: number,
  characterId: number | null,
): void {
  db.prepare(
    `INSERT INTO campaign_members (campaign_id, user_id, character_id, status)
     VALUES (?, ?, ?, 'active')
     ON CONFLICT(campaign_id, user_id) DO UPDATE SET
       character_id = excluded.character_id,
       status = 'active'`,
  ).run(campaignId, userId, characterId);
}

export function leaveCampaignPermanently(campaignId: number, userId: number): void {
  db.prepare(
    "UPDATE campaign_members SET status = 'left' WHERE campaign_id = ? AND user_id = ?",
  ).run(campaignId, userId);
}

export function listRecentMessages(campaignId: number, limit = 100): CampaignMessage[] {
  const rows = db
    .prepare(
      `SELECT cmsg.*, u.username, c.name AS character_name
       FROM campaign_messages cmsg
       LEFT JOIN users u ON u.id = cmsg.user_id
       LEFT JOIN characters c ON c.id = cmsg.character_id
       WHERE cmsg.campaign_id = ?
       ORDER BY cmsg.id DESC
       LIMIT ?`,
    )
    .all(campaignId, limit) as any[];

  return rows.reverse().map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    senderType: row.sender_type,
    userId: row.user_id,
    username: row.username,
    characterId: row.character_id,
    characterName: row.character_name,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export function addMessage(params: {
  campaignId: number;
  senderType: "player" | "system" | "dm";
  userId: number | null;
  characterId: number | null;
  content: string;
}): CampaignMessage {
  const result = db
    .prepare(
      `INSERT INTO campaign_messages (campaign_id, sender_type, user_id, character_id, content)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(params.campaignId, params.senderType, params.userId, params.characterId, params.content);

  const id = Number(result.lastInsertRowid);
  const row = db
    .prepare(
      `SELECT cmsg.*, u.username, c.name AS character_name
       FROM campaign_messages cmsg
       LEFT JOIN users u ON u.id = cmsg.user_id
       LEFT JOIN characters c ON c.id = cmsg.character_id
       WHERE cmsg.id = ?`,
    )
    .get(id) as any;

  return {
    id: row.id,
    campaignId: row.campaign_id,
    senderType: row.sender_type,
    userId: row.user_id,
    username: row.username,
    characterId: row.character_id,
    characterName: row.character_name,
    content: row.content,
    createdAt: row.created_at,
  };
}
