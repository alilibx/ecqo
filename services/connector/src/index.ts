/**
 * Ecqqo WhatsApp Connector
 *
 * Operates in three modes based on CONNECTOR_MODE env var:
 * - "supervisor" → Multi-user supervisor with HTTP API (production)
 * - "worker"     → Child process managed by supervisor (internal)
 * - default      → Standalone single-user session (local dev)
 */

export {};

const CONNECTOR_MODE = process.env.CONNECTOR_MODE ?? "standalone";

if (CONNECTOR_MODE === "supervisor") {
  // ── Supervisor mode: HTTP API + worker management ──
  const { startSupervisor } = await import("./supervisor.js");
  await startSupervisor();
} else if (CONNECTOR_MODE === "worker") {
  // ── Worker mode: managed by supervisor via IPC ──
  // worker.ts self-initializes when imported (listens for IPC messages)
  await import("./worker.js");
} else {
  // ── Standalone mode: single-user for local dev ──
  const { createWhatsAppSession } = await import("./session.js");

  const CONVEX_URL = process.env.CONVEX_URL;
  if (!CONVEX_URL) {
    console.error("CONVEX_URL environment variable is required");
    process.exit(1);
  }

  console.log("🟢 Ecqqo connector starting (standalone mode)...");
  console.log(`   Convex: ${CONVEX_URL}`);

  const session = await createWhatsAppSession({ convexUrl: CONVEX_URL });

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
}
