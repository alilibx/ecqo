/**
 * AES-256-GCM encryption for auth state files stored in Tigris S3.
 *
 * Each file is encrypted with a unique IV derived from the master key + session ID.
 * Format: [12-byte IV][ciphertext][16-byte auth tag]
 *
 * The master key is derived from CONNECTOR_ENCRYPTION_KEY env var using HKDF.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derive a 256-bit encryption key from a master secret + context.
 * Uses SHA-256 as a simple KDF (sufficient for our use case).
 */
function deriveKey(masterKey: string, context: string): Buffer {
  return createHash("sha256")
    .update(`${masterKey}:${context}`)
    .digest();
}

/**
 * Encrypt a UTF-8 string using AES-256-GCM.
 * Returns a Buffer: [IV (12 bytes)][ciphertext][auth tag (16 bytes)]
 */
export function encrypt(plaintext: string, masterKey: string, context: string): Buffer {
  const key = deriveKey(masterKey, context);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // [IV][ciphertext][tag]
  return Buffer.concat([iv, encrypted, tag]);
}

/**
 * Decrypt an AES-256-GCM encrypted buffer back to UTF-8 string.
 * Input format: [IV (12 bytes)][ciphertext][auth tag (16 bytes)]
 */
export function decrypt(data: Buffer, masterKey: string, context: string): string {
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted data too short");
  }

  const key = deriveKey(masterKey, context);

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check if a buffer looks like encrypted data (has valid IV + tag length).
 * Used to detect whether auth files are already encrypted (migration).
 */
export function isEncrypted(data: Buffer): boolean {
  // Encrypted data must be at least IV + tag length
  // and first 12 bytes shouldn't look like valid JSON
  if (data.length < IV_LENGTH + TAG_LENGTH) return false;

  // Check if it starts with { or [ (JSON) — if so, it's plaintext
  const firstByte = data[0];
  if (firstByte === 0x7b || firstByte === 0x5b) return false; // { or [

  return true;
}
