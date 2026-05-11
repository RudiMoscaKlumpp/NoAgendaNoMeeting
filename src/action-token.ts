import { createHmac, timingSafeEqual } from "crypto";
import { config } from "./config";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface ActionPayload {
  eventId: string;
  user: string;
  exp: number;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function sign(payload: string): string {
  return b64urlEncode(
    createHmac("sha256", config.sessionSecret).update(payload).digest()
  );
}

export function signActionToken(eventId: string, user: string): string {
  const payload: ActionPayload = {
    eventId,
    user,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  return `${encoded}.${sign(encoded)}`;
}

export interface VerifyResult {
  ok: boolean;
  reason?: "malformed" | "bad_signature" | "expired" | "mismatch";
  payload?: ActionPayload;
}

export function verifyActionToken(
  token: string,
  expectedEventId: string
): VerifyResult {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return { ok: false, reason: "malformed" };

  const expected = sign(encoded);
  const aBuf = Buffer.from(sig);
  const bBuf = Buffer.from(expected);
  if (aBuf.length !== bBuf.length || !timingSafeEqual(aBuf, bBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: ActionPayload;
  try {
    payload = JSON.parse(b64urlDecode(encoded).toString("utf8")) as ActionPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.exp < Date.now()) return { ok: false, reason: "expired" };
  if (payload.eventId !== expectedEventId) return { ok: false, reason: "mismatch" };

  return { ok: true, payload };
}
