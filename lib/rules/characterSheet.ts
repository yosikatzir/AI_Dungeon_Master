import { ABILITIES, type Ability, proficiencyBonus } from "./constants";
import { abilityModifier } from "./abilities";
import { armorClass, attackBonus, initiativeBonus, passivePerception, skillOrSaveBonus, spellAttackBonus, spellSaveDc } from "./combat";
import { hpMaxForLevel } from "./hp";
import { carryCapacity } from "./encumbrance";
import { fullCasterSlots, halfCasterSlots, warlockPactMagic, type SlotsByLevel } from "./spellSlots";
import { SKILLS } from "./constants";
import type { ResolvedCharacter } from "./character";
import type { ArmorProps, WeaponProps } from "./types";

export interface DerivedSkill {
  id: string;
  name: string;
  ability: Ability;
  proficient: boolean;
  expertise: boolean;
  bonus: number;
}

export interface DerivedAttack {
  equipmentId: string;
  name: string;
  toHit: number;
  damageDice: string;
  damageType: string;
  range: string;
}

export interface DerivedSpellSlots {
  max: SlotsByLevel;
  used: Record<number, number>;
}

export interface CharacterSheet {
  proficiencyBonus: number;
  abilityModifiers: Record<Ability, number>;
  hpMax: number;
  armorClass: number;
  initiative: number;
  speed: number;
  passivePerception: number;
  savingThrows: Record<Ability, { bonus: number; proficient: boolean }>;
  skills: DerivedSkill[];
  spellSlots: DerivedSpellSlots | null;
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
  carryCapacityLb: number;
  weightCarriedLb: number;
  attacks: DerivedAttack[];
}

export function computeCharacterSheet(resolved: ResolvedCharacter): CharacterSheet {
  const { character, species, klass, items } = resolved;
  const scores = character.abilityScores;
  const level = character.level;
  const profBonus = proficiencyBonus(level);

  const abilityModifiers = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(scores[a])]),
  ) as Record<Ability, number>;

  // HP: base fixed-method progression, plus Tough feat and Dwarven Toughness (+N/level).
  let hpMax = hpMaxForLevel(klass.hitDie, level, abilityModifiers.con);
  if (character.feats.includes("tough")) hpMax += 2 * level;
  if (species.id === "dwarf") hpMax += 1 * level;

  const equippedArmorItem = items.find((i) => i.equipped && i.equipment.armor && i.equipment.armor.armorType !== "shield");
  const hasShield = items.some((i) => i.equipped && i.equipment.armor?.armorType === "shield");
  const armorProps: ArmorProps | null = equippedArmorItem?.equipment.armor ?? null;

  const unarmoredBase =
    !armorProps && klass.id === "barbarian"
      ? 10 + abilityModifiers.dex + abilityModifiers.con
      : !armorProps && klass.id === "monk"
        ? 10 + abilityModifiers.dex + abilityModifiers.wis
        : undefined;

  const ac = armorClass({
    dexModifier: abilityModifiers.dex,
    armor: armorProps,
    hasShield,
    unarmoredBase,
    miscBonus: klass.hasFightingStyleAtLevel1 && character.classChoices.fightingStyle === "fighting_style_defense" && armorProps ? 1 : 0,
  });

  const speed = species.speed;
  const initiative = initiativeBonus(abilityModifiers.dex);

  const savingThrows = Object.fromEntries(
    ABILITIES.map((a) => {
      const proficient = klass.savingThrows.includes(a);
      return [
        a,
        {
          proficient,
          bonus: skillOrSaveBonus({
            abilityModifier: abilityModifiers[a],
            proficiencyBonus: profBonus,
            proficient,
          }),
        },
      ];
    }),
  ) as Record<Ability, { bonus: number; proficient: boolean }>;

  const skills: DerivedSkill[] = SKILLS.map((skillDef) => {
    const proficient = character.skillProficiencies.includes(skillDef.id);
    const expertise = character.classChoices.expertise
      ? (character.classChoices.expertise as string[]).includes(skillDef.id)
      : false;
    return {
      id: skillDef.id,
      name: skillDef.name,
      ability: skillDef.ability,
      proficient,
      expertise,
      bonus: skillOrSaveBonus({
        abilityModifier: abilityModifiers[skillDef.ability],
        proficiencyBonus: profBonus,
        proficient,
        expertise,
      }),
    };
  });

  const perceptionSkill = skills.find((s) => s.id === "perception")!;

  let spellSlots: DerivedSpellSlots | null = null;
  let saveDc: number | null = null;
  let atkBonus: number | null = null;

  if (klass.spellcastingAbility && klass.spellcastingType !== "none") {
    const spellMod = abilityModifiers[klass.spellcastingAbility];
    saveDc = spellSaveDc({ spellcastingAbilityModifier: spellMod, proficiencyBonus: profBonus });
    atkBonus = spellAttackBonus({ spellcastingAbilityModifier: spellMod, proficiencyBonus: profBonus });

    let max: SlotsByLevel;
    if (klass.spellcastingType === "pact") {
      const pact = warlockPactMagic(level);
      max = Array(9).fill(0);
      if (pact.slotLevel > 0) max[pact.slotLevel - 1] = pact.slots;
    } else if (["paladin", "ranger"].includes(klass.id)) {
      max = halfCasterSlots(level);
    } else {
      max = fullCasterSlots(level);
    }

    spellSlots = { max, used: character.spellSlotsUsed };
  }

  const attacks: DerivedAttack[] = items
    .filter((i) => i.equipped && i.equipment.weapon)
    .map((i) => {
      const w = i.equipment.weapon as WeaponProps;
      const finesse = w.properties.some((p) => p.startsWith("finesse"));
      const useDex = w.range === "ranged" || (finesse && abilityModifiers.dex > abilityModifiers.str);
      const abilityMod = useDex ? abilityModifiers.dex : abilityModifiers.str;
      const proficient =
        klass.weaponProficiencies.includes("simple") && w.weaponType === "simple"
          ? true
          : klass.weaponProficiencies.includes("martial") && w.weaponType === "martial"
            ? true
            : klass.weaponProficiencies.includes(i.equipmentId);
      return {
        equipmentId: i.equipmentId,
        name: i.equipment.name,
        toHit: attackBonus({ abilityModifier: abilityMod, proficiencyBonus: profBonus, proficient }),
        damageDice: w.damage.dice,
        damageType: w.damage.type,
        range: w.range === "melee" ? "melee" : "ranged",
      };
    });

  const totalWeight = items.reduce((sum, i) => sum + i.equipment.weight * i.quantity, 0);

  return {
    proficiencyBonus: profBonus,
    abilityModifiers,
    hpMax,
    armorClass: ac,
    initiative,
    speed,
    passivePerception: passivePerception(perceptionSkill.bonus),
    savingThrows,
    skills,
    spellSlots,
    spellSaveDc: saveDc,
    spellAttackBonus: atkBonus,
    carryCapacityLb: carryCapacity(scores.str),
    weightCarriedLb: totalWeight,
    attacks,
  };
}
