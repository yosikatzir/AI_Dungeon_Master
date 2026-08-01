"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"surprise" | "guided">("surprise");
  const [guidelines, setGuidelines] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mode,
          guidelines: mode === "guided" ? guidelines : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create campaign");
        return;
      }
      router.push(`/campaigns/${data.id}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="font-serif text-2xl text-amber-100">New Campaign</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-amber-200/80">
          Campaign name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded border border-amber-700/40 bg-black/30 px-3 py-2 text-amber-50"
          />
        </label>

        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode("surprise")}
            className={`rounded px-3 py-1 ${mode === "surprise" ? "bg-amber-700 text-amber-50" : "border border-amber-700/40 text-amber-200/70"}`}
          >
            Surprise me
          </button>
          <button
            type="button"
            onClick={() => setMode("guided")}
            className={`rounded px-3 py-1 ${mode === "guided" ? "bg-amber-700 text-amber-50" : "border border-amber-700/40 text-amber-200/70"}`}
          >
            I&apos;ll give guidelines
          </button>
        </div>

        {mode === "surprise" ? (
          <p className="text-sm text-amber-200/50">
            The DM will invent the setting, tone, and opening scene once play begins.
          </p>
        ) : (
          <label className="flex flex-col gap-1 text-sm text-amber-200/80">
            Guidelines (theme, setting, tone, party level — anything)
            <textarea
              value={guidelines}
              onChange={(e) => setGuidelines(e.target.value)}
              rows={5}
              className="rounded border border-amber-700/40 bg-black/30 px-3 py-2 text-amber-50"
            />
          </label>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="mt-2 rounded bg-amber-700 px-4 py-2 font-medium text-amber-50 hover:bg-amber-600 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create Campaign"}
        </button>
      </form>
    </main>
  );
}
