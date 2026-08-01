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

/** Most recent registered image whose subject tags overlap the given tags — used as a reference for consistency. */
export function findReferenceImage(subjectTags: string[]): RegisteredImage | null {
  if (subjectTags.length === 0) return null;
  const rows = db
    .prepare("SELECT * FROM image_registry ORDER BY id DESC")
    .all() as any[];
  const needle = new Set(subjectTags.map((t) => t.toLowerCase()));
  for (const row of rows) {
    const tags: string[] = JSON.parse(row.subject_tags);
    if (tags.some((t) => needle.has(t.toLowerCase()))) {
      return rowToImage(row);
    }
  }
  return null;
}

export function listCampaignImages(campaignId: number): RegisteredImage[] {
  return db
    .prepare("SELECT * FROM image_registry WHERE campaign_id = ? ORDER BY id DESC")
    .all(campaignId)
    .map(rowToImage);
}
