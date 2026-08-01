import { describe, expect, it } from "vitest";
import {
  abilityModifier,
  applyBackgroundAbilityBonus,
  validatePointBuy,
  validateStandardArray,
  validateManualScores,
  type AbilityScores,
} from "./abilities";

describe("abilityModifier", () => {
  it.each([
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [20, 5],
    [1, -5],
  ])("modifier for score %i is %i", (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });
});

function scores(overrides: Partial<AbilityScores>): AbilityScores {
  return {
    str: 8,
    dex: 8,
    con: 8,
    int: 8,
    wis: 8,
    cha: 8,
    ...overrides,
  };
}

describe("validatePointBuy", () => {
  it("accepts a legal 27-point spread", () => {
    // 15(9) + 14(7) + 13(5) + 12(4) + 10(2) + 8(0) = 27
    const result = validatePointBuy(
      scores({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a spread that exceeds the budget", () => {
    const result = validatePointBuy(
      scores({ str: 15, dex: 15, con: 15, int: 15, wis: 8, cha: 8 }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects a score outside the 8-15 range", () => {
    const result = validatePointBuy(scores({ str: 16 }));
    expect(result.valid).toBe(false);
  });
});

describe("validateStandardArray", () => {
  it("accepts the standard array assigned once each", () => {
    const result = validateStandardArray(
      scores({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a duplicated value", () => {
    const result = validateStandardArray(
      scores({ str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 }),
    );
    expect(result.valid).toBe(false);
  });
});

describe("validateManualScores", () => {
  it("accepts scores within 1-20", () => {
    expect(validateManualScores(scores({ str: 18, cha: 3 })).valid).toBe(true);
  });

  it("rejects a score above 20", () => {
    expect(validateManualScores(scores({ str: 21 })).valid).toBe(false);
  });
});

describe("applyBackgroundAbilityBonus", () => {
  const base = scores({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });

  it("applies a +2/+1 split across two eligible abilities", () => {
    const result = applyBackgroundAbilityBonus(base, ["str", "dex", "con"], {
      mode: "2-1",
      plus2: "str",
      plus1: "con",
    });
    expect(result).toEqual({ ...base, str: 17, con: 14 });
  });

  it("applies +1/+1/+1 across all three eligible abilities", () => {
    const result = applyBackgroundAbilityBonus(base, ["str", "dex", "con"], {
      mode: "1-1-1",
    });
    expect(result).toEqual({ ...base, str: 16, dex: 15, con: 14 });
  });

  it("rejects a +2 target outside the eligible set", () => {
    expect(() =>
      applyBackgroundAbilityBonus(base, ["str", "dex", "con"], {
        mode: "2-1",
        plus2: "cha",
        plus1: "con",
      }),
    ).toThrow();
  });
});
