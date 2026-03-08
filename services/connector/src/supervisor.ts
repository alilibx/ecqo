/**
 * Multi-user supervisor process.
 *
 * Manages isolated WhatsApp worker processes via child_process.fork().
 * Exposes an HTTP API for session lifecycle and health monitoring.
 * Reports machine health to Convex for the control plane.
 */

import { fork, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { ConnectorConvexClient } from "./convex-client.js";
import type {
  SupervisorToWorker,
  WorkerToSupervisor,
  ConnectSessionStatus,
} from "./ipc-protocol.js";

// ── Config ──

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const CONVEX_URL = process.env.CONVEX_URL!;
const MAX_WORKERS = parseInt(process.env.MAX_WORKERS ?? "20", 10);
const MEMORY_THRESHOLD = 0.8; // refuse new workers above 80% memory
const HEALTH_REPORT_INTERVAL_MS = 30_000;
const MACHINE_ID = process.env.FLY_MACHINE_ID ?? os.hostname();
const REGION = process.env.FLY_REGION ?? "local";

// ── Worker tracking ──

interface WorkerInfo {
  process: ChildProcess;
  sessionId: string;
  startedAt: number;
  status: ConnectSessionStatus;
  memoryMB: number;
  restartCount: number;
}

const workers = new Map<string, WorkerInfo>();

// Path to worker entry point (resolved relative to this file)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT = path.join(__dirname, "worker.ts");

// ── Convex client for machine lifecycle (initialized in startSupervisor) ──

let convex: ConnectorConvexClient;

// ── Worker management ──

function getSystemMemoryUsage(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return (total - free) / total;
}

function canAcceptWorker(): { ok: boolean; reason?: string } {
  if (workers.size >= MAX_WORKERS) {
    return { ok: false, reason: `At max capacity (${MAX_WORKERS} workers)` };
  }
  const memUsage = getSystemMemoryUsage();
  if (memUsage > MEMORY_THRESHOLD) {
    return {
      ok: false,
      reason: `Memory too high (${(memUsage * 100).toFixed(0)}%)`,
    };
  }
  return { ok: true };
}

function spawnWorker(sessionId: string): WorkerInfo {
  const child = fork(WORKER_SCRIPT, [], {
    execArgv: ["--import", "tsx"],
    stdio: ["pipe", "inherit", "inherit", "ipc"],
    env: {
      ...process.env,
      // Worker inherits CONVEX_URL, AUTH_DIR, etc.
    },
  });

  const info: WorkerInfo = {
    process: child,
    sessionId,
    startedAt: Date.now(),
    status: "created",
    memoryMB: 0,
    restartCount: 0,
  };

  // Handle IPC messages from worker
  child.on("message", (msg: WorkerToSupervisor) => {
    if (msg.type === "ready") {
      // Worker process is initialized, send start command
      const startMsg: SupervisorToWorker = {
        type: "start",
        sessionId: sessionId as any,
        convexUrl: CONVEX_URL,
      };
      child.send(startMsg);
    } else if (msg.type === "status") {
      info.status = msg.status;
      console.log(`[supervisor] Worker ${sessionId}: ${msg.status}`);
    } else if (msg.type === "error") {
      console.error(`[supervisor] Worker ${sessionId} error: ${msg.message}`);
    } else if (msg.type === "metrics") {
      info.memoryMB = msg.memoryMB;
    }
  });

  // Handle worker exit
  child.on("exit", (code, signal) => {
    console.log(
      `[supervisor] Worker ${sessionId} exited (code=${code}, signal=${signal})`,
    );

    const existing = workers.get(sessionId);
    if (!existing) return;

    // Auto-restart on unexpected exits (up to 3 times)
    if (code !== 0 && existing.restartCount < 3) {
      console.log(
        `[supervisor] Restarting worker ${sessionId} (attempt ${existing.restartCount + 1}/3)`,
      );
      workers.delete(sessionId);
      const restarted = spawnWorker(sessionId);
      restarted.restartCount = existing.restartCount + 1;
      workers.set(sessionId, restarted);
    } else {
      workers.delete(sessionId);
    }
  });

  return info;
}

function stopWorker(sessionId: string): boolean {
  const info = workers.get(sessionId);
  if (!info) return false;

  const stopMsg: SupervisorToWorker = { type: "stop" };
  info.process.send(stopMsg);

  // Force kill after 5s if graceful stop doesn't work
  setTimeout(() => {
    if (info.process.exitCode === null) {
      console.log(`[supervisor] Force killing worker ${sessionId}`);
      info.process.kill("SIGKILL");
    }
  }, 5000);

  return true;
}

// ── HTTP API ──

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const method = req.method ?? "GET";

  try {
    // GET /health
    if (method === "GET" && url.pathname === "/health") {
      const memUsage = getSystemMemoryUsage();
      return json(res, 200, {
        status: "ok",
        machineId: MACHINE_ID,
        region: REGION,
        workers: workers.size,
        maxWorkers: MAX_WORKERS,
        memoryUsagePercent: Math.round(memUsage * 100),
        memoryTotalMB: Math.round(os.totalmem() / 1024 / 1024),
        memoryFreeMB: Math.round(os.freemem() / 1024 / 1024),
        uptime: process.uptime(),
      });
    }

    // GET /sessions
    if (method === "GET" && url.pathname === "/sessions") {
      const sessions = Array.from(workers.entries()).map(([id, info]) => ({
        sessionId: id,
        status: info.status,
        startedAt: info.startedAt,
        memoryMB: info.memoryMB,
        restartCount: info.restartCount,
        uptimeMs: Date.now() - info.startedAt,
      }));
      return json(res, 200, { sessions });
    }

    // POST /sessions — create a new session in Convex and spawn a worker
    if (method === "POST" && url.pathname === "/sessions") {
      const check = canAcceptWorker();
      if (!check.ok) {
        return json(res, 503, { error: check.reason });
      }

      const sessionId = await convex.createSession();
      const info = spawnWorker(sessionId);
      workers.set(sessionId, info);

      return json(res, 201, {
        sessionId,
        machineId: MACHINE_ID,
        status: "starting",
      });
    }

    // POST /sessions/:id/start — spawn a worker for an existing session
    const startMatch = url.pathname.match(/^\/sessions\/([^/]+)\/start$/);
    if (method === "POST" && startMatch) {
      const sessionId = decodeURIComponent(startMatch[1]);

      if (workers.has(sessionId)) {
        return json(res, 409, { error: "Session already running" });
      }

      const check = canAcceptWorker();
      if (!check.ok) {
        return json(res, 503, { error: check.reason });
      }

      const info = spawnWorker(sessionId);
      workers.set(sessionId, info);

      return json(res, 201, {
        sessionId,
        machineId: MACHINE_ID,
        status: "starting",
      });
    }

    // DELETE /sessions/:id/stop
    const stopMatch = url.pathname.match(/^\/sessions\/([^/]+)\/stop$/);
    if (method === "DELETE" && stopMatch) {
      const sessionId = decodeURIComponent(stopMatch[1]);

      if (!stopWorker(sessionId)) {
        return json(res, 404, { error: "Session not found" });
      }

      return json(res, 200, { sessionId, status: "stopping" });
    }

    // GET /sessions/:id
    const getMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
    if (method === "GET" && getMatch) {
      const sessionId = decodeURIComponent(getMatch[1]);
      const info = workers.get(sessionId);
      if (!info) {
        return json(res, 404, { error: "Session not found" });
      }
      return json(res, 200, {
        sessionId,
        status: info.status,
        startedAt: info.startedAt,
        memoryMB: info.memoryMB,
        restartCount: info.restartCount,
        uptimeMs: Date.now() - info.startedAt,
      });
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[supervisor] Request error:", err);
    json(res, 500, {
      error: err instanceof Error ? err.message : "Internal error",
    });
  }
});

