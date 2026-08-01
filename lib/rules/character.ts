import type { AbilityScores } from "./abilities";
import type { Background, ClassDef, Equipment, Species, Subclass } from "./types";

export interface CharacterRecord {
  id: number;
  userId: number;
  name: string;
  speciesId: string;
  classId: string;
  subclassId: string | null;
  backgroundId: string;
  level: number;
  xp: number;
  alignment: string | null;
  abilityScores: AbilityScores;
  hpCurrent: number;
  tempHp: number;
  hitDiceUsed: number;
  inspiration: boolean;
  skillProficiencies: string[];
  otherProficiencies: string[];
  feats: string[];
  cantripsKnown: string[];
  spellsKnown: string[];
  spellSlotsUsed: Record<number, number>;
  classChoices: Record<string, unknown>;
  conditions: string[];
  portraitPath: string | null;
  appearance: string | null;
  backstory: string | null;
  notes: string | null;
  isDeleted: boolean;
}

export interface CharacterItem {
  equipmentId: string;
  quantity: number;
  equipped: boolean;
  equipment: Equipment;
}

export interface ResolvedCharacter {
  character: CharacterRecord;
  species: Species;
  klass: ClassDef;
  subclass: Subclass | null;
  background: Background;
  items: CharacterItem[];
}
