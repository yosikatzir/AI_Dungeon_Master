import OpenAI, { APIError } from "openai";
import { AiError } from "@/lib/ai/errors";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set in .env.local. See .env.example.");
}

// Server-side only — never import this module from a Client Component.
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isRetryable(err: unknown): boolean {
  if (err instanceof APIError) {
    if (err.status === 429) return true;
    if (typeof err.status === "number" && err.status >= 500) return true;
    return false;
  }
  // Network-level errors (no HTTP status at all) are worth a retry.
  return !(err instanceof Error) || !("status" in err);
}

function toAiError(err: unknown): AiError {
  if (err instanceof APIError) {
    if (err.status === 429) {
      return new AiError(err.message, "The DM is thinking too fast right now — please try again in a moment.");
    }
    if (err.status === 401 || err.status === 403) {
      return new AiError(err.message, "The DM's connection isn't configured correctly. Ask the admin to check the API key.");
    }
    if (typeof err.status === "number" && err.status >= 500) {
      return new AiError(err.message, "The DM's connection is having trouble reaching OpenAI. Please try again.");
    }
    if (err.code === "content_policy_violation") {
      return new AiError(err.message, "That request couldn't be completed — try rephrasing.");
    }
    return new AiError(err.message, "Something went wrong reaching the DM. Please try again.");
  }
  const message = err instanceof Error ? err.message : String(err);
  return new AiError(message, "Something went wrong reaching the DM. Please try again.");
}

/** Retries transient failures (rate limits, 5xx, network errors) with exponential backoff + jitter. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === retries) break;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw toAiError(lastError);
}
