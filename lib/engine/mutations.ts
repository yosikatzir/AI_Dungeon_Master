import db from "@/lib/db";
import { getCharacterRecord, resolveCharacter } from "@/lib/characters";
import { getEquipmentById } from "@/lib/content";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { levelForXp } from "@/lib/rules/constants";

export class EngineValidationError extends Error {}

function requireCharacter(characterId: number) {
  const resolved = resolveCharacter(characterId);
  if (!resolved) throw new EngineValidationError("Character not found");
  return resolved;
}

export function applyDamage(
  characterId: number,
  amount: number,
): { hpCurrent: number; tempHp: number; hpMax: number } {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new EngineValidationError("Damage must be a non-negative integer");
  }
  const resolved = requireCharacter(characterId);
  const sheet = computeCharacterSheet(resolved);

  let remaining = amount;
  let tempHp = resolved.character.tempHp;
  if (tempHp > 0) {
    const absorbed = Math.min(tempHp, remaining);
    tempHp -= absorbed;
    remaining -= absorbed;
  }
  const hpCurrent = Math.max(0, resolved.character.hpCurrent - remaining);

  db.prepare(
    "UPDATE characters SET hp_current = ?, temp_hp = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(hpCurrent, tempHp, characterId);

  return { hpCurrent, tempHp, hpMax: sheet.hpMax };
}

export function applyHealing(
  characterId: number,
  amount: number,
): { hpCurrent: number; hpMax: number } {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new EngineValidationError("Healing must be a non-negative integer");
  }
  const resolved = requireCharacter(characterId);
  const sheet = computeCharacterSheet(resolved);
  const hpCurrent = Math.min(sheet.hpMax, resolved.character.hpCurrent + amount);

  db.prepare("UPDATE characters SET hp_current = ?, updated_at = datetime('now') WHERE id = ?").run(
    hpCurrent,
    characterId,
  );

  return { hpCurrent, hpMax: sheet.hpMax };
}

export function consumeSpellSlot(
  characterId: number,
  level: number,
): { slotsUsed: Record<number, number>; maxAtLevel: number } {
  const resolved = requireCharacter(characterId);
  const sheet = computeCharacterSheet(resolved);
  if (!sheet.spellSlots) throw new EngineValidationError("This character has no spellcasting");

  const maxAtLevel = sheet.spellSlots.max[level - 1] ?? 0;
  const used = sheet.spellSlots.used[level] ?? 0;
  if (used >= maxAtLevel) {
    throw new EngineValidationError(`No level ${level} spell slots remaining`);
  }

  const newUsed = { ...resolved.character.spellSlotsUsed, [level]: used + 1 };
  db.prepare(
    "UPDATE characters SET spell_slots_used = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(JSON.stringify(newUsed), characterId);

  return { slotsUsed: newUsed, maxAtLevel };
}

export function longRest(characterId: number): { hpCurrent: number; hpMax: number } {
  const resolved = requireCharacter(characterId);
  const sheet = computeCharacterSheet(resolved);
  db.prepare(
    `UPDATE characters
     SET hp_current = ?, spell_slots_used = '{}', hit_dice_used = 0, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(sheet.hpMax, characterId);
  return { hpCurrent: sheet.hpMax, hpMax: sheet.hpMax };
}

export function grantItem(characterId: number, equipmentId: string, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new EngineValidationError("Quantity must be a positive integer");
  }
  const item = getEquipmentById(equipmentId);
  if (!item) throw new EngineValidationError("Unknown item");

  const existing = db
    .prepare("SELECT id, quantity FROM character_items WHERE character_id = ? AND equipment_id = ?")
    .get(characterId, equipmentId) as { id: number; quantity: number } | undefined;

  if (existing) {
    db.prepare("UPDATE character_items SET quantity = ? WHERE id = ?").run(
      existing.quantity + quantity,
      existing.id,
    );
  } else {
    db.prepare(
      "INSERT INTO character_items (character_id, equipment_id, quantity, equipped) VALUES (?, ?, ?, 0)",
    ).run(characterId, equipmentId, quantity);
  }
}

export function removeItem(characterId: number, equipmentId: string, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new EngineValidationError("Quantity must be a positive integer");
  }
  const existing = db
    .prepare("SELECT id, quantity FROM character_items WHERE character_id = ? AND equipment_id = ?")
    .get(characterId, equipmentId) as { id: number; quantity: number } | undefined;

  if (!existing || existing.quantity < quantity) {
    throw new EngineValidationError("Not enough of that item to remove");
  }
  if (existing.quantity === quantity) {
    db.prepare("DELETE FROM character_items WHERE id = ?").run(existing.id);
  } else {
    db.prepare("UPDATE character_items SET quantity = ? WHERE id = ?").run(
      existing.quantity - quantity,
      existing.id,
    );
  }
}

export function awardXp(
  characterId: number,
  amount: number,
): { xp: number; level: number; leveledUp: boolean } {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new EngineValidationError("XP must be a non-negative integer");
  }
  const character = getCharacterRecord(characterId);
  if (!character) throw new EngineValidationError("Character not found");

  const xp = character.xp + amount;
  const level = Math.min(20, levelForXp(xp));
  const leveledUp = level > character.level;

  db.prepare("UPDATE characters SET xp = ?, level = ?, updated_at = datetime('now') WHERE id = ?").run(
    xp,
    level,
    characterId,
  );

  return { xp, level, leveledUp };
}

export function applyCondition(characterId: number, condition: string): void {
  const character = getCharacterRecord(characterId);
  if (!character) throw new EngineValidationError("Character not found");
  if (character.conditions.includes(condition)) return;

  const updated = [...character.conditions, condition];
  db.prepare("UPDATE characters SET conditions = ?, updated_at = datetime('now') WHERE id = ?").run(
    JSON.stringify(updated),
    characterId,
  );
}

export function removeCondition(characterId: number, condition: string): void {
  const character = getCharacterRecord(characterId);
  if (!character) throw new EngineValidationError("Character not found");

  const updated = character.conditions.filter((c) => c !== condition);
  db.prepare("UPDATE characters SET conditions = ?, updated_at = datetime('now') WHERE id = ?").run(
    JSON.stringify(updated),
    characterId,
  );
}
