"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ABILITIES,
  ABILITY_NAMES,
  type Ability,
} from "@/lib/rules/constants";
import {
  STANDARD_ARRAY,
  POINT_BUY_BUDGET,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  abilityModifier,
  applyBackgroundAbilityBonus,
  validatePointBuy,
  validateStandardArray,
  validateManualScores,
  type AbilityScores,
} from "@/lib/rules/abilities";
import type { Background, ClassDef, Feat, Species, Spell } from "@/lib/rules/types";

interface Props {
  species: Species[];
  classes: ClassDef[];
  backgrounds: Background[];
  feats: Feat[];
  spells: Spell[];
}

type AbilityMethod = "standard_array" | "point_buy" | "manual";

const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

const STEPS = [
  "Species",
  "Class",
  "Background",
  "Ability Scores",
  "Skills",
  "Spells",
  "Details",
  "Review",
] as const;

export default function CharacterBuilder({ species, classes, backgrounds, feats, spells }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [backgroundId, setBackgroundId] = useState<string | null>(null);

  const [abilityMethod, setAbilityMethod] = useState<AbilityMethod>("standard_array");
  const [baseScores, setBaseScores] = useState<AbilityScores>({
    str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8,
  });
  const [arrayAssignment, setArrayAssignment] = useState<Record<Ability, number | null>>({
    str: null, dex: null, con: null, int: null, wis: null, cha: null,
  });
  const [bonusMode, setBonusMode] = useState<"2-1" | "1-1-1">("2-1");
  const [bonusPlus2, setBonusPlus2] = useState<Ability | null>(null);
  const [bonusPlus1, setBonusPlus1] = useState<Ability | null>(null);

  const [skillChoices, setSkillChoices] = useState<string[]>([]);
  const [cantrips, setCantrips] = useState<string[]>([]);
  const [spellsKnown, setSpellsKnown] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [alignment, setAlignment] = useState("");
  const [appearance, setAppearance] = useState("");
  const [backstory, setBackstory] = useState("");

  const selectedSpecies = useMemo(() => species.find((s) => s.id === speciesId) ?? null, [species, speciesId]);
  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) ?? null, [classes, classId]);
  const selectedBackground = useMemo(
    () => backgrounds.find((b) => b.id === backgroundId) ?? null,
    [backgrounds, backgroundId],
  );
  const originFeat = useMemo(
    () => (selectedBackground ? feats.find((f) => f.id === selectedBackground.originFeatId) ?? null : null),
    [feats, selectedBackground],
  );

  const effectiveBaseScores: AbilityScores = useMemo(
    () =>
      abilityMethod === "standard_array"
        ? {
            str: arrayAssignment.str ?? 0,
            dex: arrayAssignment.dex ?? 0,
            con: arrayAssignment.con ?? 0,
            int: arrayAssignment.int ?? 0,
            wis: arrayAssignment.wis ?? 0,
            cha: arrayAssignment.cha ?? 0,
          }
        : baseScores,
    [abilityMethod, arrayAssignment, baseScores],
  );

  const scoresValid =
    abilityMethod === "standard_array"
      ? validateStandardArray(effectiveBaseScores).valid
      : abilityMethod === "point_buy"
        ? validatePointBuy(effectiveBaseScores).valid
        : validateManualScores(effectiveBaseScores).valid;

  const finalScores: AbilityScores | null = useMemo(() => {
    if (!selectedBackground || !scoresValid) return null;
    try {
      if (bonusMode === "1-1-1") {
        return applyBackgroundAbilityBonus(effectiveBaseScores, selectedBackground.abilityScores, {
          mode: "1-1-1",
        });
      }
      if (!bonusPlus2 || !bonusPlus1 || bonusPlus2 === bonusPlus1) return null;
      return applyBackgroundAbilityBonus(effectiveBaseScores, selectedBackground.abilityScores, {
        mode: "2-1",
        plus2: bonusPlus2,
        plus1: bonusPlus1,
      });
    } catch {
      return null;
    }
  }, [selectedBackground, scoresValid, effectiveBaseScores, bonusMode, bonusPlus2, bonusPlus1]);

  const pointBuyTotal = ABILITIES.reduce((sum, a) => sum + (POINT_BUY_COST[baseScores[a]] ?? 99), 0);

  const availableCantrips = selectedClass
    ? spells.filter((s) => s.level === 0 && s.classes.includes(selectedClass.id))
    : [];
  const availableLevel1Spells = selectedClass
    ? spells.filter((s) => s.level === 1 && s.classes.includes(selectedClass.id))
    : [];
  const spellCap =
    selectedClass && finalScores && selectedClass.spellsPreparedOrKnownAtLevel1 === "ability_plus_level"
      ? Math.max(1, abilityModifier(finalScores[selectedClass.spellcastingAbility!]) + 1)
      : typeof selectedClass?.spellsPreparedOrKnownAtLevel1 === "number"
        ? selectedClass.spellsPreparedOrKnownAtLevel1
        : 0;

  const isCaster = !!selectedClass && selectedClass.spellcastingType !== "none";

  function canAdvance(): boolean {
    switch (STEPS[step]) {
      case "Species": return !!speciesId;
      case "Class": return !!classId;
      case "Background": return !!backgroundId;
      case "Ability Scores": return scoresValid && !!finalScores;
      case "Skills": return selectedClass ? skillChoices.length === selectedClass.skillChoiceCount : false;
      case "Spells": return !isCaster || (cantrips.length <= (selectedClass?.cantripsKnownAtLevel1 ?? 0) && spellsKnown.length <= spellCap);
      case "Details": return name.trim().length > 0;
      default: return true;
    }
  }

  function next() {
    setError(null);
    if (!canAdvance()) {
      setError("Please complete this step before continuing.");
      return;
    }
    let n = step + 1;
    if (STEPS[n] === "Spells" && !isCaster) n += 1; // skip spell step for non-casters
    setStep(Math.min(n, STEPS.length - 1));
  }

  function back() {
    setError(null);
    let n = step - 1;
    if (STEPS[n] === "Spells" && !isCaster) n -= 1;
    setStep(Math.max(n, 0));
  }

  function toggleSkill(id: string) {
    if (!selectedClass) return;
    setSkillChoices((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= selectedClass.skillChoiceCount) return prev;
      return [...prev, id];
    });
  }

  function toggleCantrip(id: string) {
    if (!selectedClass) return;
    setCantrips((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= selectedClass.cantripsKnownAtLevel1) return prev;
      return [...prev, id];
    });
  }

  function toggleSpell(id: string) {
    setSpellsKnown((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= spellCap) return prev;
      return [...prev, id];
    });
  }

  async function submit() {
    if (!selectedClass || !selectedBackground || !speciesId || !finalScores) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          speciesId,
          classId: selectedClass.id,
          backgroundId: selectedBackground.id,
          abilityMethod,
          baseAbilityScores: effectiveBaseScores,
          abilityBonusAllocation:
            bonusMode === "1-1-1" ? { mode: "1-1-1" } : { mode: "2-1", plus2: bonusPlus2, plus1: bonusPlus1 },
          skillProficiencies: skillChoices,
          cantripsKnown: cantrips,
          spellsKnown,
          alignment: alignment || undefined,
          appearance: appearance || undefined,
          backstory: backstory || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create character");
        return;
      }
      router.push(`/characters/${data.id}`);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-2xl text-amber-100">Create a Character</h1>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs text-amber-200/50">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded px-2 py-1 ${i === step ? "bg-amber-800/50 text-amber-100" : ""}`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-lg border border-amber-800/30 bg-black/20 p-6">
        {STEPS[step] === "Species" && (
          <StepGrid>
            {species.map((s) => (
              <OptionCard
                key={s.id}
                selected={speciesId === s.id}
                title={s.name}
                subtitle={`Speed ${s.speed} ft. · ${s.size}`}
                description={s.description}
                onClick={() => setSpeciesId(s.id)}
              />
            ))}
          </StepGrid>
        )}

        {STEPS[step] === "Class" && (
          <StepGrid>
            {classes.map((c) => (
              <OptionCard
                key={c.id}
                selected={classId === c.id}
                title={c.name}
                subtitle={`d${c.hitDie} hit die`}
                description={c.description}
                onClick={() => setClassId(c.id)}
              />
            ))}
          </StepGrid>
        )}

        {STEPS[step] === "Background" && (
          <StepGrid>
            {backgrounds.map((b) => {
              const feat = feats.find((f) => f.id === b.originFeatId);
              return (
                <OptionCard
                  key={b.id}
                  selected={backgroundId === b.id}
                  title={b.name}
                  subtitle={`Skills: ${b.skillProficiencies.join(", ")} · Feat: ${feat?.name ?? b.originFeatId}`}
                  description={b.description}
                  onClick={() => setBackgroundId(b.id)}
                />
              );
            })}
          </StepGrid>
        )}

        {STEPS[step] === "Ability Scores" && selectedBackground && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-2 text-sm">
              {(["standard_array", "point_buy", "manual"] as AbilityMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setAbilityMethod(m)}
                  className={`rounded px-3 py-1 ${abilityMethod === m ? "bg-amber-700 text-amber-50" : "border border-amber-700/40 text-amber-200/70"}`}
                >
                  {m === "standard_array" ? "Standard Array" : m === "point_buy" ? "Point Buy" : "Manual"}
                </button>
              ))}
            </div>

            {abilityMethod === "standard_array" && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {ABILITIES.map((a) => {
                  const used = ABILITIES.filter((x) => x !== a)
                    .map((x) => arrayAssignment[x])
                    .filter((v): v is number => v !== null);
                  const options = STANDARD_ARRAY.filter(
                    (v) => !used.includes(v) || v === arrayAssignment[a],
                  );
                  return (
                    <label key={a} className="flex flex-col gap-1 text-sm text-amber-200/80">
                      {ABILITY_NAMES[a]}
                      <select
                        value={arrayAssignment[a] ?? ""}
                        onChange={(e) =>
                          setArrayAssignment((prev) => ({
                            ...prev,
                            [a]: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
                      >
                        <option value="">—</option>
                        {options.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            )}

            {abilityMethod === "point_buy" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-amber-200/70">
                  Points used: {pointBuyTotal} / {POINT_BUY_BUDGET}
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {ABILITIES.map((a) => (
                    <div key={a} className="flex flex-col gap-1 text-sm text-amber-200/80">
                      {ABILITY_NAMES[a]}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setBaseScores((prev) => ({
                              ...prev,
                              [a]: Math.max(POINT_BUY_MIN, prev[a] - 1),
                            }))
                          }
                          className="rounded border border-amber-700/40 px-2 text-amber-100"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-amber-50">{baseScores[a]}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setBaseScores((prev) => ({
                              ...prev,
                              [a]: Math.min(POINT_BUY_MAX, prev[a] + 1),
                            }))
                          }
                          className="rounded border border-amber-700/40 px-2 text-amber-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {abilityMethod === "manual" && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {ABILITIES.map((a) => (
                  <label key={a} className="flex flex-col gap-1 text-sm text-amber-200/80">
                    {ABILITY_NAMES[a]}
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={baseScores[a]}
                      onChange={(e) =>
                        setBaseScores((prev) => ({ ...prev, [a]: Number(e.target.value) }))
                      }
                      className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
                    />
                  </label>
                ))}
              </div>
            )}

            {!scoresValid && (
              <p className="text-sm text-red-400">Scores aren&apos;t legal for this method yet.</p>
            )}

            <div className="border-t border-amber-800/30 pt-4">
              <p className="text-sm text-amber-200/80">
                Background bonus — {selectedBackground.name} grants a bonus among{" "}
                {selectedBackground.abilityScores.map((a) => ABILITY_NAMES[a]).join(", ")}.
              </p>
              <div className="mt-2 flex gap-2 text-sm">
                <button
                  onClick={() => setBonusMode("2-1")}
                  className={`rounded px-3 py-1 ${bonusMode === "2-1" ? "bg-amber-700 text-amber-50" : "border border-amber-700/40 text-amber-200/70"}`}
                >
                  +2 / +1
                </button>
                <button
                  onClick={() => setBonusMode("1-1-1")}
                  className={`rounded px-3 py-1 ${bonusMode === "1-1-1" ? "bg-amber-700 text-amber-50" : "border border-amber-700/40 text-amber-200/70"}`}
                >
                  +1 / +1 / +1
                </button>
              </div>
              {bonusMode === "2-1" && (
                <div className="mt-3 flex gap-4 text-sm">
                  <label className="flex flex-col gap-1 text-amber-200/80">
                    +2 to
                    <select
                      value={bonusPlus2 ?? ""}
                      onChange={(e) => setBonusPlus2((e.target.value || null) as Ability | null)}
                      className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
                    >
                      <option value="">—</option>
                      {selectedBackground.abilityScores.map((a) => (
                        <option key={a} value={a}>{ABILITY_NAMES[a]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-amber-200/80">
                    +1 to
                    <select
                      value={bonusPlus1 ?? ""}
                      onChange={(e) => setBonusPlus1((e.target.value || null) as Ability | null)}
                      className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
                    >
                      <option value="">—</option>
                      {selectedBackground.abilityScores.map((a) => (
                        <option key={a} value={a}>{ABILITY_NAMES[a]}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            {finalScores && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-amber-100 sm:grid-cols-6">
                {ABILITIES.map((a) => (
                  <div key={a} className="rounded border border-amber-800/30 p-2 text-center">
                    <div className="text-xs text-amber-200/60">{a.toUpperCase()}</div>
                    <div className="text-lg">{finalScores[a]}</div>
                    <div className="text-xs text-amber-200/50">
                      {abilityModifier(finalScores[a]) >= 0 ? "+" : ""}
                      {abilityModifier(finalScores[a])}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {STEPS[step] === "Skills" && selectedClass && (
          <div>
            <p className="text-sm text-amber-200/70">
              Choose {selectedClass.skillChoiceCount} skill{selectedClass.skillChoiceCount === 1 ? "" : "s"} ({skillChoices.length}/{selectedClass.skillChoiceCount} selected)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectedClass.skillChoices.map((skillId) => (
                <label key={skillId} className="flex items-center gap-2 text-sm text-amber-200/80">
                  <input
                    type="checkbox"
                    checked={skillChoices.includes(skillId)}
                    onChange={() => toggleSkill(skillId)}
                  />
                  {skillId.replace(/_/g, " ")}
                </label>
              ))}
            </div>
            {selectedBackground && (
              <p className="mt-4 text-sm text-amber-200/50">
                Also granted by your background: {selectedBackground.skillProficiencies.join(", ")}
              </p>
            )}
          </div>
        )}

        {STEPS[step] === "Spells" && selectedClass && isCaster && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm text-amber-200/70">
                Cantrips ({cantrips.length}/{selectedClass.cantripsKnownAtLevel1})
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableCantrips.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 text-sm text-amber-200/80">
                    <input type="checkbox" checked={cantrips.includes(s.id)} onChange={() => toggleCantrip(s.id)} className="mt-1" />
                    <span>
                      <span className="text-amber-100">{s.name}</span> — {s.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-amber-200/70">
                1st-level spells ({spellsKnown.length}/{spellCap})
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableLevel1Spells.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 text-sm text-amber-200/80">
                    <input type="checkbox" checked={spellsKnown.includes(s.id)} onChange={() => toggleSpell(s.id)} className="mt-1" />
                    <span>
                      <span className="text-amber-100">{s.name}</span> — {s.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {STEPS[step] === "Details" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-amber-200/80">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-amber-200/80">
              Alignment (optional)
              <input
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
                placeholder="e.g. Chaotic Good"
                className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-amber-200/80">
              Appearance (optional)
              <textarea
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                rows={3}
                placeholder="Height, build, scars, how you carry yourself — the DM uses this to decide how NPCs react to you on sight."
                className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-amber-200/80">
              Backstory (optional)
              <textarea
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                rows={5}
                className="rounded border border-amber-700/40 bg-black/30 px-2 py-1 text-amber-50"
              />
            </label>
          </div>
        )}

        {STEPS[step] === "Review" && selectedSpecies && selectedClass && selectedBackground && finalScores && (
          <div className="flex flex-col gap-2 text-sm text-amber-200/80">
            <p><span className="text-amber-100">{name || "(unnamed)"}</span> — {alignment || "no alignment set"}</p>
            <p>{selectedSpecies.name} {selectedClass.name}, {selectedBackground.name} background</p>
            <p>
              STR {finalScores.str}, DEX {finalScores.dex}, CON {finalScores.con}, INT {finalScores.int}, WIS {finalScores.wis}, CHA {finalScores.cha}
            </p>
            <p>Skills: {skillChoices.map((s) => s.replace(/_/g, " ")).join(", ")}, {selectedBackground.skillProficiencies.join(", ")}</p>
            <p>Origin feat: {originFeat?.name}</p>
            {isCaster && (
              <p>
                Cantrips: {cantrips.map((id) => spells.find((s) => s.id === id)?.name).join(", ") || "none"} · Spells:{" "}
                {spellsKnown.map((id) => spells.find((s) => s.id === id)?.name).join(", ") || "none"}
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={back}
          disabled={step === 0}
          className="rounded border border-amber-700/40 px-4 py-2 text-sm text-amber-200 disabled:opacity-30"
        >
          Back
        </button>
        {STEPS[step] === "Review" ? (
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-amber-700 px-4 py-2 text-sm text-amber-50 hover:bg-amber-600 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Character"}
          </button>
        ) : (
          <button
            onClick={next}
            className="rounded bg-amber-700 px-4 py-2 text-sm text-amber-50 hover:bg-amber-600"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function StepGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function OptionCard({
  selected,
  title,
  subtitle,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition ${
        selected ? "border-amber-500 bg-amber-900/30" : "border-amber-800/30 hover:border-amber-700/60"
      }`}
    >
      <div className="text-amber-100">{title}</div>
      <div className="text-xs text-amber-300/60">{subtitle}</div>
      <p className="mt-1 text-xs text-amber-200/50">{description}</p>
    </button>
  );
}
