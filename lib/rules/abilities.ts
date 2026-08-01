import { ABILITIES, type Ability } from "./constants";

export type AbilityScores = Record<Ability, number>;

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** 2024 PHB point-buy cost table: 8 costs 0, each point up to 13 costs 1, 14-15 cost 2. */
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePointBuy(scores: AbilityScores): ValidationResult {
  const errors: string[] = [];
  let totalCost = 0;

  for (const ability of ABILITIES) {
    const score = scores[ability];
    if (
      !Number.isInteger(score) ||
      score < POINT_BUY_MIN ||
      score > POINT_BUY_MAX
    ) {
      errors.push(
        `${ability.toUpperCase()} must be between ${POINT_BUY_MIN} and ${POINT_BUY_MAX}`,
      );
      continue;
    }
    totalCost += POINT_BUY_COST[score];
  }

  if (totalCost > POINT_BUY_BUDGET) {
    errors.push(
      `Point buy total (${totalCost}) exceeds the ${POINT_BUY_BUDGET}-point budget`,
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateStandardArray(scores: AbilityScores): ValidationResult {
  const errors: string[] = [];
  const assigned = ABILITIES.map((a) => scores[a]).sort((a, b) => a - b);
  const expected = [...STANDARD_ARRAY].sort((a, b) => a - b);

  if (JSON.stringify(assigned) !== JSON.stringify(expected)) {
    errors.push(
      `Scores must be exactly the standard array {${STANDARD_ARRAY.join(", ")}} assigned once each`,
    );
  }

  return { valid: errors.length === 0, errors };
}

/** Manual entry: any legal ability score, typically capped at 20 pre-level-1 for player characters. */
export function validateManualScores(scores: AbilityScores): ValidationResult {
  const errors: string[] = [];
  for (const ability of ABILITIES) {
    const score = scores[ability];
    if (!Number.isInteger(score) || score < 1 || score > 20) {
      errors.push(`${ability.toUpperCase()} must be between 1 and 20`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 2024 PHB: ability score bonuses come from the character's Background, not
 * species. Split +2/+1 between two of the background's three eligible
 * abilities, or +1/+1/+1 across all three.
 */
export type AbilityBonusAllocation =
  | { mode: "2-1"; plus2: Ability; plus1: Ability }
  | { mode: "1-1-1" };

export function applyBackgroundAbilityBonus(
  baseScores: AbilityScores,
  eligibleAbilities: readonly [Ability, Ability, Ability],
  allocation: AbilityBonusAllocation,
): AbilityScores {
  const result = { ...baseScores };

  if (allocation.mode === "1-1-1") {
    for (const ability of eligibleAbilities) result[ability] += 1;
    return result;
  }

  const { plus2, plus1 } = allocation;
  if (!eligibleAbilities.includes(plus2) || !eligibleAbilities.includes(plus1)) {
    throw new Error("Bonus abilities must be chosen from the background's eligible abilities");
  }
  if (plus2 === plus1) {
    throw new Error("The +2 and +1 bonuses must go to two different abilities");
  }
  result[plus2] += 2;
  result[plus1] += 1;
  return result;
}
