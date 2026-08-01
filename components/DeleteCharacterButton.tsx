"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCharacterButton({
  characterId,
  characterName,
  enrolledInActiveCampaigns,
}: {
  characterId: number;
  characterName: string;
  enrolledInActiveCampaigns: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete character");
        return;
      }
      router.push("/characters");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="min-h-[44px] rounded border border-red-800/40 px-4 py-2 text-sm text-red-300 hover:bg-red-950/30"
      >
        Delete character
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-red-800/40 bg-red-950/10 p-4">
      <p className="text-sm text-red-200">
        This can&apos;t be undone. {characterName} will disappear from your character list
        {enrolledInActiveCampaigns && " and will leave every campaign they're currently enrolled in"}.
        Type <span className="font-semibold text-red-100">{characterName}</span> to confirm.
      </p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={characterName}
        className="rounded border border-red-700/40 bg-black/30 px-2 py-2 text-red-50"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={confirmText !== characterName || deleting}
          className="min-h-[44px] rounded bg-red-800 px-4 py-2 text-sm text-red-50 hover:bg-red-700 disabled:opacity-40"
        >
          {deleting ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setConfirmText("");
            setError(null);
          }}
          disabled={deleting}
          className="min-h-[44px] rounded border border-amber-700/40 px-4 py-2 text-sm text-amber-200/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
