# Phase 8 Plan — Character Management, Multi-Reference Scene Composition, Table-Talk Channel, Character Presence in DM Context

Implementation plan for four features. Written for handoff; file paths and function
names below refer to the current codebase state (post-Phase 7). Read the referenced
files before starting — the plan leans on existing patterns rather than inventing new ones.

---

## Feature 1: Edit and delete existing characters

### Current state

- `lib/characters.ts` — `createCharacter` (full build validation), `updateCharacter`
  (mutable play fields only: HP, temp HP, hit dice, inspiration, notes, conditions,
  spell slots), `setCharacterPortrait`. No delete, no identity/build editing.
- `app/api/characters/[id]/route.ts` — GET + PATCH (play fields via `updateCharacterSchema`).
- FKs are ON (`lib/db.ts` line 24). `campaign_members.character_id` and
  `campaign_messages.character_id` reference `characters(id)` **without** ON DELETE,
  so a hard `DELETE FROM characters` for any character that ever played will throw.
  `character_items` and `character_dice_bias` do cascade.
- `resolveCharacterInCampaign` (DM tools) resolves characters **by name per turn**,
  so renames are safe — nothing caches names.

### Design decisions

**Delete = soft delete.** Add a `deleted_at TEXT` column to `characters`. Hard delete
would either violate FKs or require ON DELETE rewrites of two tables (SQLite can't
alter FKs in place — full table rebuild), and it would erase names from chat history.
Soft delete keeps history intact (message joins keep working) and is one guarded ALTER.

**Edit is split in two tiers:**

1. **Identity edits (allowed anytime):** name, alignment, appearance, backstory.
   These don't touch rules math. Renames are safe per the note above, but the DM's
   memory (summary, plot log) may reference the old name — post a system message to
   any active campaigns ("Kara Ironhold is now known as …") so the next DM context
   window sees the change.
2. **Build edits (species/class/background/abilities/skills/spells) — only while the
   character has no active campaign membership.** Changing a class mid-campaign
   breaks the fiction and the mechanics (HP, slots, items). Gate server-side: reject
   if any `campaign_members` row with `status='active'` references the character.

**Delete rules:** if the character is enrolled in active campaigns, the confirm dialog
says so; deleting sets those memberships to `status='left'` and posts a system message
per campaign ("X has left the party.") so the DM writes them out — this matches the
existing drop-out flow in the spec. Then set `deleted_at`.

### Implementation steps

