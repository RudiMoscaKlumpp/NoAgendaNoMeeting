export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, base: number, max: number): number {
  const exponential = base * Math.pow(2, attempt);
  const jitter = exponential * (0.5 + Math.random() * 0.5);
  return Math.min(jitter, max);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {}
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry } = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (shouldRetry && !shouldRetry(err)) throw err;
      if (attempt + 1 >= maxAttempts) break;

      const wait = computeDelay(attempt, baseDelayMs, maxDelayMs);
      console.warn(
        `[retry] Attempt ${attempt + 1}/${maxAttempts} failed, retrying in ${Math.round(wait)}ms`
      );
      await delay(wait);
    }
  }

  throw lastError;
}

export function isGoogleApiError(err: unknown): err is { code: number; message: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "number"
  );
}

export function isRetryableGoogleError(err: unknown): boolean {
  if (!isGoogleApiError(err)) return true;
  const { code } = err;
  if (code === 429) return true;
  if (code >= 500) return true;
  return false;
}

export function isAuthError(err: unknown): boolean {
  if (!isGoogleApiError(err)) {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("invalid_grant") || msg.includes("Token has been expired or revoked");
  }
  return err.code === 401 || err.code === 403;
}

export function isRetryableSmtpError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes("connection") || msg.includes("timeout") || msg.includes("econnreset")) {
    return true;
  }
  const code = (err as { responseCode?: number }).responseCode;
  if (code && code >= 400 && code < 500) return false;
  return code ? code >= 500 : false;
}
