# Family Table

An AI-driven D&D 5e (2024 revised rules) platform where an OpenAI model acts
as Dungeon Master, for private family play. Self-hosted, single Next.js app,
single SQLite file.

This project is being built in phases (see
[`dnd-ai-dm-claude-code-prompt.md`](dnd-ai-dm-claude-code-prompt.md) for the
full spec). **Phase 1 (foundation: app shell, database, auth) is done.**
Later phases — rules data, character builder, campaigns, the AI DM, voice,
images — are not yet implemented.

## Tech stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- SQLite via `better-sqlite3`, single file at `./data/app.db`
- Auth: bcrypt-hashed passwords (via `bcryptjs`), session cookie via
  `iron-session`
- `zod` for input validation
- Socket.IO, OpenAI SDK — wired in starting Phase 3/5

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

   Then fill in:
   - `OPENAI_API_KEY` — your OpenAI API key. Server-side only, never sent to
     the client.
   - `SESSION_SECRET` — a random string, 32+ characters. Generate one with:

     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

3. Seed the database. This creates `./data/app.db` and bootstraps the admin
   account (username `yosikatzir`):

   ```bash
   npm run seed
   ```

   By default it generates a random password and prints it once — save it.
   To set a specific password instead:

   ```bash
   ADMIN_PASSWORD=your-password npm run seed
   ```

   Admin status is determined purely by username, so registering an account
   named `yosikatzir` through the app also makes it an admin — seeding is
   just a convenience for automated setup.

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`, register an account (or log in as the
   seeded admin), and you should land on the home page.

## Running in production

```bash
npm run build
npm start
```

Same single SQLite file and `./data/images/` directory; no separate build
output for the database.

## Tests

```bash
npm test
```

Unit tests (via `vitest`) cover pure logic — currently input validation; the
5e rules math lands in Phase 2.

## How sessions & campaign memory will work

Not yet implemented (Phase 5). The design: each DM request is assembled from
a system prompt, a structured campaign-state block, a rolling summary, an
NPC roster, and the last ~30 messages — never the full history. Every ~40
messages, a background call folds older messages into the summary. See the
spec doc for details.

## Moving to AWS later

Not yet relevant at this phase, but the plan:

- Move `./data/app.db` to a persistent EBS-backed path (SQLite is a single
  file, so this is a straight copy).
- Move `./data/images/` to S3 (or keep on EBS) and update the image storage
  module's base path/URL signing accordingly.
- Run the Next.js server behind a reverse proxy (nginx or an ALB) with TLS
  terminated there; `npm run build && npm start` works unchanged.
- Set `OPENAI_API_KEY` and `SESSION_SECRET` as real environment variables
  (e.g. via SSM Parameter Store) instead of `.env.local`.
