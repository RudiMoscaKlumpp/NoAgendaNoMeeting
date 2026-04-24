import { describe, it, expect, vi } from "vitest";
import { withRetry, isRetryableGoogleError, isAuthError, isRetryableSmtpError } from "../src/retry";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after max attempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 10 })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops retrying when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("auth error"));
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 10,
        shouldRetry: () => false,
      })
    ).rejects.toThrow("auth error");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("isRetryableGoogleError", () => {
  it("retries 429 rate limit", () => {
    expect(isRetryableGoogleError({ code: 429, message: "rate limit" })).toBe(true);
  });

  it("retries 500 server error", () => {
    expect(isRetryableGoogleError({ code: 500, message: "internal" })).toBe(true);
  });

  it("does not retry 400 client error", () => {
    expect(isRetryableGoogleError({ code: 400, message: "bad request" })).toBe(false);
  });

  it("retries non-Google errors", () => {
    expect(isRetryableGoogleError(new Error("network error"))).toBe(true);
  });
});

describe("isAuthError", () => {
  it("detects 401", () => {
    expect(isAuthError({ code: 401, message: "unauthorized" })).toBe(true);
  });

  it("detects invalid_grant in message", () => {
    expect(isAuthError(new Error("invalid_grant"))).toBe(true);
  });

  it("does not flag 500", () => {
    expect(isAuthError({ code: 500, message: "server error" })).toBe(false);
  });
});

describe("isRetryableSmtpError", () => {
  it("retries connection errors", () => {
    expect(isRetryableSmtpError(new Error("connection refused"))).toBe(true);
  });

  it("retries timeout errors", () => {
    expect(isRetryableSmtpError(new Error("socket timeout"))).toBe(true);
  });

  it("does not retry 4xx SMTP errors", () => {
    const err = Object.assign(new Error("bad recipient"), { responseCode: 450 });
    expect(isRetryableSmtpError(err)).toBe(false);
  });

  it("retries 5xx SMTP errors", () => {
    const err = Object.assign(new Error("service unavailable"), { responseCode: 503 });
    expect(isRetryableSmtpError(err)).toBe(true);
  });
});
