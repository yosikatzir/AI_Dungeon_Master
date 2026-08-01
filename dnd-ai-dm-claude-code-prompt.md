# Claude Code Prompt — "Family Table" AI Dungeon Master Website

Copy everything below this line into Claude Code.

---

Build a complete, self-hosted web application called **Family Table**: an AI-driven D&D 5e (2024 revised rules) platform where an OpenAI model acts as the Dungeon Master. It is for private family use (a parent and kids), not commercial. Work in phases as described at the end, verifying each phase runs before moving to the next.

## Tech stack (use exactly this)

- **Next.js 14+ (App Router), TypeScript, Tailwind CSS** — single full-stack app.
- **SQLite** via `better-sqlite3` (or Prisma with SQLite provider — your choice, but keep it a single file DB at `./data/app.db`).
- **Socket.IO** (or Next.js-compatible websockets) for real-time shared sessions.
- **OpenAI API** for ALL AI features. Read the key from `OPENAI_API_KEY` in `.env.local`. Never hardcode it, never expose it to the client — all OpenAI calls happen server-side.
  - DM brain: a current GPT chat model with function/tool calling and streaming (make the model name a single constant in one config file so it's trivial to upgrade).
  - Voice input: Whisper transcription endpoint.
  - Images: OpenAI image generation (gpt-image-1), including image-edit/reference input for character consistency.
- Local filesystem storage for generated and uploaded images under `./data/images/`, served through an authenticated API route (not the public folder).
- Runs with `npm run dev` on a MacBook; also document how to run it with `npm run build && npm start` so it can later be moved to AWS. No Docker required.

## Core architecture principles (important — follow these)

1. **The server is the single source of truth.** All game state (HP, spell slots, inventory, XP, conditions, dice results) lives in SQLite and is mutated only by server-side game-engine functions. The client only renders state and sends intents.
2. **The AI DM interacts with the game through tool calls, never free text.** Define an OpenAI tools schema the DM must use for anything mechanical: `request_roll`, `apply_damage`, `apply_healing`, `consume_spell_slot`, `grant_item`, `remove_item`, `award_xp`, `apply_condition`, `remove_condition`, `advance_scene`, `update_npc`, `log_plot_event`, `request_image_confirmation`. The narrative text is the DM's voice; the tools are its hands. The engine validates every tool call against 5e rules (e.g., refuses to consume a spell slot the character doesn't have) and returns the result to the model, which then narrates the outcome.
3. **Rules are enforced by the engine, combat is theater-of-the-mind.** No battle grid or token movement. Combat flow: DM narrates → DM calls `request_roll` (specifying die, ability/skill/attack, DC or AC, and which character) → the player clicks their animated die → server rolls, applies modifiers, resolves → DM receives structured result and narrates. Initiative: the engine rolls and tracks turn order internally and displays it as a simple ordered list; the DM prompts whoever's turn it is.
4. **Deterministic rules data.** Ship the 5e SRD 5.2 content (Creative Commons, based on the 2024 revised rules) as seeded JSON/DB data: classes, subclasses, species, backgrounds, feats, all SRD spells with full details, weapons, armor, adventuring gear, and monster stat blocks. Do not have the AI improvise core rules numbers — the engine looks them up. The DM may invent story content freely, but mechanical values come from data.
5. **Context management for long campaigns.** Never send full chat history to the model. Each DM request is assembled from: (a) the DM system prompt, (b) a structured campaign-state block (JSON: party members with current stats, location, active quests, initiative if in combat), (c) the rolling campaign summary, (d) the NPC roster (name, one-line description, disposition, portrait-image id if any), (e) the last ~30 messages verbatim. After every ~40 messages, run a background summarization call that folds older messages into the rolling summary and updates the NPC roster and plot-event log. This is what makes the DM "remember everything" across months.

## Feature requirements

### 1. Authentication & users
- Username + password login (bcrypt-hashed, session cookie via iron-session or next-auth credentials provider). Registration page for creating family accounts.
- The username **`yosikatzir`** is the system admin. Admin status is determined server-side by username; there is an admin-only settings area.

