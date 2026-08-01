import { describe, expect, it } from "vitest";
import { hpMaxForLevel } from "./hp";

describe("hpMaxForLevel", () => {
  it("level 1 fighter (d10) with +2 CON is max die + mod", () => {
    expect(hpMaxForLevel(10, 1, 2)).toBe(12);
  });

  it("level 1 wizard (d6) with +1 CON", () => {
    expect(hpMaxForLevel(6, 1, 1)).toBe(7);
  });

  it("accrues fixed average per level thereafter", () => {
    // d8, +2 CON: level 1 = 10, then +7 per level (5 + 2)
    expect(hpMaxForLevel(8, 2, 2)).toBe(17);
    expect(hpMaxForLevel(8, 3, 2)).toBe(24);
  });

  it("throws for level below 1", () => {
    expect(() => hpMaxForLevel(8, 0, 0)).toThrow();
  });
});
