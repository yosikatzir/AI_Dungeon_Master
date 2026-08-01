import { resolveCharacter } from "@/lib/characters";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { ABILITY_NAMES, SKILL_BY_ID, type Ability } from "@/lib/rules/constants";
import { getDiceBias } from "@/lib/engine/bias";
import {
  NO_BIAS,
  resolveD20Check,
  rollRawDie,
  type ModifierBreakdown,
  type RollCategory,
} from "@/lib/rules/dice";
import { EngineValidationError } from "@/lib/engine/mutations";

export type RollPurpose =
  | { type: "raw"; sides: 4 | 6 | 8 | 10 | 12 | 20 | 100 }
  | { type: "ability_check"; ability: Ability; dc?: number }
  | { type: "saving_throw"; ability: Ability; dc?: number }
  | { type: "skill_check"; skill: string; dc?: number }
  | { type: "attack"; equipmentId?: string; ac?: number };

export interface RollOutcome {
  characterId: number | null;
  characterName: string | null;
  purposeLabel: string;
  sides: number;
  die: number;
  modifiers: ModifierBreakdown[];
  total: number;
  dc: number | null;
  success: boolean | null;
  critical: "success" | "failure" | null;
}

export function performRoll(characterId: number | null, purpose: RollPurpose): RollOutcome {
  if (purpose.type === "raw" && purpose.sides !== 20) {
    const die = rollRawDie(purpose.sides);
    return {
      characterId,
      characterName: null,
      purposeLabel: `d${purpose.sides}`,
      sides: purpose.sides,
      die,
      modifiers: [],
      total: die,
      dc: null,
      success: null,
      critical: null,
    };
  }

  let characterName: string | null = null;
  let modifiers: ModifierBreakdown[] = [];
  let dc: number | undefined;
  let category: RollCategory = "check";
  let purposeLabel = "d20";

  if (characterId !== null) {
    const resolved = resolveCharacter(characterId);
    if (!resolved) throw new EngineValidationError("Character not found");
    characterName = resolved.character.name;
    const sheet = computeCharacterSheet(resolved);

    switch (purpose.type) {
      case "ability_check":
        modifiers = [{ label: ABILITY_NAMES[purpose.ability], value: sheet.abilityModifiers[purpose.ability] }];
        dc = purpose.dc;
        purposeLabel = `${ABILITY_NAMES[purpose.ability]} check`;
        break;
      case "saving_throw": {
        const save = sheet.savingThrows[purpose.ability];
        modifiers = [{ label: `${ABILITY_NAMES[purpose.ability]} save`, value: save.bonus }];
        dc = purpose.dc;
        purposeLabel = `${ABILITY_NAMES[purpose.ability]} saving throw`;
        break;
      }
      case "skill_check": {
        const skillDef = SKILL_BY_ID[purpose.skill];
        const skill = sheet.skills.find((s) => s.id === purpose.skill);
        if (!skillDef || !skill) throw new EngineValidationError("Unknown skill");
        modifiers = [{ label: skillDef.name, value: skill.bonus }];
        dc = purpose.dc;
        purposeLabel = `${skillDef.name} check`;
        break;
      }
      case "attack": {
        category = "attack";
        const attack = purpose.equipmentId
          ? sheet.attacks.find((a) => a.equipmentId === purpose.equipmentId)
          : sheet.attacks[0];
        if (!attack) throw new EngineValidationError("No matching equipped weapon");
        modifiers = [{ label: attack.name, value: attack.toHit }];
        dc = purpose.ac;
        purposeLabel = `${attack.name} attack`;
        break;
      }
      case "raw":
        purposeLabel = "d20";
        break;
    }
  } else if (purpose.type !== "raw") {
    throw new EngineValidationError("A character is required for this kind of roll");
  }

  const bias = characterId !== null ? getDiceBias(characterId) : NO_BIAS;
  const result = resolveD20Check({ category, bias, modifiers, dc });

  return {
    characterId,
    characterName,
    purposeLabel,
    sides: 20,
    die: result.die,
    modifiers: result.modifiers,
    total: result.total,
    dc: result.dc,
    success: result.success,
    critical: result.critical,
  };
}

/** e.g. "d20: 14 + DEX 3 + Prof 2 = 19 vs DC 15 — Success!" */
export function formatRollOutcome(outcome: RollOutcome): string {
  const who = outcome.characterName ? `${outcome.characterName} — ` : "";
  const modifierText = outcome.modifiers
    .map((m) => `${m.value >= 0 ? "+" : ""}${m.value} ${m.label}`)
    .join(" ");
  const rollText = `d${outcome.sides}: ${outcome.die}${modifierText ? ` ${modifierText}` : ""}${
    outcome.modifiers.length > 0 ? ` = ${outcome.total}` : ""
  }`;

  const critText =
    outcome.critical === "success" ? " (natural 20!)" : outcome.critical === "failure" ? " (natural 1)" : "";

  if (outcome.dc === null) {
    return `${who}${rollText}${critText}`;
  }

  const outcomeText = outcome.success ? "Success!" : "Failure.";
  return `${who}${outcome.purposeLabel} — ${rollText}${critText} vs DC ${outcome.dc} — ${outcomeText}`;
}