### 2. Character builder (2024 revised rules, SRD 5.2 content)
- Full guided builder: species → class → background → ability scores (point buy, standard array, or manual) → skills → equipment (class/background packages plus manual shopping with starting gold) → spells for casters (respecting spells-known/prepared rules and slot tables) → details (name, alignment, appearance, backstory).
- Enforce all legal constraints (prerequisites, spell lists per class, armor/weapon proficiencies, ability score caps). Support leveling up through the same guided flow, including subclass selection at the right level, ASI/feat choices, and new spells.
- The full character sheet view: all stats, saves, skills with proficiency, AC, initiative, speed, HP/temp HP, hit dice, spell slots, attacks with computed to-hit/damage, inventory with weights, features & traits. Derived values are always computed by the engine, never stored redundantly where they could drift.
- **Portrait upload**: each character can have an uploaded image. Store it, show it on the sheet and in the party panel, and register it in the image registry (below) as that character's canonical visual reference.
- Characters belong to a user, are saved independently of campaigns, and can be enrolled in any campaign.

### 3. Campaigns
- Create a new campaign: choose "Surprise me" (DM invents everything) or provide guidelines (freeform text: theme, setting, tone, party level, anything). The DM generates a campaign premise, opening scene, and title, then play begins.
- Continue an existing campaign from its exact saved state at any time.
- **Drop-in/drop-out is first-class**: a campaign has an enrolled-characters list. Players can join an ongoing campaign (the DM is informed via a system message and weaves them in), leave permanently (DM writes them out), or simply be offline for a session — the DM is told which enrolled characters are "present" this session and only addresses those; absent characters are quietly "off-screen." Single-player campaigns are fully supported — the DM adjusts encounter difficulty to party size, and the engine passes current party size in the state block.
- Real-time shared sessions: all connected players of a campaign see the same chat stream live (websockets). Show who's online. Any present player can act; the DM manages spotlight naturally and enforces turn order only during combat.

### 4. Play interface (this is where immersion lives — put real care here)
- Layout: main chat/narration column in the center; collapsible right panel with YOUR character (stats, HP bar, spell slots as pips, conditions, quick-roll buttons for checks/saves); collapsible left panel with party overview, initiative tracker (in combat), scene image, and campaign log.
- **DM narration must stream token-by-token** into the chat with a subtle typing indicator — waiting for a full response kills the mood. Style DM text distinctly (serif font, parchment-tinted card); player messages and system/mechanics messages (rolls, damage, level-ups) each get their own distinct visual treatment so the log reads like a play session, not a chat app.
- Players can edit their own mutable fields (current HP, notes, inventory tweaks) through the panel; every edit is validated and logged as a system message so the DM's next context includes it.
- **Voice input**: hold-to-record microphone button. Audio is sent to the server, transcribed with Whisper, shown to the player for a 3-second editable confirmation, then posted as their message. Text input always available.
- **Dice**: a dice tray with d4/d6/d8/d10/d12/d20/d100. Rolling shows a simple, satisfying 2D animation (CSS/SVG tumble, ~1s) before revealing the result with modifiers itemized (e.g., "d20: 14 + DEX 3 + Prof 2 = 19 vs DC 15 — Success!"). When the DM requests a roll, that player's tray highlights the needed die with a "Roll for it!" prompt.
- **Secret dice bias (admin only)**: in the admin area, `yosikatzir` can set a per-character bias (e.g., +2 to raw d20 rolls, or "advantage-weighted"). Implement it strictly server-side inside the roll function; the displayed raw die value is the post-bias value so it is indistinguishable from luck. The bias must never appear in any API response, client code, websocket payload, or player-visible log. Only the admin settings endpoint (admin-authenticated) can read or write it.

### 5. AI DM behavior (craft the system prompt with care — this determines the whole experience)
Write the DM system prompt as its own well-organized file (`prompts/dm-system.ts`) with these directives, expressed properly:
- You are a warm, skilled Dungeon Master running D&D 5e (2024 rules). Standard D&D tone.
- Narrate vividly but concisely — 2 to 4 short paragraphs per beat, then hand agency back to the players. Always end with a hook or an open question ("What do you do?"). Never railroad; adapt to whatever the players try.
- Give every NPC a distinct voice and mannerism. Use the players' character names constantly.
- Never roll dice yourself and never invent roll results — always use `request_roll` and wait. Never change HP, items, slots, or XP in prose — always use the tools. If a player claims something mechanical ("I take a potion"), verify via tools.
- Respect the fiction's continuity: consult the campaign summary, NPC roster, and plot log you are given; contradictions break the players' trust.
- Manage spotlight fairly among present players; in single-player sessions, give the lone hero a companion NPC only if it serves the story.
- Handle the absurd gracefully — kids will test you; be playful, keep the story moving, let consequences (not refusals) teach.
- Award XP at natural milestones via `award_xp`; the engine announces level-ups and the player levels up in the builder.

