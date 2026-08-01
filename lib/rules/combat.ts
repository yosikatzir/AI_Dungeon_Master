import type { ArmorProps } from "./types";

export function skillOrSaveBonus(params: {
  abilityModifier: number;
  proficiencyBonus: number;
  proficient: boolean;
  expertise?: boolean;
  miscBonus?: number;
}): number {
  const { abilityModifier, proficiencyBonus, proficient, expertise, miscBonus } =
    params;
  const profMultiplier = expertise ? 2 : proficient ? 1 : 0;
  return abilityModifier + proficiencyBonus * profMultiplier + (miscBonus ?? 0);
}

export function armorClass(params: {
  dexModifier: number;
  armor: ArmorProps | null;
  hasShield: boolean;
  /** e.g. Barbarian's Unarmored Defense (10 + DEX + CON) when no armor is worn. */
  unarmoredBase?: number;
  miscBonus?: number;
}): number {
  const { dexModifier, armor, hasShield, unarmoredBase, miscBonus } = params;
  let base: number;

  if (armor) {
    const cappedDex =
      armor.dexBonus === false
        ? 0
        : armor.maxDexBonus === null
          ? dexModifier
          : Math.min(dexModifier, armor.maxDexBonus);
    base = armor.baseAc + cappedDex;
  } else if (unarmoredBase !== undefined) {
    base = unarmoredBase;
  } else {
    base = 10 + dexModifier;
  }

  return base + (hasShield ? 2 : 0) + (miscBonus ?? 0);
}

export function initiativeBonus(dexModifier: number, miscBonus = 0): number {
  return dexModifier + miscBonus;
}

export function passivePerception(perceptionSkillBonus: number): number {
  return 10 + perceptionSkillBonus;
}

export function attackBonus(params: {
  abilityModifier: number;
  proficiencyBonus: number;
  proficient: boolean;
  miscBonus?: number;
}): number {
  const { abilityModifier, proficiencyBonus, proficient, miscBonus } = params;
  return (
    abilityModifier + (proficient ? proficiencyBonus : 0) + (miscBonus ?? 0)
  );
}

export function spellSaveDc(params: {
  spellcastingAbilityModifier: number;
  proficiencyBonus: number;
}): number {
  return 8 + params.proficiencyBonus + params.spellcastingAbilityModifier;
}

export function spellAttackBonus(params: {
  spellcastingAbilityModifier: number;
  proficiencyBonus: number;
}): number {
  return params.proficiencyBonus + params.spellcastingAbilityModifier;
}
