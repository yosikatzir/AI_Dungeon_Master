/**
 * Stat blocks for the NPCs and monsters the DM controls.
 *
 * Player characters have full sheets (lib/rules/characterSheet.ts) and roll
 * through the engine, so their side of any check is ground truth. Until this
 * module existed the other side wasn't: an NPC was a name, a description and
 * a disposition, so "do I sneak past the guard?" had no guard to be measured
 * against and the DM had to invent both the DC and the outcome. A statted NPC
 * gives every contested action a real number to beat.
 *
 * Stats come from one of two places: an SRD monster id (the seeded `monsters`
 * table — goblin, wolf, and friends), or scores the DM writes itself for an
 * original NPC. Either way they end up in the same shape, so everything
 * downstream reads one type.
 */

import { getMonsterById } from "@/lib/content";
import { abilityModifier } from "@/lib/rules/abilities";
import { ABILITIES, SKILL_BY_ID, type Ability } from "@/lib/rules/constants";
import type { AbilityScores } from "@/lib/rules/abilities";

export interface NpcStatBlock {
  /** Set when hydrated from the SRD monster table — kept so the source stays traceable. */
  monsterId?: string;
  ac: number;
  hpMax: number;
  hpCurrent: number;
  abilities: AbilityScores;
  /** Total skill bonuses, already including the ability modifier (SRD stat-block convention). */
  skills: Record<string, number>;
  savingThrows: Partial<Record<Ability, number>>;
  cr?: string;
  /** Verbatim SRD action lines ("Scimitar. +4 to hit… 1d6+2 slashing") — the DM's reference for what this creature can do. */
  actions?: { name: string; description: string }[];
}

export interface NpcRosterEntry {
  name: string;
  description: string;
  disposition: string;
  /** Absent for purely narrative NPCs — a barkeep with no adversarial role needs no numbers. */
  stats?: NpcStatBlock;
}

const DEFAULT_ABILITY_SCORE = 10;

/** A plain commoner, used when the DM asks for stats without supplying any. Matches the SRD Commoner. */
export const COMMONER_STATS: Omit<NpcStatBlock, "hpCurrent"> = {
  ac: 10,
  hpMax: 4,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  skills: {},
  savingThrows: {},
  cr: "0",
};

function coerceAbilities(input: unknown): AbilityScores {
  const source = (input ?? {}) as Record<string, unknown>;
  const scores = {} as AbilityScores;
  for (const ability of ABILITIES) {
    const raw = source[ability];
    scores[ability] = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : DEFAULT_ABILITY_SCORE;
  }
  return scores;
}

/**
 * Builds a stat block from whatever the DM supplied. `monsterId` wins when it
 * names a real SRD monster — those numbers are already balanced and complete,
 * so there's no reason to let the model improvise over them. Explicit `ac`/`hp`
 * still override, since a "goblin chieftain" reasonably differs from a goblin.
 */
export function buildNpcStatBlock(params: {
  monsterId?: string;
  ac?: number;
  hpMax?: number;
  abilities?: Partial<AbilityScores>;
  skills?: Record<string, number>;
  savingThrows?: Partial<Record<Ability, number>>;
  cr?: string;
}): NpcStatBlock {
  const monster = params.monsterId ? getMonsterById(params.monsterId) : null;

  const base = monster
    ? {
        monsterId: monster.id,
        ac: monster.ac,
        hpMax: monster.hp,
        abilities: coerceAbilities(monster.abilities),
        skills: { ...monster.skills },
        savingThrows: { ...monster.savingThrows },
        cr: monster.cr,
        actions: monster.actions,
      }
    : {
        ac: COMMONER_STATS.ac,
        hpMax: COMMONER_STATS.hpMax,
        abilities: { ...COMMONER_STATS.abilities },
        skills: {},
        savingThrows: {},
        cr: COMMONER_STATS.cr,
      };

  const hpMax = Math.max(1, Math.round(params.hpMax ?? base.hpMax));

  return {
    ...base,
    ac: Math.max(1, Math.round(params.ac ?? base.ac)),
    hpMax,
    hpCurrent: hpMax,
    abilities: params.abilities ? coerceAbilities({ ...base.abilities, ...params.abilities }) : base.abilities,
    skills: params.skills ? { ...base.skills, ...params.skills } : base.skills,
    savingThrows: params.savingThrows
      ? { ...base.savingThrows, ...params.savingThrows }
      : base.savingThrows,
    cr: params.cr ?? base.cr,
  };
}

/** Total bonus for a skill: an explicit stat-block entry if present, otherwise the bare ability modifier. */
export function npcSkillBonus(stats: NpcStatBlock, skillId: string): number {
  const explicit = stats.skills[skillId];
  if (typeof explicit === "number") return explicit;
  const def = SKILL_BY_ID[skillId];
  if (!def) return 0;
  return abilityModifier(stats.abilities[def.ability]);
}

/** Total bonus for a saving throw: an explicit proficient save if present, otherwise the bare ability modifier. */
export function npcSaveBonus(stats: NpcStatBlock, ability: Ability): number {
  const explicit = stats.savingThrows[ability];
  if (typeof explicit === "number") return explicit;
  return abilityModifier(stats.abilities[ability]);
}

/**
 * 10 + the creature's Perception bonus — the static DC a player must beat to
 * sneak past or hide from it. Using this instead of an invented number is what
 * makes "I try to hide" resolve against something real, and it avoids a second
 * round-trip to roll the NPC's side of an opposed check.
 */
export function npcPassivePerception(stats: NpcStatBlock): number {
  return 10 + npcSkillBonus(stats, "perception");
}

/** Same idea for the social skills a player might try to beat. */
export function npcPassiveInsight(stats: NpcStatBlock): number {
  return 10 + npcSkillBonus(stats, "insight");
}

export function isNpcDefeated(stats: NpcStatBlock): boolean {
  return stats.hpCurrent <= 0;
}

/** One compact line of ground truth per statted NPC, for the DM's context block. */
export function formatNpcStatLine(entry: NpcRosterEntry): string {
  const { stats } = entry;
  if (!stats) return "";
  const mods = ABILITIES.map((a) => {
    const mod = abilityModifier(stats.abilities[a]);
    return `${a.toUpperCase()} ${mod >= 0 ? "+" : ""}${mod}`;
  }).join(" ");
  const skills = Object.entries(stats.skills)
    .map(([id, bonus]) => `${SKILL_BY_ID[id]?.name ?? id} ${bonus >= 0 ? "+" : ""}${bonus}`)
    .join(", ");
  const parts = [
    `AC ${stats.ac}`,
    `HP ${stats.hpCurrent}/${stats.hpMax}`,
    `passive Perception ${npcPassivePerception(stats)}`,
    mods,
  ];
  if (skills) parts.push(`skills: ${skills}`);
  if (stats.cr) parts.push(`CR ${stats.cr}`);
  return parts.join(" | ");
}
