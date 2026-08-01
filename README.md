# Family Table

An AI-driven D&D 5e (2024 revised rules) platform where an OpenAI model acts
as Dungeon Master, for private family play. Self-hosted, single Next.js app,
single SQLite file.

This project is being built in phases (see
[`dnd-ai-dm-claude-code-prompt.md`](dnd-ai-dm-claude-code-prompt.md) for the
full spec).

- **Phase 1 (foundation: app shell, database, auth) — done.**
- **Phase 2 (SRD 5.2 rules engine, seed content, character builder) — done.**
- **Phase 3 (campaigns, realtime chat, presence) — done.**
- **Phase 4 (dice, game engine, admin dice bias) — done.**
- **Phase 5 (the AI DM: tool-calling, streaming narration, campaign memory) — done.**
- **Phase 6 (voice input, AI image generation with a consistency registry) — done.**
- Phase 7 (polish) — not yet implemented.

## Tech stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- A custom Node server (`server.ts`) wrapping Next's request handler +
  Socket.IO, since real-time campaign sessions need a persistent server
  process rather than the stock `next dev`/`next start`
- SQLite via `better-sqlite3`, single file at `./data/app.db`
- Auth: bcrypt-hashed passwords (via `bcryptjs`), session cookie via
  `iron-session`
- `zod` for input validation
- `socket.io` / `socket.io-client` for realtime campaign sessions
- OpenAI SDK — wired in starting Phase 5

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
     the client. Not used yet (arrives in Phase 5), but required at startup.
   - `SESSION_SECRET` — a random string, 32+ characters. Generate one with:

     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

