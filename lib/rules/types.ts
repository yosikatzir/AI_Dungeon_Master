import type { Ability } from "./constants";

export type Size = "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan";

export interface Species {
  id: string;
  name: string;
  size: Size;
  speed: number;
  traits: { name: string; description: string }[];
  description: string;
}

export type SpellcastingType = "none" | "prepared" | "known" | "pact";

export interface ClassFeature {
  name: string;
  description: string;
}

export interface ClassDef {
  id: string;
  name: string;
  hitDie: 6 | 8 | 10 | 12;
  primaryAbilities: Ability[];
  savingThrows: [Ability, Ability];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  skillChoiceCount: number;
  skillChoices: string[];
  startingEquipment: { equipmentId: string; quantity: number }[];
  spellcastingAbility: Ability | null;
  spellcastingType: SpellcastingType;
  cantripsKnownAtLevel1: number;
  /** A fixed count for "known" casters, or 'ability_plus_level' for prepared casters. */
  spellsPreparedOrKnownAtLevel1: number | "ability_plus_level";
  hasFightingStyleAtLevel1: boolean;
  /** Levels (beyond the standard array) at which an ASI/feat choice is granted. */
  extraAsiLevels: number[];
  subclassLevel: number;
  level1Features: ClassFeature[];
  description: string;
}

export interface SubclassFeature {
  level: number;
  name: string;
  description: string;
}

export interface Subclass {
  id: string;
  classId: string;
  name: string;
  description: string;
  features: SubclassFeature[];
}

export interface Background {
  id: string;
  name: string;
  /** Exactly 3 abilities eligible for the +2/+1 or +1/+1/+1 bonus split. */
  abilityScores: [Ability, Ability, Ability];
  skillProficiencies: [string, string];
  toolProficiency: string | null;
  originFeatId: string;
  equipment: { equipmentId: string; quantity: number }[];
  goldAlternative: number;
  description: string;
}

export type FeatCategory = "origin" | "general" | "fighting_style" | "epic_boon";

export interface Feat {
  id: string;
  name: string;
  category: FeatCategory;
  prerequisite: string | null;
  benefits: string[];
  description: string;
}

export interface SpellComponents {
  v: boolean;
  s: boolean;
  m: string | null;
}

export interface Spell {
  id: string;
  name: string;
  level: number; // 0 = cantrip
  school: string;
  castingTime: string;
  range: string;
  components: SpellComponents;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string[];
  description: string;
}

export type EquipmentCategory = "weapon" | "armor" | "gear" | "tool" | "pack";
export type ArmorType = "light" | "medium" | "heavy" | "shield";

export interface WeaponProps {
  weaponType: "simple" | "martial";
  range: "melee" | "ranged";
  properties: string[];
  damage: { dice: string; type: string };
  versatileDamage?: string;
}

export interface ArmorProps {
  armorType: ArmorType;
  baseAc: number;
  dexBonus: boolean;
  maxDexBonus: number | null;
  strengthRequirement: number | null;
  stealthDisadvantage: boolean;
}

export interface PackProps {
  contents: { equipmentId: string; quantity: number }[];
}

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  costGp: number;
  weight: number;
  weapon?: WeaponProps;
  armor?: ArmorProps;
  pack?: PackProps;
  description: string;
}

export interface MonsterAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Monster {
  id: string;
  name: string;
  size: Size;
  type: string;
  alignment: string;
  ac: number;
  hp: number;
  hitDice: string;
  speed: Record<string, number>;
  abilities: MonsterAbilities;
  savingThrows: Partial<Record<Ability, number>>;
  skills: Record<string, number>;
  resistances: string[];
  immunities: string[];
  senses: string;
  languages: string;
  cr: string;
  xp: number;
  traits: { name: string; description: string }[];
  actions: { name: string; description: string }[];
}