### 6. Image generation (on request only)
- Images are generated **only when a player explicitly asks** (a "🎨 Illustrate this" button next to the input, or a natural-language request the DM recognizes — in which case the DM calls `request_image_confirmation` and the requesting player confirms with one click before any generation happens). The DM never generates images spontaneously.
- **Fixed art style** applied to every prompt: define one style constant, e.g. "classic fantasy oil-painting illustration in the style of vintage tabletop RPG rulebook art, rich colors, dramatic lighting, painterly detail" — appended to all image prompts for maps, scenes, portraits.
- **Consistency via an image registry**: a DB table of every image (uploaded portraits and generated art) with: subject tags (character ids, NPC names, location names), the full prompt used, file path, and timestamp. When generating a scene containing a character who has a portrait, pass that portrait as a reference image to the image-edit/reference endpoint and instruct: "the character X must match the appearance in the reference image." When re-depicting an NPC or location that has prior art, pass the prior image as reference. When a new NPC/location is first depicted, register the result as its canonical reference. Store the visual description the model used in the NPC roster so text descriptions stay consistent too.
- Maps are the same pipeline with map-flavored prompt scaffolding ("hand-drawn fantasy map, parchment, labeled locations, compass rose") — decorative/narrative maps, not tactical grids.
- Show generated images inline in the chat and in a campaign gallery; clicking opens full-size.

## Engineering quality bar

- TypeScript strict mode; zod validation on every API input.
- All 5e math (modifiers, proficiency by level, spell slot tables, encumbrance) in pure, unit-tested functions under `lib/rules/` — write tests for these with vitest (ability modifiers, point-buy validation, slot tables for at least 3 classes, attack roll resolution, and the dice-bias function).
- Graceful OpenAI error handling everywhere: timeouts, rate limits, content-policy rejections on images → user-friendly retry messages in chat, never a crashed session. All OpenAI calls in one `lib/ai/` module with retry-with-backoff.
- Seed script: `npm run seed` loads all SRD 5.2 data and creates the admin account `yosikatzir` (prompt for password on first run or read from env).
- A `README.md` covering: setup, env vars, seeding, running locally, how sessions/campaign memory work, and a short "moving to AWS later" section (swap SQLite file location, put images on EBS/S3, run behind a reverse proxy).
- Mobile-friendly: kids may join from tablets/phones — panels collapse into tabs on small screens; the mic and dice buttons must be thumb-sized.

## Build in phases — verify each phase runs before continuing

1. **Foundation**: Next.js app, SQLite schema, auth, user registration, admin flag. Verify: register, log in, log out.
2. **Rules data + character builder**: seed SRD 5.2, full builder, character sheet, portrait upload, level-up flow. Verify: build a level-1 wizard and a level-1 fighter legally end-to-end; unit tests pass.
3. **Campaign shell + realtime**: campaign CRUD, enrollment, websocket session room, chat (text), presence, drop-in/out. Verify: two browser windows chat live in one campaign.
4. **Game engine + dice**: roll system with animation, modifiers, admin bias, all engine mutation functions with validation, editable stats panel. Verify: rolls resolve correctly; bias applies invisibly; HP/slots update live for all clients.
5. **The AI DM**: system prompt, tool schemas, context assembly, streaming narration, summarization loop, campaign creation (random + guided). Verify: play a 20-message session including a skill check and a short combat; then simulate 50+ messages and confirm the summary/NPC roster update and the DM recalls an early detail.
6. **Voice + images**: Whisper flow with confirm-before-send; image request buttons, registry, reference-image consistency pipeline, gallery. Verify: voice message round-trip; generate a scene containing a character with an uploaded portrait and confirm the reference is passed.
7. **Polish**: DM/player/system message styling, dark fantasy theme, mobile layout, empty states, the admin area. Verify: full play session on a laptop and a phone simultaneously.

Start with Phase 1. After each phase, summarize what was built, how you verified it, and any deviations from this spec — then continue.
