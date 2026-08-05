# Family Table

An AI-driven D&D 5e (2024 revised rules) platform where an AI model acts
as Dungeon Master, for private family play. Self-hosted, single Next.js app,
single SQLite file. Chat/summarization run on Amazon Bedrock (Claude); image
generation stays on OpenAI's `gpt-image-1` (no viable Bedrock replacement
exists yet — see "The AI DM" below).

This project is being built in phases (see
[`dnd-ai-dm-claude-code-prompt.md`](dnd-ai-dm-claude-code-prompt.md) for the
full spec).

- **Phase 1 (foundation: app shell, database, auth) — done.**
- **Phase 2 (SRD 5.2 rules engine, seed content, character builder) — done.**
- **Phase 3 (campaigns, realtime chat, presence) — done.**
- **Phase 4 (dice, game engine, admin dice bias) — done.**
- **Phase 5 (the AI DM: tool-calling, streaming narration, campaign memory) — done.**
- **Phase 6 (voice input, AI image generation with a consistency registry) — done.**
- **Phase 7 (polish: mobile layout, message styling, empty states) — done.**
- **Phase 8 (character management, DM appearance awareness, table-talk channel, multi-reference images) — done.**

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
- `@aws-sdk/client-bedrock-runtime` for the DM/summarizer (Claude via
  Bedrock's Converse API), `@aws-sdk/client-transcribe` + `@aws-sdk/client-s3`
  for voice input (Amazon Transcribe) — credentials come from the standard
  AWS SDK provider chain (EC2 instance role in production, `AWS_PROFILE`
  locally), no keys in this app
- OpenAI SDK — image generation only (`lib/ai/images.ts`); wired in starting
  Phase 5, chat/STT migrated off it once deployed to AWS (see below)

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
     the client. Required at startup; used only for image generation
     (`lib/ai/images.ts`) — chat/summarization run on Bedrock, voice input on
     Amazon Transcribe.
   - `SESSION_SECRET` — a random string, 32+ characters. Generate one with:

     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - `AWS_REGION` / `AWS_PROFILE` — for local Bedrock/Transcribe/S3 access.
     Both optional (`AWS_REGION` defaults to `us-east-1`; `AWS_PROFILE`
     picks up credentials from `~/.aws` — not needed at all in production,
     where the EC2 instance uses its IAM role automatically).

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
engine (RNG, the admin bias function, DC/AC resolution, nat 20/1 rules), a
referential-integrity suite over all the seeded SRD content, and pure
DM-context/image-composition helpers (appearance formatting, the meta DM's
restricted toolset, reference-image selection, subject name detection).
`vitest.config.ts` loads `.env.local` the same way `server.ts` does, since
some of these transitively import `lib/ai/openai.ts`, which requires
`OPENAI_API_KEY` at import time.

Nothing in the suite touches the real `./data/app.db` beyond opening a
connection and ensuring the schema exists (harmless and idempotent) —
anything that would actually insert/update/delete rows (character
creation, campaign messages, image registration, etc.) is verified live in
the browser instead, since this project has no isolated test-database
setup.

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

## Character management

A character's identity fields — name, alignment, appearance, backstory —
are editable anytime from the character sheet (`CharacterIdentityEditor`);
they don't touch rules math. Changing the build itself (species, class,
background, abilities, skills, spells) is only allowed for a level-1
character with no active campaign membership (`canRebuildCharacter` in
`lib/characters.ts`) — a mid-campaign class swap would break both the
fiction and the mechanics already in play. A rebuild
(`/characters/[id]/edit`) reuses `CharacterBuilder` but starts species
through spells over from scratch: reconstructing the original base scores
and ability-bonus split from the stored final values isn't possible, so a
rebuild is an intentional do-over rather than a pre-filled edit; identity
fields carry over.

Deleting a character (`DeleteCharacterButton`, type-the-name confirm) is a
soft delete — `characters.deleted_at` — so chat history and old roll data
still resolve the character's name correctly. If the character is
currently enrolled in any active campaign, deleting sets that membership to
`'left'` and posts a "has left the party" system message to the room, the
same as a normal drop-out.

## The AI DM

`lib/ai/dm.ts` runs one "DM turn" per player message or dice roll: assemble
context (`lib/ai/context.ts`), call the model with the tool schema
(`lib/ai/tools.ts`), execute any tool calls against the game engine, loop
until the model has nothing more to do mechanically, then persist and
stream the narration to the room. The system prompt is its own file
(`prompts/dm-system.ts`).

