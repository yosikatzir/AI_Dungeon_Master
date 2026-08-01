import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { leaveCampaignPermanently } from "@/lib/campaigns";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = Number((await params).id);
  leaveCampaignPermanently(campaignId, user.id);
  return NextResponse.json({ ok: true });
}
