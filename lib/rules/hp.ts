/**
 * 2024 PHB "Fixed" hit point method (the default/primary rule, rolling is an
 * optional variant we don't implement): level 1 = max hit die + CON mod;
 * every level after that gains the die's fixed average, rounded up, + CON mod.
 */
const FIXED_HP_PER_LEVEL: Record<number, number> = {
  6: 4,
  8: 5,
  10: 6,
  12: 7,
};

export function hpMaxForLevel(
  hitDie: 6 | 8 | 10 | 12,
  level: number,
  conModifier: number,
): number {
  if (level < 1) throw new Error("level must be at least 1");
  const first = hitDie + conModifier;
  const perLevel = FIXED_HP_PER_LEVEL[hitDie] + conModifier;
  return first + perLevel * (level - 1);
}
