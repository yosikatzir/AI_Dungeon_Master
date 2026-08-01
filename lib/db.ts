import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "images"), { recursive: true });

declare global {
  // eslint-disable-next-line no-var -- `var` is required for global augmentation
  var __familyTableDb: Database.Database | undefined;
}

// Reuse a single connection across Next.js dev-server hot reloads instead of
// opening a new one on every module reload.
const db = globalThis.__familyTableDb ?? new Database(DB_PATH);
if (process.env.NODE_ENV !== "production") {
  globalThis.__familyTableDb = db;
}

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
// Wait for locks instead of throwing SQLITE_BUSY immediately — several
// server processes (dev/build workers, later prod) open this same file.
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- SRD 5.2 reference data. Seeded once by scripts/seed.ts; read-only at
  -- runtime. JSON columns hold the sub-structures from lib/rules/types.ts.
  CREATE TABLE IF NOT EXISTS species (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size TEXT NOT NULL,
    speed INTEGER NOT NULL,
    traits TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hit_die INTEGER NOT NULL,
    primary_abilities TEXT NOT NULL,
    saving_throws TEXT NOT NULL,
    armor_proficiencies TEXT NOT NULL,
    weapon_proficiencies TEXT NOT NULL,
    tool_proficiencies TEXT NOT NULL,
    skill_choice_count INTEGER NOT NULL,
    skill_choices TEXT NOT NULL,
    starting_equipment TEXT NOT NULL,
    spellcasting_ability TEXT,
    spellcasting_type TEXT NOT NULL,
    cantrips_known_at_level1 INTEGER NOT NULL,
    spells_prepared_or_known_at_level1 TEXT NOT NULL,
    has_fighting_style_at_level1 INTEGER NOT NULL,
    extra_asi_levels TEXT NOT NULL,
    subclass_level INTEGER NOT NULL,
    level1_features TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subclasses (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    features TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS backgrounds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ability_scores TEXT NOT NULL,
    skill_proficiencies TEXT NOT NULL,
    tool_proficiency TEXT,
    origin_feat_id TEXT NOT NULL REFERENCES feats(id),
    equipment TEXT NOT NULL,
    gold_alternative REAL NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    prerequisite TEXT,
    benefits TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS spells (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    school TEXT NOT NULL,
    casting_time TEXT NOT NULL,
    range TEXT NOT NULL,
    components TEXT NOT NULL,
    duration TEXT NOT NULL,
    concentration INTEGER NOT NULL,
    ritual INTEGER NOT NULL,
    classes TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    cost_gp REAL NOT NULL,
    weight REAL NOT NULL,
    weapon TEXT,
    armor TEXT,
    pack TEXT,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS monsters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size TEXT NOT NULL,
    type TEXT NOT NULL,
    alignment TEXT NOT NULL,
    ac INTEGER NOT NULL,
    hp INTEGER NOT NULL,
    hit_dice TEXT NOT NULL,
    speed TEXT NOT NULL,
    abilities TEXT NOT NULL,
    saving_throws TEXT NOT NULL,
    skills TEXT NOT NULL,
    resistances TEXT NOT NULL,
    immunities TEXT NOT NULL,
    senses TEXT NOT NULL,
    languages TEXT NOT NULL,
    cr TEXT NOT NULL,
    xp INTEGER NOT NULL,
    traits TEXT NOT NULL,
    actions TEXT NOT NULL
  );

  -- Player data.
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    species_id TEXT NOT NULL REFERENCES species(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    subclass_id TEXT REFERENCES subclasses(id),
    background_id TEXT NOT NULL REFERENCES backgrounds(id),
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    alignment TEXT,
    strength INTEGER NOT NULL,
    dexterity INTEGER NOT NULL,
    constitution INTEGER NOT NULL,
    intelligence INTEGER NOT NULL,
    wisdom INTEGER NOT NULL,
    charisma INTEGER NOT NULL,
    hp_current INTEGER NOT NULL,
    temp_hp INTEGER NOT NULL DEFAULT 0,
    hit_dice_used INTEGER NOT NULL DEFAULT 0,
    inspiration INTEGER NOT NULL DEFAULT 0,
    skill_proficiencies TEXT NOT NULL DEFAULT '[]',
    other_proficiencies TEXT NOT NULL DEFAULT '[]',
    feats TEXT NOT NULL DEFAULT '[]',
    cantrips_known TEXT NOT NULL DEFAULT '[]',
    spells_known TEXT NOT NULL DEFAULT '[]',
    spell_slots_used TEXT NOT NULL DEFAULT '{}',
    class_choices TEXT NOT NULL DEFAULT '{}',
    conditions TEXT NOT NULL DEFAULT '[]',
    portrait_path TEXT,
    appearance TEXT,
    backstory TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS character_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id TEXT NOT NULL REFERENCES equipment(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    equipped INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
  CREATE INDEX IF NOT EXISTS idx_character_items_character ON character_items(character_id);
`);

export default db;
