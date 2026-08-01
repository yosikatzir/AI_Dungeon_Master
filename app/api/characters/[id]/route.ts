import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCharacterRecord, resolveCharacter, updateCharacter } from "@/lib/characters";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { updateCharacterSchema } from "@/lib/validation/character";

async function loadOwnedCharacter(req: NextRequest, id: number) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const record = getCharacterRecord(id);
  if (!record || record.userId !== user.id) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { user, record };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const loaded = await loadOwnedCharacter(req, id);
  if ("error" in loaded) return loaded.error;

  const resolved = resolveCharacter(id);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sheet = computeCharacterSheet(resolved);
  return NextResponse.json({
    character: resolved.character,
    species: resolved.species,
    klass: resolved.klass,
    subclass: resolved.subclass,
    background: resolved.background,
    items: resolved.items,
    sheet,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const loaded = await loadOwnedCharacter(req, id);
  if ("error" in loaded) return loaded.error;

  const body = await req.json().catch(() => null);
  const parsed = updateCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  updateCharacter(id, parsed.data);
  return NextResponse.json({ ok: true });
}
