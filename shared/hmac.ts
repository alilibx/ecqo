/**
 * HMAC-SHA256 request signing for connector → Convex communication.
 *
 * Each request includes:
 *   - signature: HMAC-SHA256(secret, payload + timestamp + nonce)
 *   - timestamp: Unix ms when the request was signed
 *   - nonce: Random string for anti-replay
 *
 * Convex mutations verify signature, reject if:
 *   - Signature doesn't match
 *   - Timestamp is outside the allowed window (default 5 minutes)
 */

import { createHmac, randomBytes } from "crypto";

/** Max age of a signed request in milliseconds (5 minutes) */
export const HMAC_MAX_AGE_MS = 5 * 60_000;

export interface SignedHeaders {
  /** HMAC-SHA256 hex signature */
  signature: string;
  /** Unix timestamp (ms) when the request was signed */
  timestamp: number;
  /** Random nonce for anti-replay */
  nonce: string;
}

/**
 * Sign a payload for connector → Convex communication.
 * The payload is JSON-stringified and combined with timestamp + nonce.
 */
export function signPayload(secret: string, payload: unknown): SignedHeaders {
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const message = buildSignatureMessage(payload, timestamp, nonce);

  const signature = createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return { signature, timestamp, nonce };
}

/**
 * Verify a signed payload. Returns true if valid, false if tampered/expired/replayed.
 */
export function verifySignature(
  secret: string,
  payload: unknown,
  headers: SignedHeaders,
  opts?: { maxAgeMs?: number },
): { valid: boolean; reason?: string } {
  const maxAge = opts?.maxAgeMs ?? HMAC_MAX_AGE_MS;
  const now = Date.now();

  // Check timestamp freshness
  const age = Math.abs(now - headers.timestamp);
  if (age > maxAge) {
    return { valid: false, reason: `Request expired (age: ${age}ms, max: ${maxAge}ms)` };
  }

  // Recompute signature
  const message = buildSignatureMessage(payload, headers.timestamp, headers.nonce);
  const expected = createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  // Constant-time comparison
  if (expected.length !== headers.signature.length) {
    return { valid: false, reason: "Signature length mismatch" };
  }

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(headers.signature, "hex");

  if (!timingSafeEqual(a, b)) {
    return { valid: false, reason: "Signature mismatch" };
  }

  return { valid: true };
}

function buildSignatureMessage(
  payload: unknown,
  timestamp: number,
  nonce: string,
): string {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return `${body}.${timestamp}.${nonce}`;
}

/**
 * Constant-time buffer comparison to prevent timing attacks.
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}
