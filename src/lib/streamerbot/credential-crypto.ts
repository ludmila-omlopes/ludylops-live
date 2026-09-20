import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "node:crypto";

export const credentialIdPattern = /^sbc_[a-f0-9]{32}$/u;

function encryptionKey(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/u.test(value)) throw new Error("credential_key_unavailable");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw new Error("credential_key_unavailable");
  return key;
}

function aad(id: string, creatorId: string) {
  return Buffer.from(JSON.stringify(["streamerbot-secret-v1", id, creatorId]), "utf8");
}

export function encryptCredentialSecret(secret: string, id: string, creatorId: string, key: string | undefined) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(aad(id, creatorId));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptCredentialSecret(value: string, id: string, creatorId: string, key: string | undefined) {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))) {
    throw new Error("credential_ciphertext_invalid");
  }
  const [iv, tag, encrypted] = parts.slice(1).map((part) => Buffer.from(part, "base64url"));
  if (iv.length !== 12 || tag.length !== 16) throw new Error("credential_ciphertext_invalid");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(aad(id, creatorId));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8");
}

type SignedEnvelope = { credentialId: string; timestamp: string; method: string; pathname: string; body: string };

export function buildCredentialSignature(input: SignedEnvelope & { secret: string }) {
  const canonical = ["v2", input.timestamp, input.credentialId, input.method, input.pathname, input.body].join("\n");
  return createHmac("sha256", input.secret).update(canonical, "utf8").digest("hex");
}

export function verifyCredentialSignature(input: SignedEnvelope & { secret: string; signature: string; now?: number }) {
  if (!credentialIdPattern.test(input.credentialId) || !/^\d{13}$/u.test(input.timestamp) || !/^[a-f0-9]{64}$/u.test(input.signature)) return false;
  if (Math.abs((input.now ?? Date.now()) - Number(input.timestamp)) > 300_000) return false;
  return timingSafeEqual(Buffer.from(input.signature, "hex"), Buffer.from(buildCredentialSignature(input), "hex"));
}
