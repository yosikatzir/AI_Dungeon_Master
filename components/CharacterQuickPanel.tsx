"use client";

import { useState } from "react";

export interface QuickPanelCharacter {
  id: number;
  name: string;
  hpCurrent: number;
  tempHp: number;
  hpMax: number;
  spellSlots: { max: number[]; used: Record<number, number> } | null;
}

export default function CharacterQuickPanel({
  character,
  onDamage,
  onHeal,
  onConsumeSlot,
  onLongRest,
}: {
  character: QuickPanelCharacter;
  onDamage: (amount: number) => void;
  onHeal: (amount: number) => void;
  onConsumeSlot: (level: number) => void;
  onLongRest: () => void;
}) {
  const [amount, setAmount] = useState("1");
  const amountNumber = Math.max(0, Number(amount) || 0);

  return (
    <div className="rounded border border-amber-800/30 p-3">
      <h3 className="text-xs uppercase tracking-wide text-amber-200/50">{character.name}</h3>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-amber-200/70">HP</span>
        <span className="text-amber-100">
          {character.hpCurrent} / {character.hpMax}
          {character.tempHp > 0 && <span className="text-amber-400"> (+{character.tempHp})</span>}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-black/40">
        <div
          className="h-full bg-red-700"
          style={{
            width: `${character.hpMax > 0 ? Math.min(100, (character.hpCurrent / character.hpMax) * 100) : 0}%`,
          }}
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-16 rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-sm text-amber-50"
        />
        <button
          onClick={() => onDamage(amountNumber)}
          className="rounded border border-red-800/40 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
        >
          Damage
        </button>
        <button
          onClick={() => onHeal(amountNumber)}
          className="rounded border border-green-800/40 px-2 py-1 text-xs text-green-300 hover:bg-green-950/30"
        >
          Heal
        </button>
      </div>

      {character.spellSlots && character.spellSlots.max.some((m) => m > 0) && (
        <div className="mt-3">
          <span className="text-xs text-amber-200/60">Spell Slots</span>
          <div className="mt-1 flex flex-col gap-1">
            {character.spellSlots.max.map((max, i) => {
              const level = i + 1;
              if (max === 0) return null;
              const used = character.spellSlots!.used[level] ?? 0;
              return (
                <div key={level} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-amber-200/60">L{level}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: max }, (_, pipIndex) => (
                      <span
                        key={pipIndex}
                        className={`h-3 w-3 rounded-full border ${
                          pipIndex < used ? "border-amber-700/40 bg-black/40" : "border-amber-400 bg-amber-400"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => onConsumeSlot(level)}
                    disabled={used >= max}
                    className="ml-1 text-amber-300 underline disabled:opacity-30"
                  >
                    use
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onLongRest}
        className="mt-3 w-full rounded border border-amber-700/40 py-1 text-xs text-amber-200 hover:bg-amber-900/30"
      >
        Long Rest
      </button>
    </div>
  );
}
