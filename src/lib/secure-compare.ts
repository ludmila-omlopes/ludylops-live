import crypto from "node:crypto";

/** Constant-time string equality that does not leak length differences. */
export function timingSafeStringEqual(a: string, b: string) {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}
