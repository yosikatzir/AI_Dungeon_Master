import { describe, expect, it } from "vitest";
import {
  armorClass,
  attackBonus,
  initiativeBonus,
  passivePerception,
  skillOrSaveBonus,
  spellSaveDc,
} from "./combat";
import type { ArmorProps } from "./types";

describe("attackBonus", () => {
  it("adds proficiency bonus only when proficient", () => {
    expect(
      attackBonus({ abilityModifier: 3, proficiencyBonus: 2, proficient: true }),
    ).toBe(5);
    expect(
      attackBonus({ abilityModifier: 3, proficiencyBonus: 2, proficient: false }),
    ).toBe(3);
  });

  it("includes a misc bonus (e.g. magic weapon)", () => {
    expect(
      attackBonus({
        abilityModifier: 3,
        proficiencyBonus: 2,
        proficient: true,
        miscBonus: 1,
      }),
    ).toBe(6);
  });
});

describe("armorClass", () => {
  it("unarmored defaults to 10 + DEX", () => {
    expect(armorClass({ dexModifier: 3, armor: null, hasShield: false })).toBe(13);
  });

  it("light armor adds full DEX", () => {
    const leather: ArmorProps = {
      armorType: "light",
      baseAc: 11,
      dexBonus: true,
      maxDexBonus: null,
      strengthRequirement: null,
      stealthDisadvantage: false,
    };
    expect(armorClass({ dexModifier: 4, armor: leather, hasShield: false })).toBe(15);
  });

  it("heavy armor caps DEX bonus at zero", () => {
    const plate: ArmorProps = {
      armorType: "heavy",
      baseAc: 18,
      dexBonus: false,
      maxDexBonus: 0,
      strengthRequirement: 15,
      stealthDisadvantage: true,
    };
    expect(armorClass({ dexModifier: 4, armor: plate, hasShield: false })).toBe(18);
  });

  it("medium armor caps DEX bonus at +2", () => {
    const halfPlate: ArmorProps = {
      armorType: "medium",
      baseAc: 15,
      dexBonus: true,
      maxDexBonus: 2,
      strengthRequirement: null,
      stealthDisadvantage: true,
    };
    expect(armorClass({ dexModifier: 4, armor: halfPlate, hasShield: false })).toBe(17);
  });

  it("a shield adds +2", () => {
    expect(armorClass({ dexModifier: 2, armor: null, hasShield: true })).toBe(14);
  });
});

describe("skillOrSaveBonus", () => {
  it("expertise doubles the proficiency bonus", () => {
    expect(
      skillOrSaveBonus({
        abilityModifier: 2,
        proficiencyBonus: 3,
        proficient: true,
        expertise: true,
      }),
    ).toBe(8);
  });
});

describe("initiativeBonus / passivePerception / spellSaveDc", () => {
  it("initiative is DEX mod plus any misc bonus", () => {
    expect(initiativeBonus(2, 1)).toBe(3);
  });

  it("passive perception is 10 + skill bonus", () => {
    expect(passivePerception(5)).toBe(15);
  });

  it("spell save DC is 8 + prof + ability mod", () => {
    expect(
      spellSaveDc({ spellcastingAbilityModifier: 3, proficiencyBonus: 2 }),
    ).toBe(13);
  });
});
