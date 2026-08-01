import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign, joinCampaign } from "@/lib/campaigns";
import { getCharacterRecord } from "@/lib/characters";
import { joinCampaignSchema } from "@/lib/validation/campaign";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = Number((await params).id);
  const campaign = getCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = joinCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const characterId = parsed.data.characterId ?? null;
  if (characterId !== null) {
    const character = getCharacterRecord(characterId);
    if (!character || character.userId !== user.id) {
      return NextResponse.json({ error: "That character isn't yours" }, { status: 400 });
    }
    if (character.isDeleted) {
      return NextResponse.json({ error: "That character has been deleted" }, { status: 400 });
    }
  }

  joinCampaign(campaignId, user.id, characterId);
  return NextResponse.json({ ok: true });
}
