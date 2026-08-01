import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { ADMIN_USERNAME } from "@/lib/config";
import { SPECIES } from "@/content/srd/species";
import { CLASSES } from "@/content/srd/classes";
import { SUBCLASSES } from "@/content/srd/subclasses";
import { BACKGROUNDS } from "@/content/srd/backgrounds";
import { FEATS } from "@/content/srd/feats";
import { SPELLS } from "@/content/srd/spells";
import { EQUIPMENT } from "@/content/srd/equipment";
import { MONSTERS } from "@/content/srd/monsters";

async function seedAdmin() {
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(ADMIN_USERNAME);

  if (existing) {
    console.log(`Admin account "${ADMIN_USERNAME}" already exists.`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  db.prepare(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
  ).run(ADMIN_USERNAME, passwordHash);

  console.log(`Created admin account "${ADMIN_USERNAME}".`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(
      `Generated password (save this now, it will not be shown again): ${password}`,
    );
  }
}

function seedSrdContent() {
  // Feats first — backgrounds reference them by id.
  const insertFeat = db.prepare(`
    INSERT INTO feats (id, name, category, prerequisite, benefits, description)
    VALUES (@id, @name, @category, @prerequisite, @benefits, @description)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, category=excluded.category, prerequisite=excluded.prerequisite,
      benefits=excluded.benefits, description=excluded.description
  `);
  for (const f of FEATS) {
    insertFeat.run({ ...f, benefits: JSON.stringify(f.benefits) });
  }

  const insertSpecies = db.prepare(`
    INSERT INTO species (id, name, size, speed, traits, description)
    VALUES (@id, @name, @size, @speed, @traits, @description)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, size=excluded.size, speed=excluded.speed,
      traits=excluded.traits, description=excluded.description
  `);
  for (const s of SPECIES) {
    insertSpecies.run({ ...s, traits: JSON.stringify(s.traits) });
  }

  const insertEquipment = db.prepare(`
    INSERT INTO equipment (id, name, category, cost_gp, weight, weapon, armor, pack, description)
    VALUES (@id, @name, @category, @costGp, @weight, @weapon, @armor, @pack, @description)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, category=excluded.category, cost_gp=excluded.cost_gp, weight=excluded.weight,
      weapon=excluded.weapon, armor=excluded.armor, pack=excluded.pack, description=excluded.description
  `);
  for (const e of EQUIPMENT) {
    insertEquipment.run({
      id: e.id,
      name: e.name,
      category: e.category,
      costGp: e.costGp,
      weight: e.weight,
      weapon: e.weapon ? JSON.stringify(e.weapon) : null,
      armor: e.armor ? JSON.stringify(e.armor) : null,
      pack: e.pack ? JSON.stringify(e.pack) : null,
      description: e.description,
    });
  }

  const insertClass = db.prepare(`
    INSERT INTO classes (
      id, name, hit_die, primary_abilities, saving_throws, armor_proficiencies,
      weapon_proficiencies, tool_proficiencies, skill_choice_count, skill_choices,
      starting_equipment, spellcasting_ability, spellcasting_type,
      cantrips_known_at_level1, spells_prepared_or_known_at_level1,
      has_fighting_style_at_level1, extra_asi_levels, subclass_level,
      level1_features, description
    ) VALUES (
      @id, @name, @hitDie, @primaryAbilities, @savingThrows, @armorProficiencies,
      @weaponProficiencies, @toolProficiencies, @skillChoiceCount, @skillChoices,
      @startingEquipment, @spellcastingAbility, @spellcastingType,
      @cantripsKnownAtLevel1, @spellsPreparedOrKnownAtLevel1,
      @hasFightingStyleAtLevel1, @extraAsiLevels, @subclassLevel,
      @level1Features, @description
    )
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, hit_die=excluded.hit_die, primary_abilities=excluded.primary_abilities,
      saving_throws=excluded.saving_throws, armor_proficiencies=excluded.armor_proficiencies,
      weapon_proficiencies=excluded.weapon_proficiencies, tool_proficiencies=excluded.tool_proficiencies,
      skill_choice_count=excluded.skill_choice_count, skill_choices=excluded.skill_choices,
      starting_equipment=excluded.starting_equipment, spellcasting_ability=excluded.spellcasting_ability,
      spellcasting_type=excluded.spellcasting_type, cantrips_known_at_level1=excluded.cantrips_known_at_level1,
      spells_prepared_or_known_at_level1=excluded.spells_prepared_or_known_at_level1,
      has_fighting_style_at_level1=excluded.has_fighting_style_at_level1,
      extra_asi_levels=excluded.extra_asi_levels, subclass_level=excluded.subclass_level,
      level1_features=excluded.level1_features, description=excluded.description
  `);
  for (const c of CLASSES) {
    insertClass.run({
      id: c.id,
      name: c.name,
      hitDie: c.hitDie,
      primaryAbilities: JSON.stringify(c.primaryAbilities),
      savingThrows: JSON.stringify(c.savingThrows),
      armorProficiencies: JSON.stringify(c.armorProficiencies),
      weaponProficiencies: JSON.stringify(c.weaponProficiencies),
      toolProficiencies: JSON.stringify(c.toolProficiencies),
      skillChoiceCount: c.skillChoiceCount,
      skillChoices: JSON.stringify(c.skillChoices),
      startingEquipment: JSON.stringify(c.startingEquipment),
      spellcastingAbility: c.spellcastingAbility,
      spellcastingType: c.spellcastingType,
      cantripsKnownAtLevel1: c.cantripsKnownAtLevel1,
      spellsPreparedOrKnownAtLevel1: String(c.spellsPreparedOrKnownAtLevel1),
      hasFightingStyleAtLevel1: c.hasFightingStyleAtLevel1 ? 1 : 0,
      extraAsiLevels: JSON.stringify(c.extraAsiLevels),
      subclassLevel: c.subclassLevel,
      level1Features: JSON.stringify(c.level1Features),
      description: c.description,
    });
  }

  const insertSubclass = db.prepare(`
    INSERT INTO subclasses (id, class_id, name, description, features)
    VALUES (@id, @classId, @name, @description, @features)
    ON CONFLICT(id) DO UPDATE SET
      class_id=excluded.class_id, name=excluded.name, description=excluded.description, features=excluded.features
  `);
  for (const s of SUBCLASSES) {
    insertSubclass.run({ ...s, features: JSON.stringify(s.features) });
  }

  const insertBackground = db.prepare(`
    INSERT INTO backgrounds (id, name, ability_scores, skill_proficiencies, tool_proficiency, origin_feat_id, equipment, gold_alternative, description)
    VALUES (@id, @name, @abilityScores, @skillProficiencies, @toolProficiency, @originFeatId, @equipment, @goldAlternative, @description)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, ability_scores=excluded.ability_scores, skill_proficiencies=excluded.skill_proficiencies,
      tool_proficiency=excluded.tool_proficiency, origin_feat_id=excluded.origin_feat_id,
      equipment=excluded.equipment, gold_alternative=excluded.gold_alternative, description=excluded.description
  `);
  for (const b of BACKGROUNDS) {
    insertBackground.run({
      id: b.id,
      name: b.name,
      abilityScores: JSON.stringify(b.abilityScores),
      skillProficiencies: JSON.stringify(b.skillProficiencies),
      toolProficiency: b.toolProficiency,
      originFeatId: b.originFeatId,
      equipment: JSON.stringify(b.equipment),
      goldAlternative: b.goldAlternative,
      description: b.description,
    });
  }

  const insertSpell = db.prepare(`
    INSERT INTO spells (id, name, level, school, casting_time, range, components, duration, concentration, ritual, classes, description)
    VALUES (@id, @name, @level, @school, @castingTime, @range, @components, @duration, @concentration, @ritual, @classes, @description)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, level=excluded.level, school=excluded.school, casting_time=excluded.casting_time,
      range=excluded.range, components=excluded.components, duration=excluded.duration,
      concentration=excluded.concentration, ritual=excluded.ritual, classes=excluded.classes, description=excluded.description
  `);
  for (const s of SPELLS) {
    insertSpell.run({
      id: s.id,
      name: s.name,
      level: s.level,
      school: s.school,
      castingTime: s.castingTime,
      range: s.range,
      components: JSON.stringify(s.components),
      duration: s.duration,
      concentration: s.concentration ? 1 : 0,
      ritual: s.ritual ? 1 : 0,
      classes: JSON.stringify(s.classes),
      description: s.description,
    });
  }

  const insertMonster = db.prepare(`
    INSERT INTO monsters (
      id, name, size, type, alignment, ac, hp, hit_dice, speed, abilities,
      saving_throws, skills, resistances, immunities, senses, languages, cr, xp, traits, actions
    ) VALUES (
      @id, @name, @size, @type, @alignment, @ac, @hp, @hitDice, @speed, @abilities,
      @savingThrows, @skills, @resistances, @immunities, @senses, @languages, @cr, @xp, @traits, @actions
    )
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, size=excluded.size, type=excluded.type, alignment=excluded.alignment,
      ac=excluded.ac, hp=excluded.hp, hit_dice=excluded.hit_dice, speed=excluded.speed,
      abilities=excluded.abilities, saving_throws=excluded.saving_throws, skills=excluded.skills,
      resistances=excluded.resistances, immunities=excluded.immunities, senses=excluded.senses,
      languages=excluded.languages, cr=excluded.cr, xp=excluded.xp, traits=excluded.traits, actions=excluded.actions
  `);
  for (const m of MONSTERS) {
    insertMonster.run({
      id: m.id,
      name: m.name,
      size: m.size,
      type: m.type,
      alignment: m.alignment,
      ac: m.ac,
      hp: m.hp,
      hitDice: m.hitDice,
      speed: JSON.stringify(m.speed),
      abilities: JSON.stringify(m.abilities),
      savingThrows: JSON.stringify(m.savingThrows),
      skills: JSON.stringify(m.skills),
      resistances: JSON.stringify(m.resistances),
      immunities: JSON.stringify(m.immunities),
      senses: m.senses,
      languages: m.languages,
      cr: m.cr,
      xp: m.xp,
      traits: JSON.stringify(m.traits),
      actions: JSON.stringify(m.actions),
    });
  }

  console.log(
    `Seeded SRD content: ${SPECIES.length} species, ${CLASSES.length} classes, ` +
      `${SUBCLASSES.length} subclasses, ${BACKGROUNDS.length} backgrounds, ${FEATS.length} feats, ` +
      `${SPELLS.length} spells, ${EQUIPMENT.length} equipment items, ${MONSTERS.length} monsters.`,
  );
}

async function main() {
  seedSrdContent();
  await seedAdmin();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
