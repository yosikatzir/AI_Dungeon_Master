import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth";
import { getCharacterRecord, setCharacterPortrait } from "@/lib/characters";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  const character = getCharacterRecord(id);
  if (!character || character.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("portrait");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing portrait file" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Portrait must be a JPEG, PNG, WebP, or GIF image" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Portrait must be under 8 MB" }, { status: 400 });
  }

  const filename = `character_${id}_${randomUUID()}.${ext}`;
  const imagesDir = path.join(process.cwd(), "data", "images");
  await fs.mkdir(imagesDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(imagesDir, filename), buffer);

  setCharacterPortrait(id, filename);

  return NextResponse.json({ ok: true, portraitPath: filename });
}
