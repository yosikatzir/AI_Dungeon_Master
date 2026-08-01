import { describe, expect, it } from "vitest";
import { formatRollOutcome, type RollOutcome } from "./rolls";

function outcome(overrides: Partial<RollOutcome>): RollOutcome {
  return {
    characterId: 1,
    characterName: null,
    purposeLabel: "DEX check",
    sides: 20,
    die: 14,
    modifiers: [],
    total: 14,
    dc: null,
    success: null,
    critical: null,
    ...overrides,
  };
}

describe("formatRollOutcome", () => {
  it("matches the spec's example format", () => {
    const result = formatRollOutcome(
      outcome({
        purposeLabel: "Dexterity check",
        die: 14,
        modifiers: [
          { label: "DEX", value: 3 },
          { label: "Proficiency", value: 2 },
        ],
        total: 19,
        dc: 15,
        success: true,
      }),
    );
    expect(result).toBe("Dexterity check — d20: 14 +3 DEX +2 Proficiency = 19 vs DC 15 — Success!");
  });

  it("shows Failure for an unsuccessful roll against a DC", () => {
    const result = formatRollOutcome(
      outcome({ die: 5, modifiers: [{ label: "STR", value: 1 }], total: 6, dc: 15, success: false }),
    );
    expect(result).toContain("Failure.");
  });

  it("omits the total/DC clause for a plain raw roll", () => {
    const result = formatRollOutcome(outcome({ sides: 6, die: 4, total: 4 }));
    expect(result).toBe("d6: 4");
  });

  it("flags a natural 20 on an attack roll", () => {
    const result = formatRollOutcome(
      outcome({
        purposeLabel: "Longsword attack",
        die: 20,
        modifiers: [{ label: "Longsword", value: 5 }],
        total: 25,
        dc: 15,
        success: true,
        critical: "success",
      }),
    );
    expect(result).toContain("(natural 20!)");
  });
});
