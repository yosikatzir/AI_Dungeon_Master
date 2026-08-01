import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import db from "../lib/db";
import { ADMIN_USERNAME } from "../lib/config";

// SRD 5.2 rules data (classes, species, spells, equipment, monsters) is
// seeded here starting in Phase 2. For now this only bootstraps the admin
// account so `npm run seed` is usable from Phase 1 onward.
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

async function main() {
  await seedAdmin();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
