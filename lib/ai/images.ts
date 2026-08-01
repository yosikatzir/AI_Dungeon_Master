import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { toFile } from "openai";
import { openai, withRetry } from "@/lib/ai/openai";
import { IMAGE_MODEL, IMAGE_STYLE } from "@/lib/ai/config";
import { findReferenceImage, registerImage, type ImageKind } from "@/lib/images";
import { getCharacterRecord } from "@/lib/characters";

const IMAGES_DIR = path.join(process.cwd(), "data", "images");

async function generateImageBuffer(params: {
  prompt: string;
  referenceFilePaths: string[];
}): Promise<Buffer> {
  if (params.referenceFilePaths.length > 0) {
    const files = await Promise.all(
      params.referenceFilePaths.map(async (filename) => {
        const buffer = await fs.readFile(path.join(IMAGES_DIR, filename));
        return toFile(buffer, filename);
      }),
    );
    const result = await withRetry(() =>
      openai.images.edit({
        model: IMAGE_MODEL,
        image: files,
        prompt: `${params.prompt}\n\nThe subject must match the appearance shown in the reference image(s).`,
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
 * Generates one campaign image (scene, portrait, NPC, or map), automatically
 * passing a prior reference image for the same subject (or a character's
 * uploaded portrait) so recurring subjects stay visually consistent, then
 * registers the result.
 */
export async function generateCampaignImage(params: {
  campaignId: number;
  kind: ImageKind;
  subject: string;
  subjectTags: string[];
  characterIdForReference?: number;
}): Promise<{ filePath: string; prompt: string }> {
  const referencePaths: string[] = [];

  if (params.characterIdForReference) {
    const character = getCharacterRecord(params.characterIdForReference);
    if (character?.portraitPath) referencePaths.push(character.portraitPath);
  }
  const existingRef = findReferenceImage(params.subjectTags);
  if (existingRef && !referencePaths.includes(existingRef.filePath)) {
    referencePaths.push(existingRef.filePath);
  }

  const prompt = buildPrompt(params.kind, params.subject);
  const buffer = await generateImageBuffer({ prompt, referenceFilePaths: referencePaths });
  const filePath = await saveGeneratedImage(buffer, params.kind);

  registerImage({
    campaignId: params.campaignId,
    kind: params.kind,
    subjectTags: params.subjectTags,
    prompt,
    filePath,
  });

  return { filePath, prompt };
}
