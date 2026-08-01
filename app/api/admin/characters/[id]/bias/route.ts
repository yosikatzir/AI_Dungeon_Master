import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDiceBias, setDiceBias } from "@/lib/engine/bias";

const biasSchema = z.object({
  mode: z.enum(["none", "flat", "advantage_weighted"]),
  flatBonus: z.number().int().min(-10).max(10),
});

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return null;
  return user;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const characterId = Number((await params).id);
  return NextResponse.json({ bias: getDiceBias(characterId) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const characterId = Number((await params).id);
  const body = await req.json().catch(() => null);
  const parsed = biasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  setDiceBias(characterId, parsed.data);
  return NextResponse.json({ ok: true });
}
