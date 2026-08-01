import db from "@/lib/db";

export type ImageKind = "portrait" | "scene" | "npc" | "map";

export interface RegisteredImage {
  id: number;
  campaignId: number | null;
  kind: ImageKind;
  subjectTags: string[];
  prompt: string;
  filePath: string;
  createdAt: string;
}

function rowToImage(row: any): RegisteredImage {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: row.kind,
    subjectTags: JSON.parse(row.subject_tags),
    prompt: row.prompt,
    filePath: row.file_path,
    createdAt: row.created_at,
  };
}

export function registerImage(params: {
  campaignId: number | null;
  kind: ImageKind;
  subjectTags: string[];
  prompt: string;
  filePath: string;
}): RegisteredImage {
  const result = db
    .prepare(
      `INSERT INTO image_registry (campaign_id, kind, subject_tags, prompt, file_path)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      params.campaignId,
      params.kind,
      JSON.stringify(params.subjectTags),
      params.prompt,
      params.filePath,
    );
  const row = db.prepare("SELECT * FROM image_registry WHERE id = ?").get(Number(result.lastInsertRowid));
  return rowToImage(row);
}

/**
 * Picks the single best reference image per tag: an uploaded portrait wins
 * (portraits are the canonical look for a character, registered with
 * campaign_id NULL so they apply anywhere), otherwise the newest image from
 * this campaign that was tagged with it. Pure so it can be unit-tested
 * without a database — findReferenceImages below just fetches the two
 * candidate lists and hands them to this.
 */
export function pickBestReferenceImages(
  tags: string[],
  portraits: RegisteredImage[],
  campaignImages: RegisteredImage[],
): Map<string, RegisteredImage> {
  const result = new Map<string, RegisteredImage>();
  for (const tag of tags) {
    const needle = tag.toLowerCase();
    const portrait = portraits.find((p) => p.subjectTags.some((t) => t.toLowerCase() === needle));
    if (portrait) {
      result.set(tag, portrait);
      continue;
    }
    const campaignMatch = campaignImages.find((img) => img.subjectTags.some((t) => t.toLowerCase() === needle));
    if (campaignMatch) {
      result.set(tag, campaignMatch);
    }
  }
  return result;
}

/** One reference image per tag — see pickBestReferenceImages for the selection rule. */
export function findReferenceImages(tags: string[], campaignId: number): Map<string, RegisteredImage> {
  if (tags.length === 0) return new Map();
  const portraits = (
    db.prepare("SELECT * FROM image_registry WHERE kind = 'portrait' ORDER BY id DESC").all() as any[]
  ).map(rowToImage);
  const campaignImages = (
    db.prepare("SELECT * FROM image_registry WHERE campaign_id = ? ORDER BY id DESC").all(campaignId) as any[]
  ).map(rowToImage);
  return pickBestReferenceImages(tags, portraits, campaignImages);
}

export function listCampaignImages(campaignId: number): RegisteredImage[] {
  return db
    .prepare("SELECT * FROM image_registry WHERE campaign_id = ? ORDER BY id DESC")
    .all(campaignId)
    .map(rowToImage);
}
