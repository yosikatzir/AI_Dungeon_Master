/**
 * Single source of truth for which OpenAI models the app uses. Change a
 * model here to upgrade it everywhere — nothing else in the codebase should
 * hardcode a model name.
 */
export const DM_MODEL = "gpt-4o-mini";
export const SUMMARIZER_MODEL = "gpt-4o-mini";
export const WHISPER_MODEL = "whisper-1";
export const IMAGE_MODEL = "gpt-image-1";

/** After this many messages accumulate since the last summary, fold them in. */
export const SUMMARIZE_EVERY_N_MESSAGES = 40;

/** How many of the most recent messages are sent to the model verbatim. */
export const RECENT_MESSAGE_WINDOW = 30;

/** Safety cap on tool-call round-trips within a single DM turn. */
export const MAX_TOOL_ITERATIONS = 6;

/**
 * Appended to every image prompt (scenes, portraits, NPCs) so the whole
 * campaign feels visually consistent. Maps use their own scaffolding — see
 * lib/ai/images.ts.
 */
export const IMAGE_STYLE =
  "classic fantasy oil-painting illustration in the style of vintage tabletop RPG rulebook art, rich colors, dramatic lighting, painterly detail";
