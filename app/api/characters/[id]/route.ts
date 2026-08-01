import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCharacterRecord,
  resolveCharacter,
  updateCharacter,
  updateCharacterIdentity,
  softDeleteCharacter,
} from "@/lib/characters";
import { addMessage, getCampaignMembers } from "@/lib/campaigns";
import { getIoInstance } from "@/lib/realtime/ioInstance";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { updateCharacterSchema, updateCharacterIdentitySchema } from "@/lib/validation/character";

const patchCharacterSchema = updateCharacterSchema.merge(updateCharacterIdentitySchema);

async function loadOwnedCharacter(req: NextRequest, id: number, { allowDeleted = false } = {}) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const record = getCharacterRecord(id);
  if (!record || record.userId !== user.id || (record.isDeleted && !allowDeleted)) {
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
  const parsed = patchCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name, alignment, appearance, backstory, ...playFields } = parsed.data;
  updateCharacter(id, playFields);
  updateCharacterIdentity(id, { name, alignment, appearance, backstory });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const loaded = await loadOwnedCharacter(req, id);
  if ("error" in loaded) return loaded.error;

  const affectedCampaignIds = softDeleteCharacter(id);

  const io = getIoInstance();
  for (const campaignId of affectedCampaignIds) {
    const message = addMessage({
      campaignId,
      senderType: "system",
      userId: null,
      characterId: null,
      content: `${loaded.record.name} has left the party.`,
    });
    io?.to(`campaign:${campaignId}`).emit("new_message", message);
    io?.to(`campaign:${campaignId}`).emit("members_update", getCampaignMembers(campaignId));
  }

  return NextResponse.json({ ok: true });
}
