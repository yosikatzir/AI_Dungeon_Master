import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCharacterRecord, rebuildCharacter, CharacterValidationError } from "@/lib/characters";
import { createCharacterSchema } from "@/lib/validation/character";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  const record = getCharacterRecord(id);
  if (!record || record.userId !== user.id || record.isDeleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    rebuildCharacter(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CharacterValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
