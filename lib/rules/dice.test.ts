import { describe, expect, it } from "vitest";
import { rollRawDie, rollBiasedD20, resolveD20Check, rollDamage, type RngFn } from "./dice";

/** A fake RNG that returns a fixed sequence of raw d20-range values (1-20) on each call. */
function sequenceRng(values: number[]): RngFn {
  let i = 0;
  return () => {
    const v = values[i] ?? values[values.length - 1];
    i++;
    return v;
  };
}

describe("rollRawDie", () => {
  it("returns whatever the injected RNG produces, mapped through it directly", () => {
    const rng = sequenceRng([7]);
    expect(rollRawDie(20, rng)).toBe(7);
  });
});

describe("rollBiasedD20 — dice bias", () => {
  it("mode 'none' returns the raw roll unmodified", () => {
    const rng = sequenceRng([14]);
    expect(rollBiasedD20({ mode: "none", flatBonus: 0 }, rng)).toBe(14);
  });

  it("mode 'flat' adds the bonus to the raw roll", () => {
    const rng = sequenceRng([10]);
    expect(rollBiasedD20({ mode: "flat", flatBonus: 2 }, rng)).toBe(12);
  });

  it("mode 'flat' clamps at 20 so the result always looks like a legal natural roll", () => {
    const rng = sequenceRng([19]);
    expect(rollBiasedD20({ mode: "flat", flatBonus: 5 }, rng)).toBe(20);
  });

  it("mode 'flat' clamps at 1 for a negative bonus", () => {
    const rng = sequenceRng([2]);
    expect(rollBiasedD20({ mode: "flat", flatBonus: -5 }, rng)).toBe(1);
  });

  it("mode 'advantage_weighted' takes the higher of two raw rolls", () => {
    const rng = sequenceRng([6, 15]);
    expect(rollBiasedD20({ mode: "advantage_weighted", flatBonus: 0 }, rng)).toBe(15);
  });

  it("the biased result is always a value a fair d20 could produce (1-20)", () => {
    // Run many combinations to make sure clamping/logic never escapes the legal range.
    for (let raw = 1; raw <= 20; raw++) {
      const rng = sequenceRng([raw]);
      const flat = rollBiasedD20({ mode: "flat", flatBonus: 10 }, rng);
      expect(flat).toBeGreaterThanOrEqual(1);
      expect(flat).toBeLessThanOrEqual(20);
    }
  });
});

describe("resolveD20Check", () => {
  it("sums modifiers into the total", () => {
    const rng = sequenceRng([10]);
    const result = resolveD20Check({
      category: "check",
      bias: { mode: "none", flatBonus: 0 },
      modifiers: [
        { label: "DEX", value: 3 },
        { label: "Proficiency", value: 2 },
      ],
      rng,
    });
    expect(result.die).toBe(10);
    expect(result.total).toBe(15);
  });

  it("compares total to DC for success/failure", () => {
    const rng = sequenceRng([10]);
    const pass = resolveD20Check({
      category: "check",
      bias: { mode: "none", flatBonus: 0 },
      modifiers: [{ label: "WIS", value: 5 }],
      dc: 15,
      rng,
    });
    expect(pass.success).toBe(true);

    const rng2 = sequenceRng([10]);
    const fail = resolveD20Check({
      category: "check",
      bias: { mode: "none", flatBonus: 0 },
      modifiers: [{ label: "WIS", value: 1 }],
      dc: 15,
      rng: rng2,
    });
    expect(fail.success).toBe(false);
  });

  it("nat 20/1 auto-succeed/fail attack rolls regardless of total vs AC", () => {
    const rngNat20 = sequenceRng([20]);
    const critHit = resolveD20Check({
      category: "attack",
      bias: { mode: "none", flatBonus: 0 },
      modifiers: [{ label: "STR", value: -5 }], // would otherwise miss badly
      dc: 25,
      rng: rngNat20,
    });
    expect(critHit.critical).toBe("success");
    expect(critHit.success).toBe(true);

    const rngNat1 = sequenceRng([1]);
    const critMiss = resolveD20Check({
      category: "attack",
      bias: { mode: "none", flatBonus: 0 },
      modifiers: [{ label: "STR", value: 10 }], // would otherwise hit easily
      dc: 5,
      rng: rngNat1,
    });
    expect(critMiss.critical).toBe("failure");
    expect(critMiss.success).toBe(false);
  });

  it("nat 20/1 do NOT auto-succeed/fail ability checks or saving throws (5e RAW)", () => {
    const rngNat1 = sequenceRng([1]);
    const result = resolveD20Check({
      category: "check",
      bias: { mode: "none", flatBonus: 0 },
      modifiers: [{ label: "STR", value: 20 }],
      dc: 10,
      rng: rngNat1,
    });
    expect(result.critical).toBeNull();
    expect(result.success).toBe(true); // 1 + 20 = 21 >= 10, still succeeds
  });
});

describe("rollDamage", () => {
  it("rolls the specified number and size of dice", () => {
    const rng = sequenceRng([3, 5]);
    const result = rollDamage("2d6", rng);
    expect(result.rolls).toEqual([3, 5]);
    expect(result.total).toBe(8);
  });

  it("rejects a malformed dice expression", () => {
    expect(() => rollDamage("not-dice")).toThrow();
  });
});
