/**
 * Typed IPC message protocol between supervisor and worker processes.
 *
 * Supervisor forks workers via child_process.fork() and communicates
 * over the built-in Node.js IPC channel (process.send / process.on("message")).
 */

import type { Id } from "../../../convex/_generated/dataModel.js";

// ── Supervisor → Worker ──

export type SupervisorToWorker =
  | { type: "start"; sessionId: Id<"waConnectSessions">; convexUrl: string }
  | { type: "stop" };

// ── Worker → Supervisor ──

export type ConnectSessionStatus =
  | "created"
  | "qr_ready"
  | "scanned"
  | "connected"
  | "expired"
  | "failed"
  | "retry_pending"
  | "disconnected";

export type WorkerToSupervisor =
  | { type: "status"; sessionId: string; status: ConnectSessionStatus }
  | { type: "error"; sessionId: string; message: string }
  | { type: "metrics"; sessionId: string; memoryMB: number }
  | { type: "ready" };

export function sendToSupervisor(msg: WorkerToSupervisor): void {
  if (process.send) {
    process.send(msg);
  }
}
