import db from "@/lib/db";
import { getCampaignMembers } from "@/lib/campaigns";
import { resolveCharacter } from "@/lib/characters";
import { computeCharacterSheet } from "@/lib/rules/characterSheet";
import { getDiceBias } from "@/lib/engine/bias";
import { rollBiasedD20 } from "@/lib/rules/dice";

export interface TurnEntry {
  characterId: number;
  name: string;
  initiative: number;
}

export interface CombatState {
  active: boolean;
  turnOrder: TurnEntry[];
  currentTurnIndex: number;
}

function rowToState(row: any): CombatState {
  return {
    active: !!row.active,
    turnOrder: JSON.parse(row.turn_order),
    currentTurnIndex: row.current_turn_index,
  };
}

export function getCombatState(campaignId: number): CombatState {
  const row = db.prepare("SELECT * FROM campaign_combat WHERE campaign_id = ?").get(campaignId);
  if (!row) return { active: false, turnOrder: [], currentTurnIndex: 0 };
  return rowToState(row);
}

/** Rolls initiative (d20 + DEX mod, admin bias applies same as any d20) for every present, enrolled character. */
export function rollInitiative(campaignId: number): CombatState {
  const members = getCampaignMembers(campaignId).filter(
    (m) => m.status === "active" && m.characterId !== null,
  );

  const entries: TurnEntry[] = members.map((m) => {
    const resolved = resolveCharacter(m.characterId!);
    const dexMod = resolved ? computeCharacterSheet(resolved).initiative : 0;
    const die = rollBiasedD20(getDiceBias(m.characterId!));
    return {
      characterId: m.characterId!,
      name: m.characterName ?? m.username,
      initiative: die + dexMod,
    };
  });
  entries.sort((a, b) => b.initiative - a.initiative);

  db.prepare(
    `INSERT INTO campaign_combat (campaign_id, active, turn_order, current_turn_index, updated_at)
     VALUES (?, 1, ?, 0, datetime('now'))
     ON CONFLICT(campaign_id) DO UPDATE SET
       active = 1, turn_order = excluded.turn_order, current_turn_index = 0, updated_at = datetime('now')`,
  ).run(campaignId, JSON.stringify(entries));

  return { active: true, turnOrder: entries, currentTurnIndex: 0 };
}

export function nextTurn(campaignId: number): CombatState {
  const state = getCombatState(campaignId);
  if (!state.active || state.turnOrder.length === 0) {
    throw new Error("No active combat in this campaign");
  }
  const currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  db.prepare(
    "UPDATE campaign_combat SET current_turn_index = ?, updated_at = datetime('now') WHERE campaign_id = ?",
  ).run(currentTurnIndex, campaignId);
  return { ...state, currentTurnIndex };
}

export function endCombat(campaignId: number): void {
  db.prepare(
    "UPDATE campaign_combat SET active = 0, updated_at = datetime('now') WHERE campaign_id = ?",
  ).run(campaignId);
}
