/**
 * Worker entry point — forked by the supervisor via child_process.fork().
 *
 * Receives a start command with sessionId + convexUrl via IPC,
 * runs a WhatsApp session, and reports status back to the supervisor.
 */

import { createWhatsAppSession } from "./session.js";
import {
  sendToSupervisor,
  type SupervisorToWorker,
  type ConnectSessionStatus,
} from "./ipc-protocol.js";
import type { Id } from "../../../convex/_generated/dataModel.js";

let session: Awaited<ReturnType<typeof createWhatsAppSession>> | null = null;

// Report memory usage periodically
const METRICS_INTERVAL_MS = 30_000;
let metricsTimer: ReturnType<typeof setInterval> | null = null;

function startMetrics(sessionId: string) {
  metricsTimer = setInterval(() => {
    const memMB = Math.round(process.memoryUsage.rss() / 1024 / 1024);
    sendToSupervisor({ type: "metrics", sessionId, memoryMB: memMB });
  }, METRICS_INTERVAL_MS);
}

function stopMetrics() {
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = null;
  }
}

// Signal to supervisor that the worker process is ready for messages
sendToSupervisor({ type: "ready" });

process.on("message", async (msg: SupervisorToWorker) => {
  if (msg.type === "start") {
    const { sessionId, convexUrl } = msg;
    console.log(`[worker:${sessionId}] Starting WhatsApp session`);

    try {
      session = await createWhatsAppSession({
        convexUrl,
        sessionId: sessionId as Id<"waConnectSessions">,
        onStatusChange: (status: ConnectSessionStatus) => {
          sendToSupervisor({ type: "status", sessionId, status });
        },
      });
      startMetrics(sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker:${sessionId}] Failed to start:`, message);
      sendToSupervisor({ type: "error", sessionId, message });
      process.exit(1);
    }
  }

  if (msg.type === "stop") {
    console.log("[worker] Received stop command");
    stopMetrics();
    if (session) {
      await session.stop();
    }
    process.exit(0);
  }
});

// Handle unexpected errors
process.on("uncaughtException", (err) => {
  console.error("[worker] Uncaught exception:", err.message);
  sendToSupervisor({
    type: "error",
    sessionId: session?.sessionId ?? "unknown",
    message: err.message,
  });
  process.exit(1);
});