// ── Machine health reporting ──

let healthTimer: ReturnType<typeof setInterval> | null = null;

async function reportHealth() {
  try {
    const totalWorkerMemory = Array.from(workers.values()).reduce(
      (sum, w) => sum + w.memoryMB,
      0,
    );
    await convex.updateMachineHealth({
      machineId: MACHINE_ID,
      region: REGION,
      workerCount: workers.size,
      maxWorkers: MAX_WORKERS,
      memoryUsageMB: totalWorkerMemory,
      status: "active",
    });
  } catch (err) {
    console.error("[supervisor] Health report failed:", err);
  }
}

// ── Lifecycle ──

export async function startSupervisor() {
  if (!CONVEX_URL) {
    console.error("CONVEX_URL environment variable is required");
    process.exit(1);
  }

  convex = new ConnectorConvexClient(CONVEX_URL);

  console.log(`🟢 Supervisor starting on port ${PORT}`);
  console.log(`   Machine: ${MACHINE_ID} (${REGION})`);
  console.log(`   Max workers: ${MAX_WORKERS}`);
  console.log(`   Convex: ${CONVEX_URL}`);

  // Register machine in Convex
  try {
    await convex.registerMachine({
      machineId: MACHINE_ID,
      region: REGION,
      maxWorkers: MAX_WORKERS,
    });
    console.log("   Registered with Convex");
  } catch (err) {
    console.error("   Failed to register machine:", err);
  }

  // Start health reporting
  healthTimer = setInterval(reportHealth, HEALTH_REPORT_INTERVAL_MS);

  // Start HTTP server
  server.listen(PORT, () => {
    console.log(`   HTTP API listening on :${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🔴 Supervisor shutting down...");

    // Stop health reporting
    if (healthTimer) clearInterval(healthTimer);

    // Stop all workers
    const stopPromises = Array.from(workers.keys()).map((id) => {
      stopWorker(id);
      return new Promise<void>((resolve) => {
        const info = workers.get(id);
        if (info?.process) {
          info.process.on("exit", () => resolve());
          setTimeout(resolve, 6000); // fallback timeout
        } else {
          resolve();
        }
      });
    });
    await Promise.all(stopPromises);

    // Deregister machine
    try {
      await convex.deregisterMachine(MACHINE_ID);
    } catch {
      // Best effort
    }

    server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
