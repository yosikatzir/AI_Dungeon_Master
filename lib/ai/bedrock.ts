import {
  BedrockRuntimeClient,
  AccessDeniedException,
  ThrottlingException,
  ServiceUnavailableException,
  ModelTimeoutException,
  InternalServerException,
} from "@aws-sdk/client-bedrock-runtime";
import { AiError } from "@/lib/ai/errors";

// Server-side only — never import this module from a Client Component.
// Credentials come from the standard AWS SDK v3 provider chain: the EC2
// instance role in production (via IMDS, no keys anywhere), or the
// AWS_PROFILE set in .env.local for local development.
export const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

function isRetryable(err: unknown): boolean {
  if (
    err instanceof ThrottlingException ||
    err instanceof ServiceUnavailableException ||
    err instanceof ModelTimeoutException ||
    err instanceof InternalServerException
  ) {
    return true;
  }
  // Network-level errors (no AWS exception type at all) are worth a retry.
  return !(err instanceof Error) || !("$metadata" in err);
}

function toAiError(err: unknown): AiError {
  if (err instanceof AccessDeniedException) {
    return new AiError(err.message, "The DM's connection isn't configured correctly. Ask the admin to check AWS permissions.");
  }
  if (err instanceof ThrottlingException) {
    return new AiError(err.message, "The DM is thinking too fast right now — please try again in a moment.");
  }
  if (
    err instanceof ServiceUnavailableException ||
    err instanceof ModelTimeoutException ||
    err instanceof InternalServerException
  ) {
    return new AiError(err.message, "The DM's connection is having trouble reaching Bedrock. Please try again.");
  }
  const message = err instanceof Error ? err.message : String(err);
  return new AiError(message, "Something went wrong reaching the DM. Please try again.");
}

/** Retries transient failures (throttling, 5xx, network errors) with exponential backoff + jitter. */
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
