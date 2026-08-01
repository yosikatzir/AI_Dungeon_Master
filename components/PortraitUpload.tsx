"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function PortraitUpload({
  characterId,
  portraitPath,
}: {
  characterId: number;
  portraitPath: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("portrait", file);
      const res = await fetch(`/api/characters/${characterId}/portrait`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-32 w-32 overflow-hidden rounded-lg border border-amber-800/40 bg-black/30">
        {portraitPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from an authenticated internal API route, not a static/optimizable asset
          <img
            src={`/api/images/${portraitPath}`}
            alt="Character portrait"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-amber-200/40">
            No portrait
          </div>
        )}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded border border-amber-700/40 px-3 py-1 text-xs text-amber-200 hover:bg-amber-900/30 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : portraitPath ? "Change portrait" : "Upload portrait"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