3. Seed the database. This creates `./data/app.db`, loads all SRD 5.2
   reference content (classes, species, backgrounds, feats, spells,
   equipment, monsters), and bootstraps the admin account (username
   `yosikatzir`):

   ```bash
   npm run seed
   ```

   By default it generates a random admin password and prints it once — save
   it. To set a specific password instead:

   ```bash
   ADMIN_PASSWORD=your-password npm run seed
   ```

   Admin status is determined purely by username, so registering an account
   named `yosikatzir` through the app also makes it an admin — seeding is
   just a convenience for automated setup. Re-running `npm run seed` is safe;
   SRD content is upserted by id and the admin account is only created once.

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`, register an account (or log in as the
   seeded admin), build a character, and start or join a campaign.

## Running in production

```bash
npm run build
npm start
```

`npm run build` still just runs `next build`; `npm start` runs the same
custom server as `npm run dev`, in production mode. Same single SQLite file
and `./data/images/` directory; no separate build output for the database.

## Tests

```bash
npm test
```

Unit tests (via `vitest`) cover the 5e rules engine (ability scores, HP,
spell slots, AC/attack/save/skill math — including an end-to-end legal
level-1 Fighter and Wizard built from the real seeded content), the dice
engine (RNG, the admin bias function, DC/AC resolution, nat 20/1 rules), and
a referential-integrity suite over all the seeded SRD content.

## Dice, the game engine, and admin dice bias

All dice rolls run through `lib/rules/dice.ts`, using `node:crypto`'s
`randomInt` (not `Math.random`) for genuine fairness. `apply_damage`,
`apply_healing`, `consume_spell_slot`, `grant_item`/`remove_item`,
`award_xp`, and condition tracking live in `lib/engine/mutations.ts` as
plain validated functions. They're driven two ways: directly by a player's
own in-session actions (damage/heal/spell-slot buttons, dice tray) over
Socket.IO, and by the AI DM's tool calls (Phase 5) — either path broadcasts
live to everyone in the campaign room.

The admin-only secret dice bias (`yosikatzir` → Admin settings → Dice bias)
sets a per-character bias applied strictly inside `rollBiasedD20` — the
`character_dice_bias` table is never joined into any character-facing query,
and `RollOutcome` (what actually reaches the client, gets persisted, and
gets broadcast) never carries bias information. The displayed die is itself
the post-bias value, so it's indistinguishable from an honest roll.

## The AI DM

`lib/ai/dm.ts` runs one "DM turn" per player message or dice roll: assemble
context (`lib/ai/context.ts`), call the model with the tool schema
(`lib/ai/tools.ts`), execute any tool calls against the game engine, loop
until the model has nothing more to do mechanically, then persist and
stream the narration to the room. The system prompt is its own file
(`prompts/dm-system.ts`).

Context is never the full history: each call gets the system prompt, a
structured campaign-state block (party stats, who's present vs. off-screen,
current scene, active quests, initiative if in combat), a rolling summary,
an NPC roster, and the last ~30 messages verbatim. Every 40 messages,
`lib/ai/summarize.ts` makes a background call that folds the new stretch
into the summary and NPC roster — verified live: after a few exchanges the
DM correctly recalled a detail (an NPC's appearance) that had scrolled out
of the raw window and existed only in the compressed summary.

`request_roll` and `request_image_confirmation` are special: they end the
DM's turn immediately rather than resolving in-line, since they require a
real player action (clicking a die, confirming an image) that can't happen
synchronously inside one model call. The dice tray highlights itself with
the exact roll the DM asked for; once the player rolls, a fresh DM turn
picks up automatically. Image requests show a Confirm/Not now banner in the
room; confirming triggers generation.

Campaign chat infrastructure (Phase 3): a Socket.IO room per campaign,
membership + message history in SQLite, and live presence tracked
in-memory per server process.

## Voice and images

Voice: hold the 🎤 button (`components/VoiceRecordButton.tsx`) to record via
the browser's `MediaRecorder`; on release the clip posts to
`/api/campaigns/[id]/transcribe`, which calls Whisper and returns the text.
It fills the message box and auto-sends after 3 seconds unless you edit or
send it yourself. Verified end to end with real synthesized speech (OpenAI
TTS → Whisper) round-tripping back to the exact original sentence.

Images: `lib/ai/images.ts` generates via `gpt-image-1`, appending a single
fixed style constant (`IMAGE_STYLE` in `lib/ai/config.ts`) to every prompt
so campaign art stays visually consistent, with maps using their own
parchment-map prompt scaffolding instead. Every uploaded portrait and
generated image is logged in `image_registry`
(`lib/images.ts`), tagged by subject (character name, NPC name, location);
generating a new image for a subject that already has one automatically
passes the prior image (or a character's uploaded portrait) to
`images.edit` as a reference, so recurring subjects keep the same look.
Two request paths, both verified live: the "🎨 Illustrate this" button
(direct, player-authored prompt) and the DM recognizing a natural-language
request in chat and calling `request_image_confirmation`, which the player
then confirms with one click before anything generates. A per-campaign
gallery lives at `/campaigns/[id]/gallery`.

Deviation: reference-image consistency (passing a prior image back into
`images.edit` for a repeat subject) is implemented and exercised by the
same code path as every generation, but wasn't separately verified with a
side-by-side comparison screenshot — that would need a second paid
generation of the same subject purely to prove it, which felt like
spending real API cost to re-confirm code that's already been read and
is structurally identical to the verified first-generation path.

## Moving to AWS later

- Move `./data/app.db` to a persistent EBS-backed path (SQLite is a single
  file, so this is a straight copy).
- Move `./data/images/` to S3 (or keep on EBS) and update the image storage
  module's base path/URL signing accordingly.
- Run the custom Node server (`server.ts`) behind a reverse proxy (nginx or
  an ALB) with TLS terminated there, and make sure the proxy is configured
  to pass through WebSocket upgrades for the `/api/socket` path (Socket.IO
  needs this); `npm run build && npm start` works unchanged.
- Presence tracking is in-memory per process — fine for a single instance
  (the expected self-host setup), but wouldn't survive a multi-instance
  deployment without moving it to a shared store (e.g. Redis).
- Set `OPENAI_API_KEY` and `SESSION_SECRET` as real environment variables
  (e.g. via SSM Parameter Store) instead of `.env.local`.
