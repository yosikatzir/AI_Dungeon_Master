import { NextRequest, NextResponse } from "next/server";
import { toFile } from "openai";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/campaigns";
import { openai, withRetry, AiError } from "@/lib/ai/openai";
import { WHISPER_MODEL } from "@/lib/ai/config";

const MAX_BYTES = 25 * 1024 * 1024; // Whisper's own limit

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = Number((await params).id);
  const membership = getMembership(campaignId, user.id);
  if (!membership || membership.status !== "active") {
    return NextResponse.json({ error: "Not a member of this campaign" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("audio");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Recording is too long" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadable = await toFile(buffer, "recording.webm");
    const transcription = await withRetry(() =>
      openai.audio.transcriptions.create({ file: uploadable, model: WHISPER_MODEL }),
    );
    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    const message = err instanceof AiError ? err.userFacing : "Could not transcribe that recording.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
