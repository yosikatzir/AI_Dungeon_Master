/** Thrown by each provider's withRetry once retries are exhausted; `userFacing` is safe to show in chat. */
export class AiError extends Error {
  constructor(
    message: string,
    public readonly userFacing: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}
