import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { toFile } from "openai";
import { openai, withRetry } from "@/lib/ai/openai";
import { IMAGE_MODEL, IMAGE_STYLE } from "@/lib/ai/config";
import { findReferenceImages, registerImage, type ImageKind } from "@/lib/images";
import { getCharacterRecord } from "@/lib/characters";

const IMAGES_DIR = path.join(process.cwd(), "data", "images");

/** openai's `toFile` doesn't infer a MIME type from the filename — without
 *  an explicit `type`, uploads default to application/octet-stream, which
 *  images.edit rejects ("unsupported mimetype"). GIF portraits aren't
 *  supported by images.edit at all (only jpeg/png/webp); such a reference
 *  is simply skipped rather than sent with a guessed, likely-wrong type. */
const REFERENCE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** Reference images per generation. More dilutes edit quality and adds
 *  latency/cost without much composition benefit past a small ensemble cast. */
const MAX_REFERENCE_IMAGES = 4;

export interface ImageSubject {
  /** Display name — used both for the subject-tag lookup and the reference manifest in the prompt. */
  name: string;
  /** Set for present party members so their uploaded portrait is preferred over any other reference. */
  characterId?: number;
}

/** "Reference image N shows X — X must match…" — without this, the image
 *  model has no way to tell which of several reference faces belongs to
 *  which named subject once there's more than one. */
export function buildReferenceManifest(names: string[]): string {
  if (names.length === 0) return "";
  const lines = names.map(
    (name, i) =>
      `Reference image ${i + 1} shows ${name} — ${name} in this scene must match that appearance exactly.`,
  );
  return `\n\n${lines.join("\n")}`;
}

/** Detects which of the given candidates (party members, NPCs) are named in
 *  free text — word-boundary and case-insensitive, so a short name doesn't
 *  false-positive on a partial match inside an unrelated word. Matches on
 *  any individual word of the candidate's name, not just the name in full:
 *  players refer to characters informally ("Saulrok", not the full
 *  `Saulrok "Riff-Render" Wylde`), so requiring the whole punctuated name
 *  as one literal substring missed nearly every real reference. */
export function detectSubjectsInText(text: string, candidates: ImageSubject[]): ImageSubject[] {
  return candidates.filter((c) => {
    const tokens = c.name
      .split(/\s+/)
      .map((t) => t.replace(/^[^\w]+|[^\w]+$/g, "")) // strip surrounding punctuation/quotes, keep internal (e.g. "Riff-Render")
      .filter((t) => t.length > 0);
    return tokens.some((token) => {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "i").test(text);
    });
  });
}

async function generateImageBuffer(params: {
  prompt: string;
  referenceFilePaths: string[];
}): Promise<Buffer> {
  if (params.referenceFilePaths.length > 0) {
    const files = (
      await Promise.all(
        params.referenceFilePaths.map(async (filename) => {
          const type = REFERENCE_MIME_BY_EXT[path.extname(filename).toLowerCase()];
          if (!type) return null; // e.g. an unsupported GIF portrait — skip rather than guess
          const buffer = await fs.readFile(path.join(IMAGES_DIR, filename));
          return toFile(buffer, filename, { type });
        }),
      )
    ).filter((f) => f !== null);
    const result = await withRetry(() =>
      openai.images.edit({
        model: IMAGE_MODEL,
        image: files,
        prompt: params.prompt,
      }),
    );
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned");
    return Buffer.from(b64, "base64");
  }

  const result = await withRetry(() =>
    openai.images.generate({
      model: IMAGE_MODEL,
      prompt: params.prompt,
      size: "1024x1024",
    }),
  );
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned");
  return Buffer.from(b64, "base64");
}

async function saveGeneratedImage(buffer: Buffer, prefix: string): Promise<string> {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  const filename = `${prefix}_${randomUUID()}.png`;
  await fs.writeFile(path.join(IMAGES_DIR, filename), buffer);
  return filename;
}

function buildPrompt(kind: ImageKind, subject: string): string {
  if (kind === "map") {
    return `A hand-drawn fantasy map on aged parchment, with labeled locations and a compass rose. Depicts: ${subject}.\n\nStyle: aged parchment map illustration, warm sepia tones, decorative linework — not the general campaign art style.`;
  }
  return `${subject}\n\nStyle: ${IMAGE_STYLE}`;
}

/**
 * Generates one campaign image (scene, portrait, NPC, or map). `subjects`
 * lists everyone depicted (party members with their characterId, NPCs and
 * locations without) — each gets its own reference image if one exists
 * (uploaded portrait first, otherwise the newest prior registry image for
 * that name), so a scene with several named subjects keeps all of their
 * established appearances consistent instead of just one. Registers the
 * result under every subject's tag (plus the raw subject string) so the new
 * image becomes a future reference for each of them too.
 */
export async function generateCampaignImage(params: {
  campaignId: number;
  kind: ImageKind;
  subject: string;
  subjects?: ImageSubject[];
}): Promise<{ filePath: string; prompt: string }> {
  const subjects = params.subjects ?? [];
  const subjectTags = [params.subject.toLowerCase(), ...subjects.map((s) => s.name.toLowerCase())];

  const registryRefs = findReferenceImages(
    subjects.map((s) => s.name),
    params.campaignId,
  );

  const resolved: { name: string; filePath: string; isPartyMember: boolean }[] = [];
  for (const s of subjects) {
    const portraitPath = s.characterId ? getCharacterRecord(s.characterId)?.portraitPath : null;
    const filePath = portraitPath ?? registryRefs.get(s.name)?.filePath;
    if (filePath) {
      resolved.push({ name: s.name, filePath, isPartyMember: s.characterId !== undefined });
    }
  }

  // Present party members take priority over NPCs/locations when there are more references than the cap.
  resolved.sort((a, b) => Number(b.isPartyMember) - Number(a.isPartyMember));
  const capped = resolved.slice(0, MAX_REFERENCE_IMAGES);

  const prompt = `${buildPrompt(params.kind, params.subject)}${buildReferenceManifest(capped.map((r) => r.name))}`;
  const buffer = await generateImageBuffer({
    prompt,
    referenceFilePaths: capped.map((r) => r.filePath),
  });
  const filePath = await saveGeneratedImage(buffer, params.kind);

  registerImage({
    campaignId: params.campaignId,
    kind: params.kind,
    subjectTags,
    prompt,
    filePath,
  });

  return { filePath, prompt };
}