**Runs on Bedrock, not OpenAI.** `lib/ai/bedrock.ts` wraps a
`BedrockRuntimeClient`, mirroring the retry/error-mapping shape of the
OpenAI-specific `lib/ai/openai.ts` (still used for images — see below); both
throw a shared `AiError` (`lib/ai/errors.ts`). Two real differences from
OpenAI's Chat Completions API worth knowing if you touch this code: (1)
Bedrock's Converse API has no `role:"system"` message — system content is a
separate top-level `system` array of blocks — and (2) it enforces strict
user/assistant turn alternation and rejects consecutive same-role messages,
which ordinary multiplayer chat (two players speaking back-to-back with no
DM reply between them) triggers easily; `lib/ai/context.ts`'s `coalesceTurns`
folds consecutive same-role turns into one message to handle this. Tool
results are also grouped — all of one turn's tool results go back as a
single message, not one per call like OpenAI's separate `role:"tool"`
messages. `lib/ai/summarize.ts` uses the assistant-message-prefill trick
(seed the reply with `{` so the model continues valid JSON) since Bedrock/
Claude has no `response_format:"json_object"` equivalent.

`DM_MODEL` is `us.anthropic.claude-sonnet-4-6`. An earlier pass ran the DM on
Haiku 4.5, having concluded from `aws bedrock
get-foundation-model-availability` (`agreementAvailability: NOT_AVAILABLE`
for every Sonnet model) that this account had no Sonnet entitlement. That
conclusion was wrong, and the lesson is worth keeping: **that API answers for
the bare foundation model, which is not how these models are invoked at all**
— they require a regional inference profile. A real `converse` call against
`us.anthropic.claude-sonnet-4-6` succeeds. Probe with an actual invocation,
not the availability API. (Sonnet 5 is a genuine gap: its inference profile
returns `AccessDeniedException`.)

The upgrade is not just prose quality. The DM's hard rules — keep narration
short, always roll before narrating an uncertain outcome, stat an NPC before
rolling against it — are instruction-following problems, and Haiku drifted on
all three in live play: four-paragraph replies, and a plain Deception attempt
resolved in prose without ever rolling. Sonnet 4.6 statted an adversary
unprompted (AC, HP, ability scores, Perception) and set the check's DC from
her passive Perception on the first try. `SUMMARIZER_MODEL` stays on Haiku —
summarization is a mechanical task where the cheaper model is fine.

Image generation deliberately stayed on OpenAI's `gpt-image-1`
(`lib/ai/images.ts`, unchanged) — investigated live before migrating and
found no viable Bedrock replacement: Amazon's own image model (Nova Canvas)
is `LEGACY` with access denied for this account and fully retires
2026-09-30 with no successor in the catalog, and Stability AI's active
models on Bedrock are all specialized editing operations (inpaint, outpaint,
upscale, style transfer, etc.), not text-to-image generators.

