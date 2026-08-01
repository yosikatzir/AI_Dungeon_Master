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
`);

export default db;
