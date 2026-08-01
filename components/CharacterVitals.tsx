"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CharacterVitals({
  characterId,
  hpCurrent,
  hpMax,
  tempHp,
  inspiration,
}: {
  characterId: number;
  hpCurrent: number;
  hpMax: number;
  tempHp: number;
  inspiration: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch(`/api/characters/${characterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function adjustHp(delta: number) {
    const next = Math.max(0, Math.min(hpMax, hpCurrent + delta));
    patch({ hpCurrent: next });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-800/30 p-4">
      <div className="flex items-center justify-between text-sm text-amber-200/70">
        <span>Hit Points</span>
        <span className="text-amber-100">
          {hpCurrent} / {hpMax}
          {tempHp > 0 && <span className="text-amber-400"> (+{tempHp} temp)</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-black/40">
        <div
          className="h-full bg-red-700"
          style={{ width: `${hpMax > 0 ? Math.min(100, (hpCurrent / hpMax) * 100) : 0}%` }}
        />
      </div>
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={() => adjustHp(-1)}
          className="rounded border border-amber-700/40 px-3 py-1 text-sm text-amber-100 disabled:opacity-50"
        >
          −1
        </button>
        <button
          disabled={saving}
          onClick={() => adjustHp(-5)}
          className="rounded border border-amber-700/40 px-3 py-1 text-sm text-amber-100 disabled:opacity-50"
        >
          −5
        </button>
        <button
          disabled={saving}
          onClick={() => adjustHp(1)}
          className="rounded border border-amber-700/40 px-3 py-1 text-sm text-amber-100 disabled:opacity-50"
        >
          +1
        </button>
        <button
          disabled={saving}
          onClick={() => adjustHp(5)}
          className="rounded border border-amber-700/40 px-3 py-1 text-sm text-amber-100 disabled:opacity-50"
        >
          +5
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-amber-200/70">
        <input
          type="checkbox"
          checked={inspiration}
          disabled={saving}
          onChange={(e) => patch({ inspiration: e.target.checked })}
        />
        Inspiration
      </label>
    </div>
  );
}
