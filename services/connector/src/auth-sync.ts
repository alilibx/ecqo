/**
 * Tigris (S3-compatible) auth state sync.
 *
 * Baileys stores ~800+ small JSON files per session in a local directory.
 * This module syncs that directory to/from Tigris so sessions can be
 * restored on any machine (not tied to a specific Fly volume).
 *
 * Strategy:
 *   Session start:  Tigris → download auth files to /tmp/wa-auth/{sessionId}/
 *   During session: Baileys reads/writes to local tmpfs (fast)
 *   On creds.update: sync changed files → Tigris (background)
 *   Session stop:   final full sync → Tigris
 *   New machine:    pull from Tigris → local tmpfs → reconnect without QR
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

function s3Key(sessionId: string, filename: string): string {
  return `auth/${sessionId}/${filename}`;
}

/**
 * Download all auth files for a session from Tigris to local disk.
 * Returns true if files were found and downloaded, false if no auth exists.
 */
export async function downloadAuthState(sessionId: string, authDir: string): Promise<boolean> {
  const client = getClient();
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

    const body = await getRes.Body?.transformToString();
    if (body !== undefined) {
      writeFileSync(filePath, body);
      downloaded++;
    }
  }

  console.log(`[auth-sync] Downloaded ${downloaded} auth files for ${sessionId}`);
  return downloaded > 0;
}

/**
 * Upload all auth files from local disk to Tigris.
 * Used for full sync on session stop.
 */
export async function uploadAuthState(sessionId: string, authDir: string): Promise<void> {
  if (!existsSync(authDir)) return;

  const client = getClient();
  const files = listFilesRecursive(authDir);

  let uploaded = 0;
  for (const filePath of files) {
    const relative = path.relative(authDir, filePath);
    const key = s3Key(sessionId, relative);
    const content = readFileSync(filePath, "utf-8");

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: content,
        ContentType: "application/json",
      }),
    );
    uploaded++;
  }

  console.log(`[auth-sync] Uploaded ${uploaded} auth files for ${sessionId}`);
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
  const filePath = path.join(authDir, filename);

  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf-8");
  const key = s3Key(sessionId, filename);

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: content,
      ContentType: "application/json",
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