Context is never the full history: each call gets the system prompt, a
structured campaign-state block (party stats, who's present vs. off-screen,
current scene, active quests, initiative if in combat), a rolling summary,
an NPC roster, and the last ~30 messages verbatim. Every 40 messages,
`lib/ai/summarize.ts` makes a background call that folds the new stretch
into the summary and NPC roster — verified live: after a few exchanges the
DM correctly recalled a detail (an NPC's appearance) that had scrolled out
of the raw window and existed only in the compressed summary.

Each present character's line in the state block (`lib/ai/context.ts`,
`formatPresentCharacterLine`) also carries their background, alignment, and
— when the player filled them in — appearance and a backstory hook (both
truncated so a full party doesn't blow the context budget every turn). The
system prompt tells the DM that NPCs react to what they can see, not just
what a player types. Verified live: an orc with a "towering, imposing"
appearance and an elf with a "delicate, graceful" one approached the same
NPC with the identical line of dialogue in otherwise-identical opening
scenes, and got visibly different reactions grounded in the appearance
text, with neither player describing themselves in chat.

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

### NPC stat blocks and the DM's side of the dice

Player characters have always had real sheets and rolled through the engine,
so their half of any check was ground truth. The other half wasn't: an NPC
was a name, a description and a disposition, which meant "can I sneak past
the guard?" had no guard to be measured against — the DM invented both the
DC and the outcome, and the dice stopped deciding anything.

`lib/npcs.ts` gives NPCs stat blocks. They come from one of two places: an
SRD monster id (the seeded `monsters` table — goblin, wolf, ogre and friends,
which were in the database but unreachable by the DM until now) or scores the
DM writes itself for an original NPC, with explicit `ac`/`hpMax`/`abilities`
overriding the monster's where they differ. Both paths produce the same
shape, and derived numbers (skill bonuses, saving throws, passive Perception
and Insight) are computed from it rather than stated. Every statted NPC's
line appears in the campaign-state block each turn, so the numbers the DM
sets DCs from are in front of it instead of being recalled or improvised.

Three tools follow from that. `update_npc` gained the stat fields.
`roll_npc` (`lib/engine/npcRolls.ts`) rolls the NPC's own d20 — a guard's
Perception, a monster's attack, an ogre's saving throw — through the same
`resolveD20Check` the players use, returning a real result immediately
without ending the DM's turn. Dice bias (`lib/engine/bias.ts`) deliberately
does *not* apply here: that's a per-character luck adjustment meant to keep
kids from having a miserable session, and pointing it at the monsters would
defeat the purpose. `damage_npc`/`heal_npc` track NPC hit points, so a fight
ends when the creature actually runs out rather than when the scene feels
done.

Rolling against a specific creature now has a real target: hiding is set
against that NPC's passive Perception, lying against its passive Insight,
attacking against its AC. The system prompt spells out the sequence — player
declares an action, DM calls `request_roll`, turn ends, player rolls, and
only then does the DM narrate what the die produced — along with which
actions always need a roll, which never should, and the standard DC ladder
for everything without a specific opponent.

One subtlety worth knowing about: the summarizer rewrites the NPC roster
every 40 messages, but it never sees stat blocks and can't return them.
`mergeRosterPreservingStats` merges its rewritten prose over the existing
entries by name, so a summarization pass can't silently strip a wounded
monster back to full health with no AC.

### Table talk (out-of-character channel)

Every campaign has a second, out-of-character channel alongside the story
(`campaign_messages.channel`, `'story' | 'meta'`) — a "Story / Table" toggle
in `CampaignRoom` with an unread badge on whichever one isn't active. Table
talk is for rules questions, planning, or just chatting with the DM without
advancing the plot: plain messages between players never call the model;
only an explicit "Ask the DM" button triggers a meta DM turn.

The meta DM (`buildMetaSystemPrompt` in `prompts/dm-system.ts`) is the same
DM stepping out of character, and can only call one tool —
`log_plot_event` (`META_DM_TOOLS` in `lib/ai/tools.ts`) — so it can make and
remember rulings but can't touch HP, items, XP, or anything else in the
story. A ruling logged this way reaches the story two ways: the plot log is
already injected into every story turn, and the story context additionally
gets the last ~10 meta messages as a tagged "honor any DM rulings made
here" block. Verified live: asked the meta DM (out of character) to rule
that a character already knew an NPC from a past visit; the ruling landed
in the campaign's plot log via `log_plot_event`, and the very next story
message got a reply built on "the warmth of recognition... fond memories of
your last visit" — unprompted, from context alone.

## Voice and images

Voice: hold the 🎤 button (`components/VoiceRecordButton.tsx`) to record via
the browser's `MediaRecorder`; on release the clip posts to
`/api/campaigns/[id]/transcribe`, which now runs on **Amazon Transcribe**
(a separate AWS service from Bedrock) instead of Whisper, and returns the
text in the same `{text}` shape — no frontend changes needed. Transcribe's
`StartTranscriptionJob` API is an async batch job, not a synchronous
call-and-response like Whisper: the route uploads the clip to
`s3://<data-bucket>/transcribe-tmp/`, starts a job, polls
`GetTranscriptionJob` (bounded to ~60s), fetches the result, and always
cleans up the job + S3 object (an S3 lifecycle rule expires anything left
behind after 1 day as a backstop). This is a real latency trade-off accepted
knowingly — noticeably slower than Whisper's near-instant response — in
exchange for staying on AWS-native infra; still fills the message box and
auto-sends after 3 seconds unless you edit or send it yourself. Verified
live end to end with real synthesized speech round-tripping back to
essentially the original sentence, and confirmed the temp S3 object and
Transcribe job are both gone afterward.

Images: `lib/ai/images.ts` generates via `gpt-image-1`, appending a single
fixed style constant (`IMAGE_STYLE` in `lib/ai/config.ts`) to every prompt
so campaign art stays visually consistent, with maps using their own
parchment-map prompt scaffolding instead. Every uploaded portrait and
generated image is logged in `image_registry`
(`lib/images.ts`), tagged by subject (character name, NPC name, location).
Two request paths, both verified live: the "🎨 Illustrate this" button
(direct, player-authored prompt) and the DM recognizing a natural-language
request in chat and calling `request_image_confirmation`, which the player
then confirms with one click before anything generates. A per-campaign
gallery lives at `/campaigns/[id]/gallery`.

**What the 🎨 button illustrates**: the DM composes the image prompt itself
(`composeSceneImagePrompt` in `lib/ai/scenePrompt.ts`). It re-reads the last
`SCENE_PROMPT_MESSAGE_WINDOW` story messages and returns
`{description, characters}` — a purely visual paragraph plus exactly who is
in frame — using the same assistant-prefill JSON trick as the summarizer.
The player's text field stays optional and is passed in as a refinement of
that moment (angle, focus, emphasis), never as the whole prompt.

This replaced an earlier approach that used the campaign's stored
`currentScene` as the prompt, which was wrong in a way that only showed up in
real play: `currentScene` refreshes only when the DM chooses to call its
`advance_scene` tool, which happens far less often than the story actually
moves. A reported case had a bard fighting belowdecks while the illustration
showed him performing for sailors up on deck — faithfully rendering a scene
several beats stale. The recent transcript is the real record of where the
story is, so that is what the illustration is now built from. If the compose
call fails, the old stored-scene path still runs as a fallback rather than
dropping the request.

**Multi-reference composition**: a scene can depict several established
subjects at once — the DM lists everyone actually present in `subjects`
when calling `request_image_confirmation` (its exact party members and NPC
roster names; the 🎨-button path uses the `characters` list the DM returned
when composing the prompt, falling back to `detectSubjectsInText`'s
word-boundary name match against the same candidates). Each named
subject gets its own reference file — an uploaded portrait first, otherwise
the newest registered image tagged with that name (`findReferenceImages` /
`pickBestReferenceImages` in `lib/images.ts`) — capped at 4 references,
present party members prioritized over NPCs/locations. The prompt sent to
`images.edit` includes a manifest ("Reference image 1 shows Kara — Kara in
this scene must match that appearance exactly...") so the model can map
several reference faces to the right names instead of guessing; the
generated image is then registered under every subject's tag, becoming a
future reference for each of them.

Verified live for real (previously only dry-run/unit-test verified to avoid
API cost): two characters enrolled with distinct uploaded portraits, asked
the DM to illustrate both together at the current scene. The DM populated
`subjects` correctly (`["Kara Ironhold","Elowen Brightpage","Elderly
Woman","Starfall Vale Bridge"]`), and after confirming, `gpt-image-1`
produced a real composed scene reflecting all of them. This surfaced a real,
previously-uncaught bug: `toFile()` doesn't infer a MIME type from the
filename, so reference uploads defaulted to `application/octet-stream`,
which `images.edit` rejects outright — `generateImageBuffer` now maps file
extension to an explicit MIME type (`lib/ai/images.ts`), skipping any
reference with an unsupported extension (GIF portraits — not accepted by
`images.edit` at all) rather than guessing.

## Mobile layout and polish

`CampaignRoom` (`components/CampaignRoom.tsx`) is a single three-column flex
layout (party/initiative, chat log + controls, your character) on screens
`md:` and up. Below that breakpoint the columns collapse into a Party / Log /
Character tab bar backed by one `mobileTab` state value, so the whole room
still fits one screen without horizontal scrolling; the "Character" tab only
appears once a character is actually enrolled. Dice tray buttons, the
hold-to-record mic button, the illustrate/send buttons, and the join/enroll
buttons all carry a 44px minimum touch target. Message rendering is
per-`senderType`: DM messages get a labeled parchment card in serif type,
player messages get a bubble (highlighted if it's yours), system messages are
centered italic asides, and roll messages get a colored card (green/red/
purple) based on success, failure, or a plain roll.

Verified live end to end at both a 1280px desktop width and a 375px mobile
viewport against a running campaign (chat, streaming DM narration, a
DM-requested skill check resolved through the dice tray, a damage mutation
logged as a system message and reflected in the HP bar): no console errors,
no horizontal overflow at 375px, and the party/log/character tabs each show
only their own panel on mobile while the three panels sit side by side again
above the `md` breakpoint.

## Running on AWS

Deployed via Terraform in [`infra/`](infra/): a single EC2 instance (`t4g.small`,
Amazon Linux 2023, no Docker — the same `npm run build && npm start` as local),
behind nginx, which handles TLS and proxies everything — including WebSocket
upgrades for `/api/socket` — to the app on `127.0.0.1:3000`. `./data/app.db` and
`./data/images/` live on a separate EBS volume (`/opt/family-table/app/data`)
whose lifecycle is decoupled from the instance, so replacing/resizing the
instance doesn't touch game data. `OPENAI_API_KEY`/`SESSION_SECRET` live in AWS
Secrets Manager and are fetched into `.env.local` on every service start (see
`infra/templates/user_data.sh.tftpl` and `family-table.service`).

No domain is configured yet, so nginx terminates HTTPS with a self-signed
certificate (regenerated only if missing, stored on the persistent data volume).
This isn't cosmetic: the app's session cookie is `Secure`-flagged in production
(`lib/session.ts`), so plain HTTP can never hold a login — browsers silently
refuse to store `Secure` cookies without TLS. Visiting the site shows a one-time
"connection isn't private" warning (click through — Advanced → Proceed); once
there's a real domain, swap in a Let's Encrypt cert via `certbot --nginx`
against `infra/templates/nginx.conf` and remove the self-signed fallback.

Redeploy after pushing code changes:

```bash
./scripts/deploy-aws.sh
```

This is a **single, non-scalable instance by design** — presence tracking is
in-memory per process and the DB is one SQLite file, so there's deliberately no
ASG/multi-instance setup (see `infra/`'s plan notes for the full reasoning).

### Terraform state

State lives in S3 (`s3://family-table-tfstate-287496344353/`), locked via a
DynamoDB table, so `infra/` can be applied or destroyed from any machine with
the `personal` AWS profile — no local state file to carry around. That bucket
and lock table (plus the data-backup bucket below) are created once by
[`infra/bootstrap/`](infra/bootstrap/), which intentionally keeps its own
local state — it creates the bucket `infra/` then stores its state in, so it
can't bootstrap itself into S3. Re-running it is safe but shouldn't be
necessary again for this account.

### Full teardown and redeploy, with data preserved

```bash
./scripts/teardown-aws.sh
```

Destroys every AWS resource `infra/` manages (EC2, EBS, EIP, security group,
IAM role, Secrets Manager secret) — true $0 when off — but first stops the
app cleanly and syncs `app.db`/`images/` to a separate, permanent S3 bucket
(`family-table-data-287496344353`, created by `infra/bootstrap/`, versioned,
never touched by `terraform destroy`). The next `terraform apply` restores
that data onto the fresh EBS volume before the app starts — `npm run seed`
then detects the restored admin account/SRD content and skips re-seeding, so
a redeploy picks up exactly where the teardown left off (verified live: an
admin password set before a real teardown/redeploy cycle still worked
afterward, which a fresh seed's randomly-generated password couldn't have).
The self-signed TLS cert is deliberately excluded from this backup — the
Elastic IP changes on every redeploy, so a stale cert would have the wrong
IP in its SAN; a fresh one is generated on each boot instead.

Since the Secrets Manager secret is destroyed too, `OPENAI_API_KEY` needs to
be re-entered after a teardown — see the deployment runbook above for the
`put-secret-value` command (`SESSION_SECRET` can just be freshly generated
again; nothing depends on it surviving a teardown).

One packaging quirk worth knowing if `infra/templates/user_data.sh.tftpl` is
ever touched: `better-sqlite3`'s bundled prebuilt binary is linked against a
newer glibc than Amazon Linux 2023 ships (`ERR_DLOPEN_FAILED: GLIBC_2.38 not
found`), and the package's own `"gypfile": false` disables npm's usual
automatic node-gyp build. Both `user_data.sh.tftpl` and `scripts/deploy-aws.sh`
work around this by running better-sqlite3's own `build-release` script
directly and deleting the incompatible bundled prebuild so its loader falls
back to the freshly compiled one.
