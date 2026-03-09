/**
 * Tigris (S3-compatible) auth state sync with encryption at rest.
 *
 * Baileys stores ~800+ small JSON files per session in a local directory.
 * This module syncs that directory to/from Tigris so sessions can be
 * restored on any machine (not tied to a specific Fly volume).
 *
 * All files are encrypted with AES-256-GCM before upload using
 * CONNECTOR_ENCRYPTION_KEY. Files are decrypted on download.
 *
 * Strategy:
 *   Session start:  Tigris → download + decrypt auth files to /tmp/wa-auth/{sessionId}/
 *   During session: Baileys reads/writes to local tmpfs (fast)
 *   On creds.update: encrypt + sync changed files → Tigris (background)
 *   Session stop:   final full sync → Tigris
 *   New machine:    pull from Tigris → decrypt → local tmpfs → reconnect without QR
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { encrypt, decrypt, isEncrypted } from "@ecqqo/shared";

// Tigris sets these automatically via `fly storage create`
const BUCKET = process.env.BUCKET_NAME ?? "ecqqo-connector-auth";

let s3: S3Client | null = null;

function getClient(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      // AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
      // are auto-set by Fly.io when a Tigris bucket is attached
      region: "auto",
    });
  }
  return s3;
}

function getEncryptionKey(): string | null {
  return process.env.CONNECTOR_ENCRYPTION_KEY ?? null;
}

function s3Key(sessionId: string, filename: string): string {
  return `auth/${sessionId}/${filename}`;
}

/**
 * Download all auth files for a session from Tigris to local disk.
 * Decrypts files if encryption key is configured.
 * Returns true if files were found and downloaded, false if no auth exists.
 */
export async function downloadAuthState(sessionId: string, authDir: string): Promise<boolean> {
  const client = getClient();
  const encKey = getEncryptionKey();
  const prefix = `auth/${sessionId}/`;

  const listRes = await client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    }),
  );

  const objects = listRes.Contents ?? [];
  if (!objects.length) {
    console.log(`[auth-sync] No auth state in Tigris for ${sessionId}`);
    return false;
  }

  mkdirSync(authDir, { recursive: true });

  let downloaded = 0;
  for (const obj of objects) {
    if (!obj.Key) continue;
    const filename = obj.Key.slice(prefix.length);
    if (!filename) continue;

    // Support nested directories (e.g., app-state-sync-key-xxx)
    const filePath = path.join(authDir, filename);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const getRes = await client.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: obj.Key,
      }),
    );

    const bodyBytes = await getRes.Body?.transformToByteArray();
    if (!bodyBytes) continue;

    const buf = Buffer.from(bodyBytes);

    // Decrypt if encryption key is available and data looks encrypted
    let content: string;
    if (encKey && isEncrypted(buf)) {
      try {
        content = decrypt(buf, encKey, `${sessionId}/${filename}`);
      } catch (err) {
        console.error(`[auth-sync] Failed to decrypt ${filename}, trying as plaintext:`, err);
        content = buf.toString("utf-8");
      }
    } else {
      content = buf.toString("utf-8");
    }

    writeFileSync(filePath, content);
    downloaded++;
  }

  console.log(`[auth-sync] Downloaded ${downloaded} auth files for ${sessionId}${encKey ? " (encrypted)" : ""}`);
  return downloaded > 0;
}

/**
 * Upload all auth files from local disk to Tigris.
 * Encrypts files if encryption key is configured.
 * Used for full sync on session stop.
 */
export async function uploadAuthState(sessionId: string, authDir: string): Promise<void> {
  if (!existsSync(authDir)) return;

  const client = getClient();
  const encKey = getEncryptionKey();
  const files = listFilesRecursive(authDir);

  let uploaded = 0;
  for (const filePath of files) {
    const relative = path.relative(authDir, filePath);
    const key = s3Key(sessionId, relative);
    const plaintext = readFileSync(filePath, "utf-8");

    let body: Buffer | string;
    let contentType: string;

    if (encKey) {
      body = encrypt(plaintext, encKey, `${sessionId}/${relative}`);
      contentType = "application/octet-stream";
    } else {
      body = plaintext;
      contentType = "application/json";
    }

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    uploaded++;
  }

  console.log(`[auth-sync] Uploaded ${uploaded} auth files for ${sessionId}${encKey ? " (encrypted)" : ""}`);
}

/**
 * Upload a single file to Tigris. Used on creds.update for incremental sync.
 */
export async function uploadAuthFile(
  sessionId: string,
  authDir: string,
  filename: string,
): Promise<void> {
  const client = getClient();
  const encKey = getEncryptionKey();
  const filePath = path.join(authDir, filename);

  if (!existsSync(filePath)) return;

  const plaintext = readFileSync(filePath, "utf-8");
  const key = s3Key(sessionId, filename);

  let body: Buffer | string;
  let contentType: string;

  if (encKey) {
    body = encrypt(plaintext, encKey, `${sessionId}/${filename}`);
    contentType = "application/octet-stream";
  } else {
    body = plaintext;
    contentType = "application/json";
  }

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Sync all changed files in the auth directory to Tigris.
 * Simpler than tracking individual changes — just re-upload everything.
 * Auth dirs are small (~4MB total) so this is fast enough.
 */
export async function syncAuthDir(sessionId: string, authDir: string): Promise<void> {
  await uploadAuthState(sessionId, authDir);
}

/**
 * List all session IDs that have auth state in Tigris.
 * Used by supervisor to know which sessions can be restored.
 */
export async function listRemoteSessions(): Promise<string[]> {
  const client = getClient();
  const sessionIds = new Set<string>();

  let continuationToken: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: "auth/",
        Delimiter: "/",
        ContinuationToken: continuationToken,
      }),
    );

    for (const prefix of res.CommonPrefixes ?? []) {
      if (!prefix.Prefix) continue;
      // prefix is "auth/{sessionId}/" — extract sessionId
      const parts = prefix.Prefix.split("/");
      const sessionId = parts[1];
      if (sessionId) {
        sessionIds.add(sessionId);
      }
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return [...sessionIds];
}

/**
 * Delete all auth files for a session from Tigris.
 */
export async function deleteAuthState(sessionId: string): Promise<void> {
  const client = getClient();
  const prefix = `auth/${sessionId}/`;

  let continuationToken: string | undefined;
  do {
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of listRes.Contents ?? []) {
      if (!obj.Key) continue;
      await client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: obj.Key,
        }),
      );
    }

    continuationToken = listRes.NextContinuationToken;
  } while (continuationToken);

  console.log(`[auth-sync] Deleted auth state for ${sessionId}`);
}

// ── Helpers ──

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check if Tigris is configured (env vars present).
 * Returns false in local dev when no bucket is attached.
 */
export function isTigrisConfigured(): boolean {
  return !!(
    process.env.AWS_ENDPOINT_URL_S3 &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.BUCKET_NAME
  );
}
