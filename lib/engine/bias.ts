import db from "@/lib/db";
import { NO_BIAS, type DiceBiasConfig, type DiceBiasMode } from "@/lib/rules/dice";

/**
 * Admin-only read/write for a character's dice bias. Import this ONLY from
 * the roll resolution engine and the admin settings API route — never from
 * any character-facing query, response, or the socket payloads sent to
 * players.
 */
export function getDiceBias(characterId: number): DiceBiasConfig {
  const row = db
    .prepare("SELECT mode, flat_bonus FROM character_dice_bias WHERE character_id = ?")
    .get(characterId) as { mode: DiceBiasMode; flat_bonus: number } | undefined;
  if (!row) return NO_BIAS;
  return { mode: row.mode, flatBonus: row.flat_bonus };
}

export function setDiceBias(characterId: number, bias: DiceBiasConfig): void {
  db.prepare(
    `INSERT INTO character_dice_bias (character_id, mode, flat_bonus, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(character_id) DO UPDATE SET
       mode = excluded.mode, flat_bonus = excluded.flat_bonus, updated_at = datetime('now')`,
  ).run(characterId, bias.mode, bias.flatBonus);
}
