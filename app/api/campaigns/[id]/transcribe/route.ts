import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  DeleteTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import { getCurrentUser } from "@/lib/auth";
import { getMembership } from "@/lib/campaigns";
import { TRANSCRIBE_LANGUAGE_CODE, DATA_BUCKET_NAME } from "@/lib/ai/config";

const MAX_BYTES = 25 * 1024 * 1024;
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

const region = process.env.AWS_REGION || "us-east-1";
const s3 = new S3Client({ region });
const transcribe = new TranscribeClient({ region });

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

  const jobName = randomUUID();
  const s3Key = `transcribe-tmp/${jobName}.webm`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await s3.send(new PutObjectCommand({ Bucket: DATA_BUCKET_NAME, Key: s3Key, Body: buffer }));

    await transcribe.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        LanguageCode: TRANSCRIBE_LANGUAGE_CODE,
        MediaFormat: "webm",
        Media: { MediaFileUri: `s3://${DATA_BUCKET_NAME}/${s3Key}` },
      }),
    );

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let status: string | undefined;
    let transcriptUri: string | undefined;
    let failureReason: string | undefined;

    while (Date.now() < deadline) {
      const { TranscriptionJob: job } = await transcribe.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }),
      );
      status = job?.TranscriptionJobStatus;
      transcriptUri = job?.Transcript?.TranscriptFileUri;
      failureReason = job?.FailureReason;
      if (status === "COMPLETED" || status === "FAILED") break;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (status !== "COMPLETED" || !transcriptUri) {
      throw new Error(failureReason || `Transcription did not complete (status: ${status ?? "timed out"}).`);
    }

    const transcriptResponse = await fetch(transcriptUri);
    const transcriptJson = await transcriptResponse.json();
    const text: string = transcriptJson?.results?.transcripts?.[0]?.transcript ?? "";

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Could not transcribe that recording." }, { status: 502 });
  } finally {
    await Promise.allSettled([
      transcribe.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobName })),
      s3.send(new DeleteObjectCommand({ Bucket: DATA_BUCKET_NAME, Key: s3Key })),
    ]);
  }
}
