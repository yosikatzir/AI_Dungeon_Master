/**
 * Single source of truth for which AI models/services the app uses. Change
 * one here to upgrade it everywhere — nothing else in the codebase should
 * hardcode a model name. Chat/summarization run on Bedrock (Claude); image
 * generation stays on OpenAI (no viable Bedrock replacement exists — see
 * lib/ai/images.ts). Bedrock model IDs are inference-profile IDs, not bare
 * foundation-model IDs — invoking the bare ID fails with "on-demand
 * throughput isn't supported" for these models.
 *
 * DM_MODEL is Sonnet 4.6. An earlier pass concluded Sonnet was unavailable on
 * this account based on `aws bedrock get-foundation-model-availability`
 * reporting `agreementAvailability: NOT_AVAILABLE` — but that API answers for
 * the BARE foundation model, and these models can only be invoked through a
 * regional inference profile anyway. Invoking `us.anthropic.claude-sonnet-4-6`
 * directly succeeds; the availability check was simply the wrong probe. Test
 * with a real `converse` call, not the availability API. (Sonnet 5 is a
 * genuine gap — its inference profile returns AccessDeniedException.)
 *
 * The upgrade matters beyond prose quality: the DM's hard rules (keep
 * narration to a few sentences, always roll before narrating an uncertain
 * outcome, stat an NPC before rolling against it) are instruction-following
 * problems, and Haiku measurably drifted on all three in live play.
 */
export const DM_MODEL = "us.anthropic.claude-sonnet-4-6";
export const SUMMARIZER_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
export const IMAGE_MODEL = "gpt-image-1";

/** Amazon Transcribe language for voice input. */
export const TRANSCRIBE_LANGUAGE_CODE = "en-US";

/** S3 bucket (created by infra/bootstrap/) used for app data backup and as
 *  scratch space for in-flight voice transcription uploads. */
export const DATA_BUCKET_NAME = "family-table-data-287496344353";

/** After this many messages accumulate since the last summary, fold them in. */
export const SUMMARIZE_EVERY_N_MESSAGES = 40;

/** How many of the most recent messages are sent to the model verbatim. */
export const RECENT_MESSAGE_WINDOW = 30;

/** How much recent story the DM re-reads when composing an image prompt.
 *  Deliberately shorter than RECENT_MESSAGE_WINDOW: the illustration should
 *  depict the latest beat, and a long tail of older narration only pulls the
 *  description back toward scenes the party has already left. */
export const SCENE_PROMPT_MESSAGE_WINDOW = 12;

/** Safety cap on tool-call round-trips within a single DM turn. */
export const MAX_TOOL_ITERATIONS = 6;

/**
 * Appended to every image prompt (scenes, portraits, NPCs) so the whole
 * campaign feels visually consistent. Maps use their own scaffolding — see
 * lib/ai/images.ts.
 */
export const IMAGE_STYLE =
  "classic fantasy oil-painting illustration in the style of vintage tabletop RPG rulebook art, rich colors, dramatic lighting, painterly detail";
