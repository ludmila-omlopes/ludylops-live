import { describe, expect, it } from "vitest";
import { buildCredentialSignature, decryptCredentialSecret, encryptCredentialSecret, verifyCredentialSignature } from "./credential-crypto";

const key = Buffer.alloc(32, 7).toString("base64");
const id = `sbc_${"a".repeat(32)}`;
const envelope = { credentialId: id, timestamp: "1789900000000", method: "POST", pathname: "/api/internal/streamerbot/quotes", body: '{"body":"Você chegou! 🌟"}', secret: "test-vector-secret" };

describe("credential encryption", () => {
  it("roundtrips with distinct random IVs and never embeds plaintext", () => {
    const first = encryptCredentialSecret("test-secret", id, "creator-a", key);
    expect(first).not.toContain("test-secret");
    expect(encryptCredentialSecret("test-secret", id, "creator-a", key)).not.toBe(first);
    expect(decryptCredentialSecret(first, id, "creator-a", key)).toBe("test-secret");
  });
  it("binds ciphertext to both credential and creator IDs", () => {
    const value = encryptCredentialSecret("test-secret", id, "creator-a", key);
    expect(() => decryptCredentialSecret(value, id, "creator-b", key)).toThrow();
    expect(() => decryptCredentialSecret(value, `sbc_${"b".repeat(32)}`, "creator-a", key)).toThrow();
    expect(() => decryptCredentialSecret(value, id, "creator-a", Buffer.alloc(32, 8).toString("base64"))).toThrow();
    const parts = value.split(".");
    parts[2] = Buffer.alloc(16).toString("base64url");
    expect(() => decryptCredentialSecret(parts.join("."), id, "creator-a", key)).toThrow();
  });
  it.each([undefined, "", "not-a-key", Buffer.alloc(16).toString("base64")])("refuses unavailable/invalid master key", (value) => {
    expect(() => encryptCredentialSecret("test", id, "creator-a", value)).toThrow("credential_key_unavailable");
  });
});

describe("v2 signed envelope", () => {
  it("accepts the original raw UTF-8 body", () => {
    expect(verifyCredentialSignature({ ...envelope, signature: buildCredentialSignature(envelope), now: Number(envelope.timestamp) })).toBe(true);
  });
  it.each([
    { credentialId: `sbc_${"b".repeat(32)}` }, { timestamp: "1789900000001" }, { method: "GET" },
    { pathname: "/api/internal/streamerbot/events" }, { body: '{ "body": "Você chegou! 🌟" }' }, { secret: "wrong" },
  ])("rejects any changed envelope field %j", (changes) => {
    expect(verifyCredentialSignature({ ...envelope, ...changes, signature: buildCredentialSignature(envelope), now: Number(envelope.timestamp) })).toBe(false);
  });
  it.each([-300001, 300001])("rejects expired and future timestamps", (offset) => {
    expect(verifyCredentialSignature({ ...envelope, signature: buildCredentialSignature(envelope), now: Number(envelope.timestamp) + offset })).toBe(false);
  });
  it.each(["", "aa", "x".repeat(64), "A".repeat(64)])("rejects malformed signatures", (signature) => {
    expect(verifyCredentialSignature({ ...envelope, signature, now: Number(envelope.timestamp) })).toBe(false);
  });
});
