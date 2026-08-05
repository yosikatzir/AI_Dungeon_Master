import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content", () => ({
  getMonsterById: (id: string) =>
    id === "goblin"
      ? {
          id: "goblin",
          name: "Goblin",
          ac: 15,
          hp: 7,
          abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
          savingThrows: {},
          skills: { stealth: 6 },
          cr: "1/4",
          actions: [{ name: "Scimitar", description: "+4 to hit, 1d6+2 slashing." }],
        }
      : null,
}));

const {
  buildNpcStatBlock,
  npcSkillBonus,
  npcSaveBonus,
  npcPassivePerception,
  npcPassiveInsight,
  isNpcDefeated,
  formatNpcStatLine,
} = await import("./npcs");

describe("buildNpcStatBlock", () => {
  it("hydrates a known SRD monster and starts it at full HP", () => {
    const stats = buildNpcStatBlock({ monsterId: "goblin" });
    expect(stats.monsterId).toBe("goblin");
    expect(stats.ac).toBe(15);
    expect(stats.hpMax).toBe(7);
    expect(stats.hpCurrent).toBe(7);
    expect(stats.skills.stealth).toBe(6);
    expect(stats.actions?.[0].name).toBe("Scimitar");
  });

  it("lets explicit values override the monster's — a chieftain isn't a rank-and-file goblin", () => {
    const stats = buildNpcStatBlock({ monsterId: "goblin", ac: 17, hpMax: 22 });
    expect(stats.ac).toBe(17);
    expect(stats.hpMax).toBe(22);
    expect(stats.hpCurrent).toBe(22);
    // Untouched fields still come from the monster.
    expect(stats.skills.stealth).toBe(6);
  });

  it("merges partial ability overrides over the monster's scores", () => {
    const stats = buildNpcStatBlock({ monsterId: "goblin", abilities: { str: 16 } });
    expect(stats.abilities.str).toBe(16);
    expect(stats.abilities.dex).toBe(14);
  });

  it("falls back to commoner stats for an original NPC with no monsterId", () => {
    const stats = buildNpcStatBlock({});
    expect(stats.monsterId).toBeUndefined();
    expect(stats.ac).toBe(10);
    expect(stats.abilities.wis).toBe(10);
  });

  it("builds an original NPC from explicit numbers", () => {
    const stats = buildNpcStatBlock({
      ac: 16,
      hpMax: 30,
      abilities: { dex: 18, wis: 14 },
      skills: { perception: 5 },
      savingThrows: { wis: 4 },
      cr: "2",
    });
    expect(stats.ac).toBe(16);
    expect(stats.hpCurrent).toBe(30);
    expect(stats.abilities.dex).toBe(18);
    expect(stats.abilities.str).toBe(10); // omitted scores default
    expect(stats.skills.perception).toBe(5);
    expect(stats.savingThrows.wis).toBe(4);
    expect(stats.cr).toBe("2");
  });

  it("ignores an unknown monsterId rather than throwing", () => {
    const stats = buildNpcStatBlock({ monsterId: "jabberwock", ac: 12 });
    expect(stats.monsterId).toBeUndefined();
    expect(stats.ac).toBe(12);
  });

  it("clamps nonsensical HP and AC to at least 1", () => {
    const stats = buildNpcStatBlock({ ac: 0, hpMax: -5 });
    expect(stats.ac).toBe(1);
    expect(stats.hpMax).toBe(1);
  });

  it("coerces non-numeric ability scores to the default rather than producing NaN", () => {
    const stats = buildNpcStatBlock({ abilities: { str: "strong" as unknown as number } });
    expect(stats.abilities.str).toBe(10);
  });
});

describe("derived NPC numbers", () => {
  const guard = buildNpcStatBlock({
    ac: 16,
    hpMax: 11,
    abilities: { dex: 12, wis: 14, cha: 8 },
    skills: { perception: 4 },
    savingThrows: { wis: 5 },
  });

  it("uses an explicit skill bonus when the stat block lists one", () => {
    expect(npcSkillBonus(guard, "perception")).toBe(4);
  });

  it("falls back to the bare ability modifier for an unlisted skill", () => {
    // Stealth is DEX-based; DEX 12 is +1.
    expect(npcSkillBonus(guard, "stealth")).toBe(1);
  });

  it("returns 0 for an unknown skill id", () => {
    expect(npcSkillBonus(guard, "basket_weaving")).toBe(0);
  });

  it("uses a proficient save when listed, the ability modifier otherwise", () => {
    expect(npcSaveBonus(guard, "wis")).toBe(5);
    expect(npcSaveBonus(guard, "cha")).toBe(-1); // CHA 8 is -1
  });

  it("computes passive Perception as 10 + the Perception bonus", () => {
    expect(npcPassivePerception(guard)).toBe(14);
  });

  it("computes passive Insight from the WIS modifier when Insight isn't listed", () => {
    expect(npcPassiveInsight(guard)).toBe(12); // 10 + WIS 14 (+2)
  });

  it("reports defeat only at 0 HP or below", () => {
    expect(isNpcDefeated(guard)).toBe(false);
    expect(isNpcDefeated({ ...guard, hpCurrent: 1 })).toBe(false);
    expect(isNpcDefeated({ ...guard, hpCurrent: 0 })).toBe(true);
    expect(isNpcDefeated({ ...guard, hpCurrent: -3 })).toBe(true);
  });
});

describe("formatNpcStatLine", () => {
  it("renders the numbers the DM sets DCs from", () => {
    const line = formatNpcStatLine({
      name: "Gate Guard",
      description: "A bored soldier.",
      disposition: "neutral",
      stats: buildNpcStatBlock({ ac: 16, hpMax: 11, abilities: { wis: 14 }, skills: { perception: 4 } }),
    });
    expect(line).toContain("AC 16");
    expect(line).toContain("HP 11/11");
    expect(line).toContain("passive Perception 14");
    expect(line).toContain("Perception +4");
  });

  it("returns an empty string for an NPC with no stats", () => {
    expect(formatNpcStatLine({ name: "Barkeep", description: "Friendly.", disposition: "warm" })).toBe("");
  });

  it("shows negative modifiers with a sign", () => {
    const line = formatNpcStatLine({
      name: "Rat",
      description: "Small.",
      disposition: "hostile",
      stats: buildNpcStatBlock({ abilities: { str: 2 } }),
    });
    expect(line).toContain("STR -4");
  });
});
