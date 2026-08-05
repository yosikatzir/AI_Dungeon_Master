/**
 * The DM's side of the dice.
 *
 * Players roll through `lib/engine/rolls.ts`; this is the mirror for the NPCs
 * and monsters the DM controls. It exists so the DM never has to state an
 * outcome it made up: a guard's Perception check, a bandit's attack, an ogre's
 * saving throw all get resolved by the same `resolveD20Check` the players use,
 * and the DM only gets to narrate what the die actually said.
 *
 * No dice bias applies here — `lib/engine/bias.ts` is a per-character luck
 * adjustment meant to keep kids from having a miserable session, and pointing
 * it at the monsters would defeat that purpose.
 */

import { ABILITY_NAMES, SKILL_BY_ID, type Ability } from "@/lib/rules/constants";
import { NO_BIAS, resolveD20Check, type ModifierBreakdown } from "@/lib/rules/dice";
import { EngineValidationError } from "@/lib/engine/mutations";
import { npcSaveBonus, npcSkillBonus, type NpcStatBlock } from "@/lib/npcs";
import { abilityModifier } from "@/lib/rules/abilities";

export type NpcRollPurpose =
  | { type: "ability_check"; ability: Ability; dc?: number }
  | { type: "saving_throw"; ability: Ability; dc?: number }
  | { type: "skill_check"; skill: string; dc?: number }
  | { type: "attack"; toHit: number; ac?: number; attackName?: string };

export interface NpcRollOutcome {
  npcName: string;
  purposeLabel: string;
  die: number;
  modifiers: ModifierBreakdown[];
  total: number;
  dc: number | null;
  success: boolean | null;
  critical: "success" | "failure" | null;
}

export function performNpcRoll(
  npcName: string,
  stats: NpcStatBlock,
  purpose: NpcRollPurpose,
): NpcRollOutcome {
  let modifiers: ModifierBreakdown[];
  let purposeLabel: string;
  let dc: number | undefined;
  let category: "attack" | "check" = "check";

  switch (purpose.type) {
    case "ability_check":
      modifiers = [
        { label: ABILITY_NAMES[purpose.ability], value: abilityModifier(stats.abilities[purpose.ability]) },
      ];
      purposeLabel = `${ABILITY_NAMES[purpose.ability]} check`;
      dc = purpose.dc;
      break;
    case "saving_throw":
      modifiers = [
        { label: `${ABILITY_NAMES[purpose.ability]} save`, value: npcSaveBonus(stats, purpose.ability) },
      ];
      purposeLabel = `${ABILITY_NAMES[purpose.ability]} saving throw`;
      dc = purpose.dc;
      break;
    case "skill_check": {
      const def = SKILL_BY_ID[purpose.skill];
      if (!def) throw new EngineValidationError(`Unknown skill "${purpose.skill}"`);
      modifiers = [{ label: def.name, value: npcSkillBonus(stats, purpose.skill) }];
      purposeLabel = `${def.name} check`;
      dc = purpose.dc;
      break;
    }
    case "attack":
      category = "attack";
      modifiers = [{ label: purpose.attackName ?? "Attack", value: Math.round(purpose.toHit) }];
      purposeLabel = `${purpose.attackName ?? "Attack"} attack`;
      dc = purpose.ac;
      break;
  }

  const result = resolveD20Check({ category, bias: NO_BIAS, modifiers, dc });

  return {
    npcName,
    purposeLabel,
    die: result.die,
    modifiers: result.modifiers,
    total: result.total,
    dc: result.dc,
    success: result.success,
    critical: result.critical,
  };
}

/** Player-facing one-liner, matching how player rolls are announced in chat. */
export function describeNpcRoll(outcome: NpcRollOutcome): string {
  const modifierText = outcome.modifiers
    .map((m) => `${m.value >= 0 ? "+" : "-"}${Math.abs(m.value)} ${m.label}`)
    .join(" ");
  const base = `${outcome.npcName} — ${outcome.purposeLabel}: ${outcome.die}${
    modifierText ? ` ${modifierText}` : ""
  } = ${outcome.total}`;
  if (outcome.critical === "success") return `${base} — critical hit!`;
  if (outcome.critical === "failure") return `${base} — critical miss!`;
  if (outcome.dc === null || outcome.success === null) return base;
  return `${base} vs ${outcome.dc} — ${outcome.success ? "success" : "failure"}`;
}
