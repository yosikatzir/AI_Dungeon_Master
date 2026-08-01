"use client";

import { useRef, useState } from "react";

export default function VoiceRecordButton({
  campaignId,
  onTranscribed,
}: {
  campaignId: number;
  onTranscribed: (text: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    if (recording || busy) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Couldn't access the microphone.");
    }
  }

  function stopRecordingAndGetBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.stop();
    });
  }

  async function handleRelease() {
    if (!recording) return;
    setRecording(false);
    setBusy(true);
    try {
      const blob = await stopRecordingAndGetBlob();
      if (!blob || blob.size === 0) return;

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const res = await fetch(`/api/campaigns/${campaignId}/transcribe`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not transcribe that.");
        return;
      }
      if (data.text?.trim()) onTranscribed(data.text.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onMouseDown={startRecording}
        onMouseUp={handleRelease}
        onMouseLeave={() => recording && handleRelease()}
        onTouchStart={(e) => {
          e.preventDefault();
          startRecording();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleRelease();
        }}
        disabled={busy}
        className={`h-11 w-11 shrink-0 rounded-full border text-lg transition ${
          recording
            ? "animate-pulse border-red-400 bg-red-900/40 text-red-200"
            : "border-amber-700/40 text-amber-100 hover:bg-amber-900/30"
        } disabled:opacity-50`}
        title="Hold to record"
      >
        {busy ? "…" : "🎤"}
      </button>
      {error && <p className="mt-1 max-w-[6rem] text-center text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
