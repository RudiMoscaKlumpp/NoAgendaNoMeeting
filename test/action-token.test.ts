import { describe, it, expect } from "vitest";
import { signActionToken, verifyActionToken } from "../src/action-token";

describe("action-token", () => {
  it("signs and verifies a valid token", () => {
    const token = signActionToken("evt-1", "user@example.com");
    const result = verifyActionToken(token, "evt-1");
    expect(result.ok).toBe(true);
    expect(result.payload?.user).toBe("user@example.com");
    expect(result.payload?.eventId).toBe("evt-1");
  });

  it("rejects malformed tokens", () => {
    expect(verifyActionToken("", "evt-1").reason).toBe("malformed");
    expect(verifyActionToken("nopart", "evt-1").reason).toBe("malformed");
    expect(verifyActionToken("only.", "evt-1").reason).toBe("malformed");
    expect(verifyActionToken(".onlysig", "evt-1").reason).toBe("malformed");
  });

  it("rejects bad signatures", () => {
    const token = signActionToken("evt-1", "user@example.com");
    const [encoded] = token.split(".");
    const tampered = `${encoded}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const result = verifyActionToken(tampered, "evt-1");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("bad_signature");
  });

  it("rejects token used on a different event", () => {
    const token = signActionToken("evt-1", "user@example.com");
    const result = verifyActionToken(token, "evt-other");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("mismatch");
  });

  it("rejects payload with manipulated user", () => {
    const token = signActionToken("evt-1", "user@example.com");
    const [, sig] = token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({ eventId: "evt-1", user: "attacker@example.com", exp: Date.now() + 1000 })
    ).toString("base64url");
    const tampered = `${fakePayload}.${sig}`;
    expect(verifyActionToken(tampered, "evt-1").reason).toBe("bad_signature");
  });
});
