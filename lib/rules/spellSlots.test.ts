import { describe, expect, it } from "vitest";
import { fullCasterSlots, halfCasterSlots, warlockPactMagic } from "./spellSlots";

describe("fullCasterSlots (Wizard/Cleric/Druid/Sorcerer/Bard)", () => {
  it("level 1 has two 1st-level slots and nothing else", () => {
    expect(fullCasterSlots(1)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("level 5 gains access to 3rd-level slots", () => {
    expect(fullCasterSlots(5)).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
  });

  it("level 20 has the full 9-level spread", () => {
    expect(fullCasterSlots(20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });
});

describe("halfCasterSlots (Paladin/Ranger)", () => {
  it("has no slots at level 1", () => {
    expect(halfCasterSlots(1)).toEqual([0, 0, 0, 0, 0]);
  });

  it("gains 1st-level slots at level 2", () => {
    expect(halfCasterSlots(2)).toEqual([2, 0, 0, 0, 0]);
  });
});

describe("warlockPactMagic", () => {
  it("has a single 1st-level slot at level 1", () => {
    expect(warlockPactMagic(1)).toEqual({ slots: 1, slotLevel: 1 });
  });

  it("slots stay high-level and few, per Pact Magic", () => {
    expect(warlockPactMagic(11)).toEqual({ slots: 3, slotLevel: 5 });
  });
});
