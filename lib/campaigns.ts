import db from "@/lib/db";
import type { CreateCampaignInput } from "@/lib/validation/campaign";
import type { RollOutcome } from "@/lib/engine/rolls";

export interface NpcRosterEntry {
  name: string;
  description: string;
  disposition: string;
}

export interface PlotLogEntry {
  summary: string;
  createdAt: string;
}

export interface PendingRollRequest {
  characterId: number;
  characterName: string;
  rollType: "ability_check" | "saving_throw" | "skill_check" | "attack";
  ability?: string;
  skill?: string;
  dc?: number;
  reason: string;
}

export interface Campaign {
  id: number;
  name: string;
  ownerUserId: number;
  mode: "surprise" | "guided";
  guidelines: string | null;
  premise: string | null;
  openingScene: string | null;
  status: "active" | "archived";
  summary: string;
  npcRoster: NpcRosterEntry[];
  plotLog: PlotLogEntry[];
  currentScene: string;
  activeQuests: string[];
  lastSummarizedMessageId: number;
  pendingRollRequest: PendingRollRequest | null;
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
  senderType: "player" | "system" | "dm" | "roll";
  userId: number | null;
  username: string | null;
  characterId: number | null;
  characterName: string | null;
  content: string;
  rollData: RollOutcome | null;
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
    summary: row.summary,
    npcRoster: JSON.parse(row.npc_roster),
    plotLog: JSON.parse(row.plot_log),
    currentScene: row.current_scene,
    activeQuests: JSON.parse(row.active_quests),
    lastSummarizedMessageId: row.last_summarized_message_id,
    pendingRollRequest: row.pending_roll_request ? JSON.parse(row.pending_roll_request) : null,
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

  return rows.reverse().map(rowToMessage);
}

function rowToMessage(row: any): CampaignMessage {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    senderType: row.sender_type,
    userId: row.user_id,
    username: row.username,
    characterId: row.character_id,
    characterName: row.character_name,
    content: row.content,
    rollData: row.roll_data ? JSON.parse(row.roll_data) : null,
    createdAt: row.created_at,
  };
}

export function addMessage(params: {
  campaignId: number;
  senderType: "player" | "system" | "dm" | "roll";
  userId: number | null;
  characterId: number | null;
  content: string;
  rollData?: RollOutcome;
}): CampaignMessage {
  const result = db
    .prepare(
      `INSERT INTO campaign_messages (campaign_id, sender_type, user_id, character_id, content, roll_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.campaignId,
      params.senderType,
      params.userId,
      params.characterId,
      params.content,
      params.rollData ? JSON.stringify(params.rollData) : null,
    );

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

  return rowToMessage(row);
}

/** Messages strictly after a given id, oldest first — used to feed the summarizer only what it hasn't seen. */
export function listMessagesAfter(campaignId: number, afterId: number): CampaignMessage[] {
  const rows = db
    .prepare(
      `SELECT cmsg.*, u.username, c.name AS character_name
       FROM campaign_messages cmsg
       LEFT JOIN users u ON u.id = cmsg.user_id
       LEFT JOIN characters c ON c.id = cmsg.character_id
       WHERE cmsg.campaign_id = ? AND cmsg.id > ?
       ORDER BY cmsg.id ASC`,
    )
    .all(campaignId, afterId) as any[];
  return rows.map(rowToMessage);
}

export function countMessages(campaignId: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM campaign_messages WHERE campaign_id = ?")
    .get(campaignId) as { n: number };
  return row.n;
}

export function setCampaignPremise(
  campaignId: number,
  params: { premise: string; openingScene: string; currentScene: string },
): void {
  db.prepare(
    `UPDATE campaigns SET premise = ?, opening_scene = ?, current_scene = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(params.premise, params.openingScene, params.currentScene, campaignId);
}

export function updateCampaignMemory(
  campaignId: number,
  patch: {
    summary?: string;
    npcRoster?: NpcRosterEntry[];
    plotLog?: PlotLogEntry[];
    currentScene?: string;
    activeQuests?: string[];
    lastSummarizedMessageId?: number;
  },
): void {
  const fields: string[] = [];
  const values: Record<string, unknown> = { id: campaignId };

  if (patch.summary !== undefined) {
    fields.push("summary = @summary");
    values.summary = patch.summary;
  }
  if (patch.npcRoster !== undefined) {
    fields.push("npc_roster = @npcRoster");
    values.npcRoster = JSON.stringify(patch.npcRoster);
  }
  if (patch.plotLog !== undefined) {
    fields.push("plot_log = @plotLog");
    values.plotLog = JSON.stringify(patch.plotLog);
  }
  if (patch.currentScene !== undefined) {
    fields.push("current_scene = @currentScene");
    values.currentScene = patch.currentScene;
  }
  if (patch.activeQuests !== undefined) {
    fields.push("active_quests = @activeQuests");
    values.activeQuests = JSON.stringify(patch.activeQuests);
  }
  if (patch.lastSummarizedMessageId !== undefined) {
    fields.push("last_summarized_message_id = @lastSummarizedMessageId");
    values.lastSummarizedMessageId = patch.lastSummarizedMessageId;
  }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE campaigns SET ${fields.join(", ")} WHERE id = @id`).run(values);
}

export function setPendingRollRequest(
  campaignId: number,
  request: PendingRollRequest | null,
): void {
  db.prepare(
    "UPDATE campaigns SET pending_roll_request = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(request ? JSON.stringify(request) : null, campaignId);
}

/** Case-insensitive match of a name the model used against present campaign members' characters. */
export function resolveCharacterInCampaign(
  campaignId: number,
  characterName: string,
): CampaignMember | null {
  const needle = characterName.trim().toLowerCase();
  const members = getCampaignMembers(campaignId).filter(
    (m) => m.status === "active" && m.characterId !== null,
  );
  return (
    members.find((m) => m.characterName?.toLowerCase() === needle) ??
    members.find((m) => m.characterName?.toLowerCase().includes(needle)) ??
    null
  );
}