1. **DB migration helper.** There's no migration pattern yet. Add a tiny
   `ensureColumn(table, column, ddl)` helper in `lib/db.ts` that checks
   `pragma table_info(table)` and runs `ALTER TABLE … ADD COLUMN` if missing.
   Use it for `characters.deleted_at` (and Feature 3's `campaign_messages.channel`).
2. **`lib/characters.ts`:**
   - Filter `deleted_at IS NULL` in `listCharactersForUser` and
     `listAllCharactersWithOwner`. Leave `getCharacterRecord`/`resolveCharacter`
     returning deleted rows (message-history joins and old roll data still resolve),
     but add an `isDeleted` flag to `CharacterRecord`.
   - `updateCharacterIdentity(id, {name?, alignment?, appearance?, backstory?})`.
   - `rebuildCharacter(id, input: CreateCharacterInput)` — reuse `createCharacter`'s
     validation by extracting its validation+derivation section into a shared
     `validateAndDeriveBuild(input)` helper; rebuild replaces build columns, resets
     `hp_current` to the level-1 formula, deletes and re-inserts `character_items`.
     (Characters above level 1 can't rebuild — check `level === 1`; higher-level
     rebuild would need retroactive level-up logic, out of scope.)
   - `softDeleteCharacter(id)` — transaction: set active memberships to `'left'`,
     collect affected campaign ids, set `deleted_at`. Return the campaign ids so the
     route can post the system messages (messages need the io instance — post via
     `addMessage` + `getIoInstance()` like `lib/ai/dm.ts` does).
3. **Guards:** `requireOwnCharacterInCampaign` in `lib/realtime/socketServer.ts` and
   the join flow (`app/api/campaigns/[id]/join`) must reject deleted characters.
4. **Validation:** new `updateCharacterIdentitySchema` (name 1–60, alignment ≤40,
   appearance ≤2000, backstory ≤4000 — same caps as `createCharacterSchema`).
5. **Routes (`app/api/characters/[id]/route.ts`):**
   - Extend PATCH: accept identity fields alongside play fields (single merged schema,
     or a discriminated `kind` field — merged is simpler).
   - `DELETE` handler → `softDeleteCharacter`, post the leave messages.
   - New `app/api/characters/[id]/rebuild/route.ts` → PUT with `createCharacterSchema`
     body, gated on ownership + no active membership + level 1.
6. **UI:**
   - `app/characters/[id]/page.tsx`: add an "Edit" section (inline form or a small
     client component) for identity fields, and a "Delete character" button with a
     type-the-name confirm (kids share devices — make destruction deliberate).
     Show "Rebuild" only when eligible; it links to the edit page.
   - `app/characters/[id]/edit/page.tsx`: reuse `components/CharacterBuilder.tsx`
     in edit mode — add optional `initialInput` + `submitTarget` props so it PUTs
     to rebuild instead of POSTing to create. The builder is one 666-line component;
     threading two props through is much cheaper than a parallel edit builder.
7. **Tests:** vitest for `softDeleteCharacter` (membership transition, list filtering),
   `rebuildCharacter` (validation reuse, item regeneration), identity update.

---

## Feature 2: Multi-reference image composition (all relevant campaign pictures)

### Current state (`lib/ai/images.ts`, `lib/images.ts`, socket handler `generateAndPostImage`)

- `generateImageBuffer` **already supports multiple reference files** (passes an array
  to `openai.images.edit`). The gap is upstream: callers only ever collect ≤2.
- `generateAndPostImage` (socketServer.ts:401) matches **one** character by substring
  and ignores NPCs/locations entirely.
- `findReferenceImage` returns one image for the whole tag set, isn't campaign-scoped,
  and doesn't prefer uploaded portraits.
- The DM's `request_image_confirmation` tool only passes a `subject` string — the
  model knows exactly who's in the scene but has nowhere to say it.
- Generated scenes register only `[subject.toLowerCase(), maybe one character name]`
  as tags, so chaining is weak.

### Design decisions

**Let the DM declare subjects instead of guessing by substring.** Extend
`request_image_confirmation` with `subjects: string[]` ("exact names of the
characters, NPCs, and locations depicted"). The model already has the party list and
NPC roster in context. Keep substring detection as fallback for the player-direct
🎨 button path (and extend it to also scan the NPC roster, not just members).

**One reference per subject, portraits canonical for PCs.** For each matched subject:
uploaded portrait first (kind `portrait`, spec calls it canonical), else newest
registry image for that tag. Cap total references at 4 (latency/cost; more refs
dilute edit quality). Party members present in the scene get priority over
locations when capping.

**The prompt must map references to subjects.** A bare "match the reference image(s)"
fails with 3+ refs — the model can't tell which face belongs to whom. Build a
manifest: reference order = file order, prompt gets
"Reference image 1 shows Kara Ironhold — Kara in this scene must match that
appearance exactly. Reference image 2 shows the innkeeper Elenor — …".

### Implementation steps

1. **`lib/images.ts`:** replace `findReferenceImage` with
   `findReferenceImages(tags: string[], campaignId: number): Map<tag, RegisteredImage>`
   — per tag: newest `portrait` (any campaign — portraits are registered with
   `campaign_id NULL`), else newest campaign-scoped image whose tags include it.
   Keep the old single-ref function only if grep shows other callers (currently just
   `lib/ai/images.ts`).
2. **`lib/ai/images.ts`:** change `generateCampaignImage` to take
   `subjects: { name: string; characterId?: number }[]` instead of the single
   `characterIdForReference`. Resolve references (character portrait via
   `getCharacterRecord`, else registry via `findReferenceImages`), build the manifest
   prompt, pass the ordered file list, and **register the output with all subject
   tags** (plus the raw subject string) so the scene itself becomes a future reference
   for every participant.
3. **Tool schema (`lib/ai/tools.ts`):** add `subjects` to `request_image_confirmation`;
   thread it through `PendingImageConfirmation` (`lib/campaigns.ts` type + the JSON
   column it serializes to — check `setPendingImageConfirmation`).
4. **Socket handler (`lib/realtime/socketServer.ts`):** `generateAndPostImage` gains an
   optional `subjects` param (from `confirm_image`'s pending request). When absent
   (🎨 button path), detect: all active members whose character name appears in the
   subject text (word-boundary, case-insensitive — current code lowercases but uses
   bare `includes`, which false-positives on short names), plus NPC roster names from
   `getCampaign(campaignId).npcRoster`.
5. **System prompt (`prompts/dm-system.ts`):** one line telling the DM to always list
   everyone depicted in `subjects` when calling `request_image_confirmation`.
6. **Tests:** vitest for `findReferenceImages` (portrait preference, campaign scoping,
   newest-wins) and for the subject-detection helper (extract it as a pure function).
7. **Verification note:** full visual verification costs real image generations. Verify
   the pipeline live once (one scene with an uploaded portrait + one prior NPC image —
   confirm via server logs that both files were passed), and unit-test the reference
   selection logic; don't burn generations proving composition quality repeatedly.

---

## Feature 3: Table-talk (meta) channel wired to the story DM

### Current state

- One message stream. `campaign_messages` has no channel column. Every player message
  triggers `runDmTurn` (socketServer.ts `send_message`), which advances the story.
- DM context (`lib/ai/context.ts`) pulls the last `RECENT_MESSAGE_WINDOW` messages;
  the summarizer (`lib/ai/summarize.ts`) folds everything past a high-water mark.

### Design decisions

**One room, two channels.** Add `channel TEXT NOT NULL DEFAULT 'story'`
(`'story' | 'meta'`) to `campaign_messages` via `ensureColumn`. Same Socket.IO room,
same `new_message` event — clients route by `message.channel`. No second table, no
second socket namespace.

**Meta messages never auto-trigger a story turn.** That's the whole point of the
feature ("talk without progressing the scenario").

**DM participation in meta is explicit, not automatic.** The meta composer gets two
send actions: plain **Send** (players talking to each other — no model call, free) and
**Ask the DM** (posts the message *and* triggers a meta DM turn). Auto-triggering on
every meta message would burn tokens on sibling chatter and make the DM feel
omnipresent in what's supposed to be the players' space; keyword detection ("@dm") is
fragile for kids. An explicit button is predictable and cheap.

**Rulings flow into the story through two channels:**

1. The meta DM gets exactly one tool: `log_plot_event`, with meta-prompt instruction
   to record any ruling/permission it grants as `"Table ruling: …"`. Plot log is
   already injected into every story context — durable, survives summarization.
2. The story context additionally gets the last ~10 meta messages as a tagged block
   (`TABLE TALK (out-of-character — honor any DM rulings made here):`) so recent
   informal agreements are visible even if the meta DM forgot to log them.

This satisfies "if the DM allowed something in the meta window, it's reflected in the
story window" without letting the meta DM mutate game state (no damage/items/XP tools
out-of-character).

### Implementation steps

1. **DB:** `ensureColumn` for `campaign_messages.channel` (default `'story'` covers all
   existing rows correctly).
2. **`lib/campaigns.ts`:**
   - `CampaignMessage` gains `channel: "story" | "meta"`.
   - `addMessage` takes `channel` (default `'story'` so all existing call sites —
     rolls, system messages, DM narration — stay untouched).
   - `listRecentMessages(campaignId, limit, channel = 'story')` and a small
     `listRecentMetaMessages`; `listMessagesAfter` filters `channel='story'` so the
     summarizer never folds table talk.
3. **Validation:** `sendMessageSchema` gains `channel: z.enum(["story","meta"]).default("story")`
   and `askDm: z.boolean().default(false)` (only meaningful for meta).
4. **Socket (`send_message` handler):** store channel; trigger `runDmTurn` only for
   story messages; for meta with `askDm`, trigger `runDmTurn(campaignId, { channel: "meta" })`.
5. **`lib/ai/dm.ts` + `lib/ai/context.ts`:**
   - `DmContextOptions` gains `channel?: "story" | "meta"`.
   - Meta turns: system prompt is a short out-of-character variant (add
     `buildMetaSystemPrompt()` to `prompts/dm-system.ts` — friendly table voice,
     answer rules questions, make rulings, keep it brief, `log_plot_event` for any
     ruling), tools = `[log_plot_event]` only, recent window = meta messages, and the
     resulting DM message is stored with `channel: 'meta'`.
   - Story turns: after the existing recent-story window, append the tagged table-talk
     block (last ~10 meta messages) described above.
   - `streamNarration`/`dm_stream_start`: include `channel` in the payload so the
     client renders the stream in the right pane.
   - `maybeSummarize` stays story-only (already handled by step 2's filter).
6. **UI (`components/CampaignRoom.tsx`):**
   - A **Story / Table** toggle at the top of the log panel (works at every
     breakpoint — it's a sub-tab of the log, orthogonal to the mobile Party/Log/
     Character tabs). Unread badge on the inactive channel (count messages received
     while not viewing it; reset on switch).
   - Message list filters by active channel. Meta messages get a visually distinct,
     cooler treatment (e.g. slate/blue tint, smaller, clearly "out of character");
     meta DM replies reuse the DM card but tinted and labeled "DM (table)".
   - Composer: in Table view, show **Send** + **Ask the DM**; hide the dice tray,
     🎨, and 🎤 buttons (mechanics and narration belong to the story channel — this
     also frees vertical space on phones).
   - Initial load: `app/campaigns/[id]/page.tsx` fetches both channels (either two
     queries or one query without channel filter, split client-side; two queries with
     per-channel limits is simpler and keeps the story window semantics unchanged).
7. **Tests:** channel filtering in `listRecentMessages`/`listMessagesAfter`; meta turn
   assembles meta prompt + restricted tools (unit-test the context assembly branch).

---

## Feature 4: The DM must know what each character looks like and who they are

### Current state

The party block in `lib/ai/context.ts` (`buildStateBlock`, line ~24) gives the DM only:
name, species, class, level, HP, AC, conditions, player username. The character's
`appearance`, `backstory`, `alignment`, and background (Soldier, Noble, …) are
collected by the builder and stored on `characters`, but **never injected into DM
context**. Result: a hulking scarred orc and a delicate elf get identical NPC
reactions unless the player narrates their own appearance in chat — exactly what
should not be necessary. The system prompt (`prompts/dm-system.ts`) also never tells
the DM to roleplay NPC reactions to appearance/reputation.

### Design decisions

**Enrich the per-character PRESENT lines, don't add a new block.** The state block is
rebuilt every turn, so anything added here is automatically current (including after
Feature 1's identity edits — a changed appearance takes effect on the very next DM
turn with zero extra wiring).

**Truncate aggressively.** `appearance` is capped at 2000 chars and `backstory` at
4000 (`createCharacterSchema`) — injecting them whole for a 4-person party could eat
a large slice of the context budget every single turn. Appearance matters every
scene; backstory matters occasionally and is partly covered by the campaign summary
once play is underway.

### Implementation steps

1. **`lib/ai/context.ts`:** extend each PRESENT line (the data is already on
   `resolved` — `resolveCharacter` returns `background`, and `character` has
   `alignment`, `appearance`, `backstory`):
   - Identity: `Kara Ironhold (Human Fighter, Soldier background, level 1, chaotic good)`.
   - Appearance: full text up to ~300 chars, ellipsized beyond (first sentences carry
     the visual essentials).
   - Backstory: one clause up to ~150 chars, labeled `Backstory:` — enough for the DM
     to hook NPC recognition ("the deserter from the border war…") without the essay.
   - Off-screen characters keep the short form; NPCs don't react to people who aren't
     there.
2. **`prompts/dm-system.ts`:** add a directive to the NPC section, e.g.: "NPCs react
   to what they can see. Each present character's appearance is in the campaign
   state — a child meeting a towering scarred orc behaves very differently than one
   meeting a soft-spoken elf. Let looks, size, species, and reputation color every
   first impression without the player having to mention them."
3. **Builder nudge (optional, small):** the appearance field in
   `components/CharacterBuilder.tsx` is currently `(optional)` with no hint — update
   its placeholder to say the DM uses it for how NPCs perceive you ("Height, build,
   scars, how you carry yourself — NPCs will react to this"). Empty appearance stays
   legal; the DM then falls back on species/class alone.
4. **Tests:** extend the context-assembly test (if one exists — otherwise add one) to
   assert appearance/background/alignment appear in the state block and that
   truncation caps hold.
5. **Verification:** live session with two characters whose appearance fields contrast
   sharply (scary orc / friendly elf); walk both up to the same NPC and confirm
   visibly different reactions with neither player describing themselves in chat.

---

## Sequencing and scope notes

Recommended order: **4 → 1 → 3 → 2.**
Feature 4 is a near-trivial context/prompt change with immediate play value — land it
first. Feature 1 is self-contained and introduces the `ensureColumn` migration helper
that Feature 3 needs. Feature 3 touches the DM turn machinery; Feature 2 is mostly
isolated in the image pipeline and is the only one with per-verification API cost, so
do it last when everything else is stable. (4 also pairs with 1: once identity edits
exist, an edited appearance reaches the DM on the next turn automatically because the
state block is rebuilt per turn.)

Cross-cutting:

- **README:** update the AI DM section (meta channel), the images section
  (multi-reference composition), and add character edit/delete to the appropriate
  section once done.
- **`npm test`, `tsc --noEmit`, `npm run lint`** must stay clean; existing 239 tests
  must not regress (the `addMessage` default-channel approach is what keeps the
  engine/roll tests untouched).
- **Verification:** each feature gets a live browser pass like Phase 7 (desktop +
  375px mobile). Feature 3's toggle must be checked on mobile specifically — it
  stacks with the existing Party/Log/Character tab bar.
- **No schema rewrites:** both new columns are additive ALTERs; no existing table is
  rebuilt, so `npm run seed` and existing databases keep working with zero action.

## Open items (recommendations made, flag if you disagree)

1. Build-edit gating is "no active campaign membership + level 1". If the family wants
   mid-campaign respecs, that's a bigger feature (retroactive level-ups) — deferred.
2. Meta DM is invoked only via "Ask the DM". If it feels too manual in play, a later
   tweak can auto-trigger when a meta message contains a question mark + "dm", but
   start explicit.
3. Reference cap of 4 images per generation is a judgment call — tune after the first
   real multi-character scene.
