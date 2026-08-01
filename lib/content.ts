import db from "@/lib/db";
import type {
  Background,
  ClassDef,
  Equipment,
  Feat,
  Monster,
  Species,
  Spell,
  Subclass,
} from "@/lib/rules/types";

// Rows come back from better-sqlite3 with snake_case columns and JSON text
// columns; these functions turn them back into the typed shapes from
// lib/rules/types.ts that the rest of the app (and content/srd/*.ts at seed
// time) works with. `any` is deliberate here — see the eslint.config.mjs
// override for this file.

function rowToSpecies(row: any): Species {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    speed: row.speed,
    traits: JSON.parse(row.traits),
    description: row.description,
  };
}

export function getAllSpecies(): Species[] {
  return db.prepare("SELECT * FROM species ORDER BY name").all().map(rowToSpecies);
}

export function getSpeciesById(id: string): Species | null {
  const row = db.prepare("SELECT * FROM species WHERE id = ?").get(id);
  return row ? rowToSpecies(row) : null;
}

function rowToClass(row: any): ClassDef {
  return {
    id: row.id,
    name: row.name,
    hitDie: row.hit_die,
    primaryAbilities: JSON.parse(row.primary_abilities),
    savingThrows: JSON.parse(row.saving_throws),
    armorProficiencies: JSON.parse(row.armor_proficiencies),
    weaponProficiencies: JSON.parse(row.weapon_proficiencies),
    toolProficiencies: JSON.parse(row.tool_proficiencies),
    skillChoiceCount: row.skill_choice_count,
    skillChoices: JSON.parse(row.skill_choices),
    startingEquipment: JSON.parse(row.starting_equipment),
    spellcastingAbility: row.spellcasting_ability,
    spellcastingType: row.spellcasting_type,
    cantripsKnownAtLevel1: row.cantrips_known_at_level1,
    spellsPreparedOrKnownAtLevel1:
      row.spells_prepared_or_known_at_level1 === "ability_plus_level"
        ? "ability_plus_level"
        : Number(row.spells_prepared_or_known_at_level1),
    hasFightingStyleAtLevel1: !!row.has_fighting_style_at_level1,
    extraAsiLevels: JSON.parse(row.extra_asi_levels),
    subclassLevel: row.subclass_level,
    level1Features: JSON.parse(row.level1_features),
    description: row.description,
  };
}

export function getAllClasses(): ClassDef[] {
  return db.prepare("SELECT * FROM classes ORDER BY name").all().map(rowToClass);
}

export function getClassById(id: string): ClassDef | null {
  const row = db.prepare("SELECT * FROM classes WHERE id = ?").get(id);
  return row ? rowToClass(row) : null;
}

function rowToSubclass(row: any): Subclass {
  return {
    id: row.id,
    classId: row.class_id,
    name: row.name,
    description: row.description,
    features: JSON.parse(row.features),
  };
}

export function getSubclassesForClass(classId: string): Subclass[] {
  return db
    .prepare("SELECT * FROM subclasses WHERE class_id = ? ORDER BY name")
    .all(classId)
    .map(rowToSubclass);
}

export function getSubclassById(id: string): Subclass | null {
  const row = db.prepare("SELECT * FROM subclasses WHERE id = ?").get(id);
  return row ? rowToSubclass(row) : null;
}

function rowToBackground(row: any): Background {
  return {
    id: row.id,
    name: row.name,
    abilityScores: JSON.parse(row.ability_scores),
    skillProficiencies: JSON.parse(row.skill_proficiencies),
    toolProficiency: row.tool_proficiency,
    originFeatId: row.origin_feat_id,
    equipment: JSON.parse(row.equipment),
    goldAlternative: row.gold_alternative,
    description: row.description,
  };
}

export function getAllBackgrounds(): Background[] {
  return db.prepare("SELECT * FROM backgrounds ORDER BY name").all().map(rowToBackground);
}

export function getBackgroundById(id: string): Background | null {
  const row = db.prepare("SELECT * FROM backgrounds WHERE id = ?").get(id);
  return row ? rowToBackground(row) : null;
}

function rowToFeat(row: any): Feat {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    prerequisite: row.prerequisite,
    benefits: JSON.parse(row.benefits),
    description: row.description,
  };
}

export function getAllFeats(): Feat[] {
  return db.prepare("SELECT * FROM feats ORDER BY name").all().map(rowToFeat);
}

export function getFeatById(id: string): Feat | null {
  const row = db.prepare("SELECT * FROM feats WHERE id = ?").get(id);
  return row ? rowToFeat(row) : null;
}

function rowToSpell(row: any): Spell {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    school: row.school,
    castingTime: row.casting_time,
    range: row.range,
    components: JSON.parse(row.components),
    duration: row.duration,
    concentration: !!row.concentration,
    ritual: !!row.ritual,
    classes: JSON.parse(row.classes),
    description: row.description,
  };
}

export function getAllSpells(): Spell[] {
  return db.prepare("SELECT * FROM spells ORDER BY level, name").all().map(rowToSpell);
}

export function getSpellsForClass(classId: string): Spell[] {
  return getAllSpells().filter((s) => s.classes.includes(classId));
}

function rowToEquipment(row: any): Equipment {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    costGp: row.cost_gp,
    weight: row.weight,
    weapon: row.weapon ? JSON.parse(row.weapon) : undefined,
    armor: row.armor ? JSON.parse(row.armor) : undefined,
    pack: row.pack ? JSON.parse(row.pack) : undefined,
    description: row.description,
  };
}

export function getAllEquipment(): Equipment[] {
  return db.prepare("SELECT * FROM equipment ORDER BY category, name").all().map(rowToEquipment);
}

export function getEquipmentById(id: string): Equipment | null {
  const row = db.prepare("SELECT * FROM equipment WHERE id = ?").get(id);
  return row ? rowToEquipment(row) : null;
}

export function getEquipmentByIds(ids: string[]): Equipment[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM equipment WHERE id IN (${placeholders})`)
    .all(...ids)
    .map(rowToEquipment);
}

/** Case-insensitive name lookup — the AI DM refers to items by name, not internal id. */
export function findEquipmentByName(name: string): Equipment | null {
  const needle = name.trim().toLowerCase();
  const row = db
    .prepare("SELECT * FROM equipment WHERE lower(name) = ?")
    .get(needle);
  if (row) return rowToEquipment(row);

  const fuzzy = db
    .prepare("SELECT * FROM equipment WHERE lower(name) LIKE ? LIMIT 1")
    .get(`%${needle}%`);
  return fuzzy ? rowToEquipment(fuzzy) : null;
}

function rowToMonster(row: any): Monster {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    type: row.type,
    alignment: row.alignment,
    ac: row.ac,
    hp: row.hp,
    hitDice: row.hit_dice,
    speed: JSON.parse(row.speed),
    abilities: JSON.parse(row.abilities),
    savingThrows: JSON.parse(row.saving_throws),
    skills: JSON.parse(row.skills),
    resistances: JSON.parse(row.resistances),
    immunities: JSON.parse(row.immunities),
    senses: row.senses,
    languages: row.languages,
    cr: row.cr,
    xp: row.xp,
    traits: JSON.parse(row.traits),
    actions: JSON.parse(row.actions),
  };
}

export function getAllMonsters(): Monster[] {
  return db.prepare("SELECT * FROM monsters ORDER BY name").all().map(rowToMonster);
}

export function getMonsterById(id: string): Monster | null {
  const row = db.prepare("SELECT * FROM monsters WHERE id = ?").get(id);
  return row ? rowToMonster(row) : null;
}
