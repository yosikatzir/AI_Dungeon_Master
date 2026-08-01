import { randomInt } from "node:crypto";

export type RngFn = (minInclusive: number, maxExclusive: number) => number;

const cryptoRng: RngFn = (min, maxExclusive) => randomInt(min, maxExclusive);

export function rollRawDie(sides: number, rng: RngFn = cryptoRng): number {
  return rng(1, sides + 1);
}

export type DiceBiasMode = "none" | "flat" | "advantage_weighted";

export interface DiceBiasConfig {
  mode: DiceBiasMode;
  flatBonus: number;
}

export const NO_BIAS: DiceBiasConfig = { mode: "none", flatBonus: 0 };

/**
 * Applies an admin-configured bias to a d20 roll. The result is itself a
 * plausible natural roll (1-20) — never distinguishable from an honest one.
 * This is the ONLY function in the codebase allowed to read/apply bias;
 * nothing about the bias config may ever leave this function's caller in a
 * client-visible response.
 */
export function rollBiasedD20(bias: DiceBiasConfig, rng: RngFn = cryptoRng): number {
  switch (bias.mode) {
    case "flat": {
      const raw = rollRawDie(20, rng);
      return Math.max(1, Math.min(20, raw + bias.flatBonus));
    }
    case "advantage_weighted":
      return Math.max(rollRawDie(20, rng), rollRawDie(20, rng));
    case "none":
    default:
      return rollRawDie(20, rng);
  }
}

export interface ModifierBreakdown {
  label: string;
  value: number;
}

export type RollCategory = "attack" | "check";

export interface D20RollResult {
  die: number;
  modifiers: ModifierBreakdown[];
  total: number;
  dc: number | null;
  success: boolean | null;
  /** Nat 20/1 auto-success/fail only applies to attack rolls in 5e, not checks or saves. */
  critical: "success" | "failure" | null;
}

export function resolveD20Check(params: {
  category: RollCategory;
  bias: DiceBiasConfig;
  modifiers: ModifierBreakdown[];
  dc?: number;
  rng?: RngFn;
}): D20RollResult {
  const die = rollBiasedD20(params.bias, params.rng);
  const modifierSum = params.modifiers.reduce((sum, m) => sum + m.value, 0);
  const total = die + modifierSum;

  const critical =
    params.category === "attack" ? (die === 20 ? "success" : die === 1 ? "failure" : null) : null;

  const dc = params.dc ?? null;
  const success =
    dc === null
      ? null
      : critical === "success"
        ? true
        : critical === "failure"
          ? false
          : total >= dc;

  return { die, modifiers: params.modifiers, total, dc, success, critical };
}

export function rollDamage(diceExpr: string, rng: RngFn = cryptoRng): { rolls: number[]; total: number } {
  const match = /^(\d+)d(\d+)$/.exec(diceExpr.trim());
  if (!match) throw new Error(`Invalid dice expression: ${diceExpr}`);
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const rolls = Array.from({ length: count }, () => rollRawDie(sides, rng));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}
