/**
 * WhatsApp session manager using Baileys.
 *
 * Handles: QR auth → connection → message sync → heartbeat.
 * All state is pushed to Convex — this process is stateless
 * except for the in-memory Baileys auth state.
 *
 * Supports two modes:
 * - Standalone: creates its own session in Convex (local dev)
 * - Worker: receives sessionId from supervisor via IPC
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers,
  type WASocket,
  type BaileysEventMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { ConnectorConvexClient } from "./convex-client.js";
import { normalizeMessage, computeIngestionHash } from "./normalize.js";
import { HEARTBEAT_INTERVAL_MS } from "@ecqqo/shared";
import type { ConnectSessionStatus } from "./ipc-protocol.js";
import type { Id } from "../../../convex/_generated/dataModel.js";

const baileysLogger = pino({ level: "error" });

const BASE_AUTH_DIR = process.env.AUTH_DIR ?? "/tmp/wa-auth";

export interface SessionOptions {
  convexUrl: string;
  /** Pre-created session ID (worker mode). If omitted, creates a new session. */
  sessionId?: Id<"waConnectSessions">;
  /** Callback for status updates (used by worker to relay to supervisor). */
  onStatusChange?: (status: ConnectSessionStatus) => void;
}

export async function createWhatsAppSession(opts: SessionOptions) {
  const { convexUrl, onStatusChange } = opts;
  const convex = new ConnectorConvexClient(convexUrl);
  let sock: WASocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let qrRetries = 0;
  const MAX_QR_RETRIES = 5;
  const contactNames = new Map<string, string>(); // JID → pushName cache
  let accountReadyResolve: () => void;
  const accountReady = new Promise<void>((r) => (accountReadyResolve = r));

  // Create or use existing session
  let sessionId: Id<"waConnectSessions">;
  if (opts.sessionId) {
    sessionId = opts.sessionId;
    convex.setSessionId(sessionId);
  } else {
    sessionId = await convex.createSession();
  }

  // Per-session auth directory for isolation
  const authDir = `${BASE_AUTH_DIR}/${sessionId}`;

  // Load auth state (in-memory on Fly.io via tmpfs)
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  function reportStatus(status: ConnectSessionStatus) {
    onStatusChange?.(status);
  }

  async function connect() {
    if (stopped) return;

    console.log("📱 Connecting to WhatsApp Web...");

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      // macOS platform avoids 405 from stale WEB protocol version
      // See: https://github.com/WhiskeySockets/Baileys/issues/2376
      browser: Browsers.macOS("Ecqqo"),
      version: [2, 3000, 1034074495],
      logger: baileysLogger,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    });

    // ── Connection lifecycle ──
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrRetries++;
        if (qrRetries > MAX_QR_RETRIES) {
          console.log("⏰ QR expired — too many attempts");
          await convex.updateSessionStatus("expired");
          reportStatus("expired");
          sock?.end(undefined);
          return;
        }

        console.log(
          `\n📲 Scan this QR code with WhatsApp (attempt ${qrRetries}/${MAX_QR_RETRIES}):\n`,
        );
        qrcode.generate(qr, { small: true });

        await convex.updateSessionStatus("qr_ready", { qrCode: qr });
        reportStatus("qr_ready");
      }

      if (connection === "open") {
        qrRetries = 0;
        console.log("✅ Connected to WhatsApp");
        const me = sock?.user;
        const phoneNumber = me?.id?.split(":")[0] ?? "unknown";

        await convex.updateSessionStatus("connected");
        await convex.createAccount({
          phoneNumber,
          pushName: me?.name,
          platform: "baileys",
        });

        console.log(`   Phone: ${phoneNumber}`);
        console.log(`   Name: ${me?.name ?? "unknown"}`);

        reportStatus("connected");
        accountReadyResolve!();
        startHeartbeat();
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output
          ?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        stopHeartbeat();

        if (loggedOut) {
          console.log("🔒 Logged out — session ended");
          await convex.updateSessionStatus("disconnected");
          await convex.updateAccountStatus("disconnected");
          reportStatus("disconnected");
        } else if (statusCode === 428) {
          // 428 = connection closed waiting for QR scan — normal during auth
          if (!stopped) {
            console.log("⏳ Waiting for QR scan, reconnecting...");
            setTimeout(connect, 2000);
          }
        } else {
          console.log(`❌ Connection closed (code: ${statusCode})`);
          await convex.updateSessionStatus("retry_pending");
          reportStatus("retry_pending");
          console.log("🔄 Reconnecting in 5s...");
          setTimeout(connect, 5000);
        }
      }
    });

    // ── Save credentials on update ──
    sock.ev.on("creds.update", saveCreds);

    // ── Message ingestion ──
    sock.ev.on("messages.upsert", async (event) => {
      if (!event.messages.length) return;
      await accountReady;

      const accountJid = sock?.user?.id ?? "";
      const normalized = event.messages
        .map((m) => normalizeMessage(m, accountJid))
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .map((m) => ({
          ...m,
          ingestionHash: computeIngestionHash(sessionId, m.externalId),
        }));

      if (!normalized.length) return;

      // Debug: show message content
      const me = sock?.user;
      const myName = me?.name ?? me?.id?.split(":")[0] ?? "You";
      for (const m of normalized) {
        // Cache pushName for future lookups
        if (m.pushName && !m.fromMe) {
          contactNames.set(m.chatJid, m.pushName);
        }
        const contactName = contactNames.get(m.chatJid) ?? m.chatJid.split("@")[0];
        const from = m.fromMe ? myName : contactName;
        const to = m.fromMe ? contactName : myName;
        const preview = m.text ? m.text.slice(0, 80) : `[${m.type}]`;
        console.log(`   💬 ${from} → ${to}: ${preview}`);
      }

      try {
        const result = await convex.ingestMessages(normalized);
        console.log(
          `📨 Ingested ${result.ingested} messages (${result.deduplicated} deduped)`,
        );
      } catch (err) {
        console.error("Failed to ingest messages:", err);
      }
    });

    // ── History sync (initial link) ──
    sock.ev.on(
      "messaging-history.set" as keyof BaileysEventMap,
      async (event: any) => {
        const messages = event.messages ?? [];
        if (!messages.length) return;
        await accountReady;

        console.log(`📜 History sync: ${messages.length} messages`);
        const accountJid = sock?.user?.id ?? "";
        const normalized = messages
          .map((m: any) => normalizeMessage(m, accountJid))
          .filter((m: any): m is NonNullable<typeof m> => m !== null)
          .map((m: any) => ({
            ...m,
            ingestionHash: computeIngestionHash(sessionId, m.externalId),
          }));

        if (!normalized.length) return;

        // Batch in chunks of 100 to avoid mutation size limits
        for (let i = 0; i < normalized.length; i += 100) {
          const batch = normalized.slice(i, i + 100);
          try {
            const result = await convex.ingestMessages(batch);
            console.log(
              `   Batch ${Math.floor(i / 100) + 1}: ${result.ingested} ingested, ${result.deduplicated} deduped`,
            );
          } catch (err) {
            console.error(
              `   Batch ${Math.floor(i / 100) + 1} failed:`,
              err,
            );
          }
        }
      },
    );
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(async () => {
      try {
        await convex.heartbeat();
      } catch (err) {
        console.error("Heartbeat failed:", err);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // Start connection
  await connect();

  return {
    sessionId,
    stop: async () => {
      stopped = true;
      stopHeartbeat();
      sock?.end(undefined);
      await convex.updateSessionStatus("disconnected");
      await convex.updateAccountStatus("disconnected");
      reportStatus("disconnected");
    },
  };
}
