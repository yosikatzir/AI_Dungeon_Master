import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content", () => ({ getMonsterById: () => null }));

const { buildNpcStatBlock } = await import("@/lib/npcs");
const { performNpcRoll, describeNpcRoll } = await import("./npcRolls");

const guard = buildNpcStatBlock({
  ac: 16,
  hpMax: 11,
  abilities: { str: 16, dex: 12, wis: 14, cha: 8 },
  skills: { perception: 4 },
  savingThrows: { wis: 5 },
});

describe("performNpcRoll", () => {
  it("applies the listed skill bonus on a skill check", () => {
    const out = performNpcRoll("Gate Guard", guard, { type: "skill_check", skill: "perception", dc: 15 });
    expect(out.npcName).toBe("Gate Guard");
    expect(out.purposeLabel).toBe("Perception check");
    expect(out.modifiers).toEqual([{ label: "Perception", value: 4 }]);
    expect(out.total).toBe(out.die + 4);
    expect(out.dc).toBe(15);
    expect(out.success).toBe(out.total >= 15);
  });

  it("applies the ability modifier on an ability check", () => {
    const out = performNpcRoll("Gate Guard", guard, { type: "ability_check", ability: "str" });
    expect(out.modifiers).toEqual([{ label: "Strength", value: 3 }]); // STR 16 is +3
    expect(out.dc).toBeNull();
    expect(out.success).toBeNull();
  });

  it("uses the proficient save bonus on a saving throw", () => {
    const out = performNpcRoll("Gate Guard", guard, { type: "saving_throw", ability: "wis", dc: 13 });
    expect(out.modifiers).toEqual([{ label: "Wisdom save", value: 5 }]);
  });

  it("resolves an attack against the target's AC", () => {
    const out = performNpcRoll("Gate Guard", guard, {
      type: "attack",
      toHit: 4,
      ac: 14,
      attackName: "Spear",
    });
    expect(out.purposeLabel).toBe("Spear attack");
    expect(out.modifiers).toEqual([{ label: "Spear", value: 4 }]);
    expect(out.dc).toBe(14);
  });

  it("rejects an unknown skill rather than silently rolling flat", () => {
    expect(() =>
      performNpcRoll("Gate Guard", guard, { type: "skill_check", skill: "vibes" }),
    ).toThrow();
  });

  it("stays within the possible d20 range across many rolls", () => {
    for (let i = 0; i < 200; i++) {
      const out = performNpcRoll("Gate Guard", guard, { type: "skill_check", skill: "perception" });
      expect(out.die).toBeGreaterThanOrEqual(1);
      expect(out.die).toBeLessThanOrEqual(20);
      expect(out.total).toBe(out.die + 4);
    }
  });

  it("only flags criticals on attacks, never on checks (5e rule)", () => {
    for (let i = 0; i < 200; i++) {
      const check = performNpcRoll("Gate Guard", guard, { type: "skill_check", skill: "perception" });
      expect(check.critical).toBeNull();
    }
  });
});

describe("describeNpcRoll", () => {
  it("shows the die, modifier, total, DC and verdict", () => {
    const text = describeNpcRoll({
      npcName: "Gate Guard",
      purposeLabel: "Perception check",
      die: 12,
      modifiers: [{ label: "Perception", value: 4 }],
      total: 16,
      dc: 15,
      success: true,
      critical: null,
    });
    expect(text).toBe("Gate Guard — Perception check: 12 +4 Perception = 16 vs 15 — success");
  });

  it("renders a negative modifier with a minus sign", () => {
    const text = describeNpcRoll({
      npcName: "Rat",
      purposeLabel: "Charisma check",
      die: 9,
      modifiers: [{ label: "Charisma", value: -1 }],
      total: 8,
      dc: null,
      success: null,
      critical: null,
    });
    expect(text).toBe("Rat — Charisma check: 9 -1 Charisma = 8");
  });

  it("calls out a critical hit", () => {
    const text = describeNpcRoll({
      npcName: "Goblin",
      purposeLabel: "Scimitar attack",
      die: 20,
      modifiers: [{ label: "Scimitar", value: 4 }],
      total: 24,
      dc: 15,
      success: true,
      critical: "success",
    });
    expect(text).toContain("critical hit!");
  });
});
