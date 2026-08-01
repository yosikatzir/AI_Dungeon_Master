import db from "@/lib/db";
import {
  getBackgroundById,
  getClassById,
  getEquipmentByIds,
  getSpeciesById,
  getSubclassById,
} from "@/lib/content";
import {
  applyBackgroundAbilityBonus,
  validateManualScores,
  validatePointBuy,
  validateStandardArray,
} from "@/lib/rules/abilities";
import { abilityModifier } from "@/lib/rules/abilities";
import type { AbilityScores } from "@/lib/rules/abilities";
import type { CreateCharacterInput } from "@/lib/validation/character";
import type { CharacterItem, CharacterRecord, ResolvedCharacter } from "@/lib/rules/character";

export class CharacterValidationError extends Error {}

function abilityScoresFromRow(row: any): AbilityScores {
  return {
    str: row.strength,
    dex: row.dexterity,
    con: row.constitution,
    int: row.intelligence,
    wis: row.wisdom,
    cha: row.charisma,
  };
}

function rowToCharacterRecord(row: any): CharacterRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    speciesId: row.species_id,
    classId: row.class_id,
    subclassId: row.subclass_id,
    backgroundId: row.background_id,
    level: row.level,
    xp: row.xp,
    alignment: row.alignment,
    abilityScores: abilityScoresFromRow(row),
    hpCurrent: row.hp_current,
    tempHp: row.temp_hp,
    hitDiceUsed: row.hit_dice_used,
    inspiration: !!row.inspiration,
    skillProficiencies: JSON.parse(row.skill_proficiencies),
    otherProficiencies: JSON.parse(row.other_proficiencies),
    feats: JSON.parse(row.feats),
    cantripsKnown: JSON.parse(row.cantrips_known),
    spellsKnown: JSON.parse(row.spells_known),
    spellSlotsUsed: JSON.parse(row.spell_slots_used),
    classChoices: JSON.parse(row.class_choices),
    conditions: JSON.parse(row.conditions),
    portraitPath: row.portrait_path,
    appearance: row.appearance,
    backstory: row.backstory,
    notes: row.notes,
  };
}

