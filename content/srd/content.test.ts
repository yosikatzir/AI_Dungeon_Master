import { describe, expect, it } from "vitest";
import { EQUIPMENT, EQUIPMENT_BY_ID } from "./equipment";
import { FEATS, FEAT_BY_ID } from "./feats";
import { SPECIES } from "./species";
import { CLASSES } from "./classes";
import { SUBCLASSES } from "./subclasses";
import { BACKGROUNDS } from "./backgrounds";
import { SPELLS } from "./spells";
import { MONSTERS } from "./monsters";
import { SKILL_BY_ID } from "@/lib/rules/constants";

function uniqueIds<T extends { id: string }>(items: T[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    expect(seen.has(item.id), `duplicate id "${item.id}"`).toBe(false);
    seen.add(item.id);
  }
}

describe("content id uniqueness", () => {
  it("equipment ids are unique", () => uniqueIds(EQUIPMENT));
  it("feat ids are unique", () => uniqueIds(FEATS));
  it("species ids are unique", () => uniqueIds(SPECIES));
  it("class ids are unique", () => uniqueIds(CLASSES));
  it("subclass ids are unique", () => uniqueIds(SUBCLASSES));
  it("background ids are unique", () => uniqueIds(BACKGROUNDS));
  it("spell ids are unique", () => uniqueIds(SPELLS));
  it("monster ids are unique", () => uniqueIds(MONSTERS));
});

describe("pack contents reference real equipment", () => {
  for (const item of EQUIPMENT) {
    if (item.category !== "pack" || !item.pack) continue;
    it(`${item.id} contents all exist`, () => {
      for (const entry of item.pack!.contents) {
        expect(EQUIPMENT_BY_ID[entry.equipmentId], entry.equipmentId).toBeDefined();
      }
    });
  }
});

describe("classes reference real equipment", () => {
  for (const cls of CLASSES) {
    it(`${cls.id} starting equipment all exists`, () => {
      for (const entry of cls.startingEquipment) {
        expect(EQUIPMENT_BY_ID[entry.equipmentId], entry.equipmentId).toBeDefined();
      }
    });

    it(`${cls.id} skill choices are real skills`, () => {
      for (const skillId of cls.skillChoices) {
        expect(SKILL_BY_ID[skillId], skillId).toBeDefined();
      }
    });
  }
});

describe("backgrounds reference real equipment, feats, and skills", () => {
  for (const bg of BACKGROUNDS) {
    it(`${bg.id} equipment all exists`, () => {
      for (const entry of bg.equipment) {
        expect(EQUIPMENT_BY_ID[entry.equipmentId], entry.equipmentId).toBeDefined();
      }
    });

    it(`${bg.id} origin feat exists and is category 'origin'`, () => {
      const feat = FEAT_BY_ID[bg.originFeatId];
      expect(feat, bg.originFeatId).toBeDefined();
      expect(feat.category).toBe("origin");
    });

    it(`${bg.id} skill proficiencies are real skills`, () => {
      for (const skillId of bg.skillProficiencies) {
        expect(SKILL_BY_ID[skillId], skillId).toBeDefined();
      }
    });

    it(`${bg.id} tool proficiency (if any) resolves to an equipment/tool entry`, () => {
      if (bg.toolProficiency) {
        expect(EQUIPMENT_BY_ID[bg.toolProficiency], bg.toolProficiency).toBeDefined();
      }
    });
  }
});

describe("subclasses reference real classes", () => {
  const classIds = new Set(CLASSES.map((c) => c.id));
  for (const sub of SUBCLASSES) {
    it(`${sub.id} belongs to a real class`, () => {
      expect(classIds.has(sub.classId), sub.classId).toBe(true);
    });
  }

  it("every class has at least one subclass seeded", () => {
    const withSubclass = new Set(SUBCLASSES.map((s) => s.classId));
    for (const cls of CLASSES) {
      expect(withSubclass.has(cls.id), cls.id).toBe(true);
    }
  });
});

describe("spells reference real classes", () => {
  const classIds = new Set(CLASSES.map((c) => c.id));
  for (const sp of SPELLS) {
    it(`${sp.id} classes are all real`, () => {
      for (const classId of sp.classes) {
        expect(classIds.has(classId), classId).toBe(true);
      }
    });
  }

  it("every spellcasting class has at least one level-1-castable cantrip or spell", () => {
    for (const cls of CLASSES) {
      if (cls.spellcastingType === "none") continue;
      const hasCantrip =
        cls.cantripsKnownAtLevel1 === 0 ||
        SPELLS.some((s) => s.level === 0 && s.classes.includes(cls.id));
      const hasLevel1Spell = SPELLS.some(
        (s) => s.level === 1 && s.classes.includes(cls.id),
      );
      expect(hasCantrip, `${cls.id} cantrips`).toBe(true);
      expect(hasLevel1Spell, `${cls.id} level-1 spells`).toBe(true);
    }
  });
});
