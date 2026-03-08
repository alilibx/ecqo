/**
 * Ecqqo WhatsApp Connector Worker
 *
 * Long-running Bun process that:
 * 1. Connects to WhatsApp Web via Baileys
 * 2. Handles QR auth flow
 * 3. Streams message events to Convex
 * 4. Sends heartbeats for liveness detection
 */

import { createWhatsAppSession } from "./session.js";
import { HEARTBEAT_INTERVAL_MS } from "@ecqqo/shared";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("CONVEX_URL environment variable is required");
  process.exit(1);
}

console.log("🟢 Ecqqo connector starting...");
console.log(`   Convex: ${CONVEX_URL}`);

const session = await createWhatsAppSession(CONVEX_URL);

// Graceful shutdown
const shutdown = async () => {
  console.log("\n🔴 Shutting down connector...");
  await session.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep process alive
await new Promise(() => {});