export function listCharactersForUser(userId: number): CharacterRecord[] {
  return db
    .prepare("SELECT * FROM characters WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId)
    .map(rowToCharacterRecord);
}

/** Admin-only: every character across every family account, for the admin settings area. */
export function listAllCharactersWithOwner(): (CharacterRecord & { ownerUsername: string })[] {
  const rows = db
    .prepare(
      `SELECT c.*, u.username AS owner_username
       FROM characters c
       JOIN users u ON u.id = c.user_id
       ORDER BY u.username, c.name`,
    )
    .all() as any[];
  return rows.map((row) => ({ ...rowToCharacterRecord(row), ownerUsername: row.owner_username }));
}

export function getCharacterRecord(id: number): CharacterRecord | null {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(id);
  return row ? rowToCharacterRecord(row) : null;
}

export function resolveCharacter(id: number): ResolvedCharacter | null {
  const character = getCharacterRecord(id);
  if (!character) return null;

  const species = getSpeciesById(character.speciesId);
  const klass = getClassById(character.classId);
  const background = getBackgroundById(character.backgroundId);
  if (!species || !klass || !background) return null;
  const subclass = character.subclassId ? getSubclassById(character.subclassId) : null;

  const itemRows = db
    .prepare("SELECT equipment_id, quantity, equipped FROM character_items WHERE character_id = ?")
    .all(id) as { equipment_id: string; quantity: number; equipped: number }[];

  const equipmentById = new Map(
    getEquipmentByIds(itemRows.map((r) => r.equipment_id)).map((e) => [e.id, e]),
  );

  const items: CharacterItem[] = itemRows
    .filter((r) => equipmentById.has(r.equipment_id))
    .map((r) => ({
      equipmentId: r.equipment_id,
      quantity: r.quantity,
      equipped: !!r.equipped,
      equipment: equipmentById.get(r.equipment_id)!,
    }));

  return { character, species, klass, subclass, background, items };
}

/** Flattens class starting equipment + background equipment + pack contents into a single item list. */
function resolveStartingItems(
  classEquipment: { equipmentId: string; quantity: number }[],
  backgroundEquipment: { equipmentId: string; quantity: number }[],
): { equipmentId: string; quantity: number }[] {
  const combined = [...classEquipment, ...backgroundEquipment];
  const allIds = combined.map((c) => c.equipmentId);
  const equipmentMap = new Map(getEquipmentByIds(allIds).map((e) => [e.id, e]));

  const quantities = new Map<string, number>();
  function add(equipmentId: string, quantity: number) {
    quantities.set(equipmentId, (quantities.get(equipmentId) ?? 0) + quantity);
  }

  for (const entry of combined) {
    const item = equipmentMap.get(entry.equipmentId);
    if (item?.category === "pack" && item.pack) {
      add(item.id, entry.quantity);
      for (const c of item.pack.contents) {
        add(c.equipmentId, c.quantity * entry.quantity);
      }
    } else {
      add(entry.equipmentId, entry.quantity);
    }
  }

  return Array.from(quantities, ([equipmentId, quantity]) => ({ equipmentId, quantity }));
}

export function createCharacter(userId: number, input: CreateCharacterInput): number {
  const species = getSpeciesById(input.speciesId);
  const klass = getClassById(input.classId);
  const background = getBackgroundById(input.backgroundId);

  if (!species) throw new CharacterValidationError("Unknown species");
  if (!klass) throw new CharacterValidationError("Unknown class");
  if (!background) throw new CharacterValidationError("Unknown background");

  // Ability scores: validate the chosen generation method, then apply the
  // background's ability bonus on top of the base scores.
  const methodResult =
    input.abilityMethod === "point_buy"
      ? validatePointBuy(input.baseAbilityScores)
      : input.abilityMethod === "standard_array"
        ? validateStandardArray(input.baseAbilityScores)
        : validateManualScores(input.baseAbilityScores);
  if (!methodResult.valid) {
    throw new CharacterValidationError(methodResult.errors.join("; "));
  }

  const finalScores = applyBackgroundAbilityBonus(
    input.baseAbilityScores,
    background.abilityScores,
    input.abilityBonusAllocation,
  );

  // Skills: must choose exactly klass.skillChoiceCount from klass.skillChoices.
  const chosenClassSkills = input.skillProficiencies.filter((s) =>
    klass.skillChoices.includes(s),
  );
  if (
    input.skillProficiencies.length !== chosenClassSkills.length ||
    new Set(chosenClassSkills).size !== chosenClassSkills.length ||
    chosenClassSkills.length !== klass.skillChoiceCount
  ) {
    throw new CharacterValidationError(
      `Must choose exactly ${klass.skillChoiceCount} unique skills from the class's skill list`,
    );
  }
  const allSkillProficiencies = Array.from(
    new Set([...chosenClassSkills, ...background.skillProficiencies]),
  );

  // Spells: cap cantrips/spells chosen to what the class grants at level 1.
  if (klass.spellcastingType !== "none") {
    if (input.cantripsKnown.length > klass.cantripsKnownAtLevel1) {
      throw new CharacterValidationError(
        `${klass.name} only knows ${klass.cantripsKnownAtLevel1} cantrip(s) at level 1`,
      );
    }
    const spellCap =
      klass.spellsPreparedOrKnownAtLevel1 === "ability_plus_level"
        ? Math.max(1, abilityModifier(finalScores[klass.spellcastingAbility!]) + 1)
        : klass.spellsPreparedOrKnownAtLevel1;
    if (input.spellsKnown.length > spellCap) {
      throw new CharacterValidationError(
        `${klass.name} can only know/prepare ${spellCap} 1st-level spell(s) at level 1`,
      );
    }
  }

  const startingItems = resolveStartingItems(klass.startingEquipment, background.equipment);

  const hpFirstLevel = klass.hitDie; // max die at level 1, CON applied by the sheet engine at read time

  const insertCharacter = db.prepare(`
    INSERT INTO characters (
      user_id, name, species_id, class_id, background_id, level, xp, alignment,
      strength, dexterity, constitution, intelligence, wisdom, charisma,
      hp_current, skill_proficiencies, feats, cantrips_known, spells_known,
      appearance, backstory
    ) VALUES (
      @userId, @name, @speciesId, @classId, @backgroundId, 1, 0, @alignment,
      @str, @dex, @con, @int, @wis, @cha,
      @hpCurrent, @skillProficiencies, @feats, @cantripsKnown, @spellsKnown,
      @appearance, @backstory
    )
  `);

  const result = insertCharacter.run({
    userId,
    name: input.name,
    speciesId: input.speciesId,
    classId: input.classId,
    backgroundId: input.backgroundId,
    alignment: input.alignment ?? null,
    str: finalScores.str,
    dex: finalScores.dex,
    con: finalScores.con,
    int: finalScores.int,
    wis: finalScores.wis,
    cha: finalScores.cha,
    hpCurrent: hpFirstLevel + abilityModifier(finalScores.con),
    skillProficiencies: JSON.stringify(allSkillProficiencies),
    feats: JSON.stringify([background.originFeatId]),
    cantripsKnown: JSON.stringify(input.cantripsKnown),
    spellsKnown: JSON.stringify(input.spellsKnown),
    appearance: input.appearance ?? null,
    backstory: input.backstory ?? null,
  });

  const characterId = Number(result.lastInsertRowid);

  const insertItem = db.prepare(`
    INSERT INTO character_items (character_id, equipment_id, quantity, equipped)
    VALUES (?, ?, ?, ?)
  `);
  const equipmentMap = new Map(
    getEquipmentByIds(startingItems.map((i) => i.equipmentId)).map((e) => [e.id, e]),
  );
  for (const item of startingItems) {
    const equip = equipmentMap.get(item.equipmentId);
    const equippedByDefault = equip?.category === "armor" || equip?.category === "weapon" ? 1 : 0;
    insertItem.run(characterId, item.equipmentId, item.quantity, equippedByDefault);
  }

  return characterId;
}

export interface CharacterPatch {
  hpCurrent?: number;
  tempHp?: number;
  hitDiceUsed?: number;
  inspiration?: boolean;
  notes?: string | null;
  conditions?: string[];
  spellSlotsUsed?: Record<string, number>;
}

export function updateCharacter(id: number, patch: CharacterPatch): void {
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };

  if (patch.hpCurrent !== undefined) {
    fields.push("hp_current = @hpCurrent");
    values.hpCurrent = patch.hpCurrent;
  }
  if (patch.tempHp !== undefined) {
    fields.push("temp_hp = @tempHp");
    values.tempHp = patch.tempHp;
  }
  if (patch.hitDiceUsed !== undefined) {
    fields.push("hit_dice_used = @hitDiceUsed");
    values.hitDiceUsed = patch.hitDiceUsed;
  }
  if (patch.inspiration !== undefined) {
    fields.push("inspiration = @inspiration");
    values.inspiration = patch.inspiration ? 1 : 0;
  }
  if (patch.notes !== undefined) {
    fields.push("notes = @notes");
    values.notes = patch.notes;
  }
  if (patch.conditions !== undefined) {
    fields.push("conditions = @conditions");
    values.conditions = JSON.stringify(patch.conditions);
  }
  if (patch.spellSlotsUsed !== undefined) {
    fields.push("spell_slots_used = @spellSlotsUsed");
    values.spellSlotsUsed = JSON.stringify(patch.spellSlotsUsed);
  }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE characters SET ${fields.join(", ")} WHERE id = @id`).run(values);
}

export function setCharacterPortrait(id: number, portraitPath: string): void {
  db.prepare(
    "UPDATE characters SET portrait_path = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(portraitPath, id);
}
