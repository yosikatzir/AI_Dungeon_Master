"use client";

import { useEffect, useState } from "react";
import { ABILITIES, ABILITY_NAMES, SKILLS, type Ability } from "@/lib/rules/constants";

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export type RollPurpose =
  | { type: "raw"; sides: 4 | 6 | 8 | 10 | 12 | 20 | 100 }
  | { type: "ability_check"; ability: Ability; dc?: number }
  | { type: "saving_throw"; ability: Ability; dc?: number }
  | { type: "skill_check"; skill: string; dc?: number }
  | { type: "attack"; ac?: number };

export interface PendingRequest {
  rollType: "ability_check" | "saving_throw" | "skill_check" | "attack";
  ability?: string;
  skill?: string;
  dc?: number;
  reason: string;
}

export default function DiceTray({
  hasCharacter,
  pendingRequest,
  onRoll,
}: {
  hasCharacter: boolean;
  pendingRequest: PendingRequest | null;
  onRoll: (purpose: RollPurpose) => void;
}) {
  const [rollingSides, setRollingSides] = useState<number | null>(null);
  const [purposeKind, setPurposeKind] = useState<
    "raw" | "ability_check" | "saving_throw" | "skill_check" | "attack"
  >("raw");
  const [ability, setAbility] = useState<Ability>("str");
  const [skill, setSkill] = useState<string>(SKILLS[0].id);
  const [dc, setDc] = useState<string>("");

  // The DM's request pre-fills (and highlights) exactly what's being asked for.
  useEffect(() => {
    if (!pendingRequest) return;
    setPurposeKind(pendingRequest.rollType);
    if (pendingRequest.ability) setAbility(pendingRequest.ability as Ability);
    if (pendingRequest.skill) setSkill(pendingRequest.skill);
    setDc(pendingRequest.dc !== undefined ? String(pendingRequest.dc) : "");
  }, [pendingRequest]);

  function rollSide(sides: (typeof DICE)[number]) {
    setRollingSides(sides);
    const dcNumber = dc.trim() ? Number(dc) : undefined;

    let purpose: RollPurpose;
    if (sides === 20 && hasCharacter && purposeKind !== "raw") {
      purpose =
        purposeKind === "ability_check"
          ? { type: "ability_check", ability, dc: dcNumber }
          : purposeKind === "saving_throw"
            ? { type: "saving_throw", ability, dc: dcNumber }
            : purposeKind === "skill_check"
              ? { type: "skill_check", skill, dc: dcNumber }
              : { type: "attack", ac: dcNumber };
    } else {
      purpose = { type: "raw", sides };
    }

    // A brief tumble animation before the result posts to the log.
    setTimeout(() => {
      onRoll(purpose);
      setRollingSides(null);
    }, 900);
  }

  return (
    <div className="rounded border border-amber-800/30 p-3">
      <h3 className="text-xs uppercase tracking-wide text-amber-200/50">Dice Tray</h3>

      {pendingRequest && (
        <p className="mt-1 text-xs text-amber-300">
          The DM is waiting on your roll{pendingRequest.reason ? ` — ${pendingRequest.reason}` : ""}.
        </p>
      )}

      {hasCharacter && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <select
            value={purposeKind}
            onChange={(e) => setPurposeKind(e.target.value as typeof purposeKind)}
            className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
          >
            <option value="raw">Plain roll (d20)</option>
            <option value="ability_check">Ability check</option>
            <option value="saving_throw">Saving throw</option>
            <option value="skill_check">Skill check</option>
            <option value="attack">Attack</option>
          </select>

          {(purposeKind === "ability_check" || purposeKind === "saving_throw") && (
            <select
              value={ability}
              onChange={(e) => setAbility(e.target.value as Ability)}
              className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
            >
              {ABILITIES.map((a) => (
                <option key={a} value={a}>
                  {ABILITY_NAMES[a]}
                </option>
              ))}
            </select>
          )}

          {purposeKind === "skill_check" && (
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
            >
              {SKILLS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {purposeKind !== "raw" && (
            <input
              type="number"
              placeholder="DC (optional)"
              value={dc}
              onChange={(e) => setDc(e.target.value)}
              className="w-24 rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
            />
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {DICE.map((sides) => {
          const isHighlighted = pendingRequest !== null && sides === 20 && rollingSides === null;
          return (
            <button
              key={sides}
              onClick={() => rollSide(sides)}
              disabled={rollingSides !== null}
              className={`rounded border px-3 py-2 text-sm font-medium transition ${
                rollingSides === sides
                  ? "animate-spin border-amber-400 text-amber-300"
                  : isHighlighted
                    ? "animate-pulse border-amber-300 bg-amber-800/40 text-amber-100"
                    : "border-amber-700/40 text-amber-100 hover:bg-amber-900/30"
              } disabled:opacity-40`}
            >
              {isHighlighted ? "Roll for it!" : `d${sides}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
