"use client";

import { useState } from "react";
import type { DiceBiasConfig, DiceBiasMode } from "@/lib/rules/dice";

interface CharacterRow {
  id: number;
  name: string;
  ownerUsername: string;
  bias: DiceBiasConfig;
}

export default function AdminDiceBiasPanel({ characters }: { characters: CharacterRow[] }) {
  const [rows, setRows] = useState(characters);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function save(characterId: number, bias: DiceBiasConfig) {
    setSavingId(characterId);
    try {
      await fetch(`/api/admin/characters/${characterId}/bias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bias),
      });
      setRows((prev) => prev.map((r) => (r.id === characterId ? { ...r, bias } : r)));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <p className="text-sm text-amber-200/50">No characters have been created yet.</p>
      )}
      {rows.map((row) => (
        <div key={row.id} className="rounded border border-amber-800/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-amber-100">{row.name}</span>{" "}
              <span className="text-xs text-amber-200/50">({row.ownerUsername})</span>
            </div>
            {savingId === row.id && <span className="text-xs text-amber-400">saving…</span>}
          </div>

          <div className="mt-2 flex items-center gap-3 text-sm">
            <select
              value={row.bias.mode}
              onChange={(e) =>
                save(row.id, { ...row.bias, mode: e.target.value as DiceBiasMode })
              }
              className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
            >
              <option value="none">No bias</option>
              <option value="flat">Flat bonus</option>
              <option value="advantage_weighted">Advantage-weighted</option>
            </select>

            {row.bias.mode === "flat" && (
              <label className="flex items-center gap-2 text-amber-200/80">
                Bonus
                <input
                  type="number"
                  min={-10}
                  max={10}
                  value={row.bias.flatBonus}
                  onChange={(e) =>
                    save(row.id, { ...row.bias, flatBonus: Number(e.target.value) })
                  }
                  className="w-16 rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
                />
              </label>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
