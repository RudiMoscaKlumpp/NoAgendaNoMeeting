import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/crypto";

describe("encrypt / decrypt", () => {
  it("round-trips plaintext", () => {
    const plaintext = '{"access_token":"ya29.xxx","refresh_token":"1//xxx","expiry_date":1700000000}';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "test data";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("output format is iv:authTag:ciphertext (3 base64 parts)", () => {
    const encrypted = encrypt("hello");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
    }
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("sensitive data");
    const parts = encrypted.split(":");
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode", () => {
    const text = "Lenka says: Keine Agenda, kein Meeting! 🎯";
    expect(decrypt(encrypt(text))).toBe(text);
  });
});
