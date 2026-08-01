"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CharacterIdentityEditor({
  characterId,
  name,
  alignment,
  appearance,
  backstory,
}: {
  characterId: number;
  name: string;
  alignment: string | null;
  appearance: string | null;
  backstory: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editAlignment, setEditAlignment] = useState(alignment ?? "");
  const [editAppearance, setEditAppearance] = useState(appearance ?? "");
  const [editBackstory, setEditBackstory] = useState(backstory ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!editName.trim()) {
      setError("Name can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          alignment: editAlignment.trim() || null,
          appearance: editAppearance.trim() || null,
          backstory: editBackstory.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save changes");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="min-h-[44px] rounded border border-amber-700/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-900/30"
      >
        Edit details
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-800/30 bg-black/20 p-4">
      <label className="flex flex-col gap-1 text-sm text-amber-200/80">
        Name
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-amber-200/80">
        Alignment
        <input
          value={editAlignment}
          onChange={(e) => setEditAlignment(e.target.value)}
          placeholder="e.g. Chaotic Good"
          className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-amber-200/80">
        Appearance
        <textarea
          value={editAppearance}
          onChange={(e) => setEditAppearance(e.target.value)}
          rows={3}
          placeholder="Height, build, scars, how you carry yourself — the DM uses this to decide how NPCs react to you on sight."
          className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-amber-200/80">
        Backstory
        <textarea
          value={editBackstory}
          onChange={(e) => setEditBackstory(e.target.value)}
          rows={5}
          className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="min-h-[44px] rounded bg-amber-700 px-4 py-2 text-sm text-amber-50 hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={saving}
          className="min-h-[44px] rounded border border-amber-700/40 px-4 py-2 text-sm text-amber-200/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
