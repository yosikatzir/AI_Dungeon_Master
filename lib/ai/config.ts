/**
 * Single source of truth for which AI models/services the app uses. Change
 * one here to upgrade it everywhere — nothing else in the codebase should
 * hardcode a model name. Chat/summarization run on Bedrock (Claude); image
 * generation stays on OpenAI (no viable Bedrock replacement exists — see
 * lib/ai/images.ts). Bedrock model IDs are inference-profile IDs, not bare
 * foundation-model IDs — invoking the bare ID fails with "on-demand
 * throughput isn't supported" for these models.
 *
 * DM_MODEL is Haiku, not the originally-intended Sonnet: this AWS account's
 * Bedrock entitlement doesn't currently include Sonnet-tier Claude models —
 * confirmed live via `aws bedrock get-foundation-model-availability`, which
 * shows `agreementAvailability: NOT_AVAILABLE` for every Sonnet model tried
 * (including the older 4.5) while Haiku shows `AVAILABLE`. This is an
 * account-level entitlement gap, not an IAM or code issue. Once Sonnet
 * access is granted (Bedrock console / AWS support), swap this back.
 */
export const DM_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
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

/** Safety cap on tool-call round-trips within a single DM turn. */
export const MAX_TOOL_ITERATIONS = 6;

/**
 * Appended to every image prompt (scenes, portraits, NPCs) so the whole
 * campaign feels visually consistent. Maps use their own scaffolding — see
 * lib/ai/images.ts.
 */
export const IMAGE_STYLE =
  "classic fantasy oil-painting illustration in the style of vintage tabletop RPG rulebook art, rich colors, dramatic lighting, painterly detail";
