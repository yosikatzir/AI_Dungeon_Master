import { describe, expect, it } from "vitest";
import { computeCharacterSheet } from "./characterSheet";
import { applyBackgroundAbilityBonus, validateStandardArray } from "./abilities";
import type { CharacterRecord, CharacterItem, ResolvedCharacter } from "./character";
import { CLASS_BY_ID } from "@/content/srd/classes";
import { SPECIES_BY_ID } from "@/content/srd/species";
import { BACKGROUND_BY_ID } from "@/content/srd/backgrounds";
import { EQUIPMENT_BY_ID } from "@/content/srd/equipment";

function itemsFor(equipmentIds: { id: string; qty?: number; equipped?: boolean }[]): CharacterItem[] {
  return equipmentIds.map(({ id, qty = 1, equipped = true }) => ({
    equipmentId: id,
    quantity: qty,
    equipped,
    equipment: EQUIPMENT_BY_ID[id],
  }));
}

function baseCharacter(overrides: Partial<CharacterRecord>): CharacterRecord {
  return {
    id: 1,
    userId: 1,
    name: "Test Character",
    speciesId: "human",
    classId: "fighter",
    subclassId: null,
    backgroundId: "soldier",
    level: 1,
    xp: 0,
    alignment: "Neutral Good",
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hpCurrent: 1,
    tempHp: 0,
    hitDiceUsed: 0,
    inspiration: false,
    skillProficiencies: [],
    otherProficiencies: [],
    feats: [],
    cantripsKnown: [],
    spellsKnown: [],
    spellSlotsUsed: {},
    classChoices: {},
    conditions: [],
    portraitPath: null,
    appearance: null,
    backstory: null,
    notes: null,
    ...overrides,
  };
}

describe("level-1 Fighter built legally end-to-end", () => {
  const standardArrayScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };

  const background = BACKGROUND_BY_ID["soldier"];
  const finalScores = applyBackgroundAbilityBonus(standardArrayScores, background.abilityScores, {
    mode: "2-1",
    plus2: "str",
    plus1: "con",
  });

  const character = baseCharacter({
    classId: "fighter",
    speciesId: "human",
    backgroundId: "soldier",
    abilityScores: finalScores,
    skillProficiencies: ["athletics", "intimidation"], // fighter's 2 choices
    feats: [background.originFeatId],
  });

  const resolved: ResolvedCharacter = {
    character,
    species: SPECIES_BY_ID["human"],
    klass: CLASS_BY_ID["fighter"],
    subclass: null,
    background,
    items: itemsFor([
      { id: "chain_mail" },
      { id: "shield" },
      { id: "longsword" },
      { id: "explorers_pack", equipped: false },
    ]),
  };

  const sheet = computeCharacterSheet(resolved);

  it("assigns the standard array legally", () => {
    expect(validateStandardArray(standardArrayScores).valid).toBe(true);
  });

  it("has legal final ability scores (17 STR after +2, 14 CON after +1)", () => {
    expect(finalScores.str).toBe(17);
    expect(finalScores.con).toBe(14);
  });

  it("computes HP from a d10 hit die + CON modifier", () => {
    // d10 max (10) + CON mod (+2) = 12
    expect(sheet.hpMax).toBe(12);
  });

  it("computes AC from heavy armor (no DEX) + shield", () => {
    // chain mail base 16, no DEX bonus, +2 shield = 18
    expect(sheet.armorClass).toBe(18);
  });

  it("is proficient with a martial weapon and gets STR to hit", () => {
    const longsword = sheet.attacks.find((a) => a.equipmentId === "longsword");
    expect(longsword).toBeDefined();
    // STR mod (+3) + proficiency bonus (+2) = 5
    expect(longsword!.toHit).toBe(5);
  });

  it("has no spellcasting", () => {
    expect(sheet.spellSlots).toBeNull();
  });
});

describe("level-1 Wizard built legally end-to-end", () => {
  const standardArrayScores = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };
  const background = BACKGROUND_BY_ID["sage"];
  const finalScores = applyBackgroundAbilityBonus(standardArrayScores, background.abilityScores, {
    mode: "2-1",
    plus2: "int",
    plus1: "con",
  });

  const character = baseCharacter({
    classId: "wizard",
    speciesId: "human",
    backgroundId: "sage",
    abilityScores: finalScores,
    skillProficiencies: ["arcana", "history"],
    cantripsKnown: ["fire_bolt", "mage_hand", "prestidigitation"],
    spellsKnown: ["magic_missile", "shield"],
    feats: [background.originFeatId],
  });

  const resolved: ResolvedCharacter = {
    character,
    species: SPECIES_BY_ID["human"],
    klass: CLASS_BY_ID["wizard"],
    subclass: null,
    background,
    items: itemsFor([{ id: "quarterstaff" }, { id: "component_pouch", equipped: false }]),
  };

  const sheet = computeCharacterSheet(resolved);

  it("has legal final ability scores (17 INT after +2, 14 CON after +1)", () => {
    expect(finalScores.int).toBe(17);
    expect(finalScores.con).toBe(14);
  });

  it("computes HP from a d6 hit die + CON modifier", () => {
    // d6 max (6) + CON mod (+2) = 8
    expect(sheet.hpMax).toBe(8);
  });

  it("is unarmored, so AC is 10 + DEX", () => {
    expect(sheet.armorClass).toBe(12);
  });

  it("has two 1st-level spell slots and a spell save DC", () => {
    expect(sheet.spellSlots?.max[0]).toBe(2);
    // 8 + prof (2) + INT mod (+3) = 13
    expect(sheet.spellSaveDc).toBe(13);
  });

  it("has no weapon proficiency with a longsword (not on the wizard's list)", () => {
    // The wizard only carries a quarterstaff (proficient, simple-ish) — verify
    // proficiency is correctly scoped to the wizard's narrow weapon list.
    expect(CLASS_BY_ID["wizard"].weaponProficiencies).not.toContain("martial");
    expect(CLASS_BY_ID["wizard"].weaponProficiencies).not.toContain("simple");
  });
});
