import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCampaign, listActiveCampaigns, setCampaignPremise, getCampaign } from "@/lib/campaigns";
import { createCampaignSchema } from "@/lib/validation/campaign";
import { runDmTurn } from "@/lib/ai/dm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ campaigns: listActiveCampaigns() });
}

function kickoffInstruction(mode: "surprise" | "guided", guidelines: string | undefined): string {
  const base =
    mode === "guided" && guidelines?.trim()
      ? `Begin the campaign. The player has given these guidelines for what they want: "${guidelines.trim()}". Invent a premise consistent with them.`
      : `Begin the campaign. Invent an original premise, setting, and tone entirely of your own — surprise the players.`;
  return `${base} Narrate the opening scene (2-4 paragraphs, per your usual style). Call advance_scene once to record the starting location. End with a hook or question, as always. There is no party present yet to name individually — address the players generally.`;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const id = createCampaign(user.id, parsed.data);

  const opening = await runDmTurn(id, {
    kickoffInstruction: kickoffInstruction(parsed.data.mode, parsed.data.guidelines),
  }).catch(() => null);

  if (opening) {
    const campaign = getCampaign(id);
    setCampaignPremise(id, {
      premise: opening,
      openingScene: opening,
      currentScene: campaign?.currentScene || opening.slice(0, 280),
    });
  }

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
