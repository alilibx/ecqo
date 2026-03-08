/**
 * Convex client for the connector worker.
 * Uses ConvexHttpClient (stateless, no WebSocket) since
 * the connector is a separate process, not a browser.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";

export class ConnectorConvexClient {
  private client: ConvexHttpClient;
  private sessionId: Id<"waConnectSessions"> | null = null;

  constructor(convexUrl: string) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  // ── Session lifecycle ──

  setSessionId(id: Id<"waConnectSessions">) {
    this.sessionId = id;
  }

  async createSession(): Promise<Id<"waConnectSessions">> {
    this.sessionId = await this.client.mutation(
      api.connector.createSession,
      {},
    );
    console.log(`   Session: ${this.sessionId}`);
    return this.sessionId;
  }

  async updateSessionStatus(
    status:
      | "created"
      | "qr_ready"
      | "scanned"
      | "connected"
      | "expired"
      | "failed"
      | "retry_pending"
      | "disconnected",
    opts?: { qrCode?: string; errorMessage?: string },
  ) {
    if (!this.sessionId) throw new Error("No session created");
    await this.client.mutation(api.connector.updateSessionStatus, {
      sessionId: this.sessionId,
      status,
      qrCode: opts?.qrCode,
      errorMessage: opts?.errorMessage,
    });
  }

  async createAccount(info: {
    phoneNumber: string;
    pushName?: string;
    platform?: string;
  }) {
    if (!this.sessionId) throw new Error("No session created");
    return await this.client.mutation(api.connector.createAccount, {
      sessionId: this.sessionId,
      ...info,
    });
  }

  async updateAccountStatus(
    status: "pending" | "connected" | "disconnected" | "reconnect_required",
  ) {
    if (!this.sessionId) throw new Error("No session created");
    await this.client.mutation(api.connector.updateAccountStatus, {
      sessionId: this.sessionId,
      status,
    });
  }

  async heartbeat() {
    if (!this.sessionId) return;
    await this.client.mutation(api.connector.heartbeat, {
      sessionId: this.sessionId,
    });
  }

  async ingestMessages(
    messages: Array<{
      externalId: string;
      chatJid: string;
      senderJid: string;
      timestamp: number;
      type:
        | "text"
        | "image"
        | "video"
        | "audio"
        | "document"
        | "sticker"
        | "location"
        | "contact"
        | "reaction"
        | "other";
      text?: string;
      fromMe: boolean;
      pushName?: string;
      ingestionHash: string;
    }>,
  ) {
    if (!this.sessionId) throw new Error("No session created");
    return await this.client.mutation(api.connector.ingestMessages, {
      sessionId: this.sessionId,
      messages,
    });
  }

  getSessionId() {
    return this.sessionId;
  }

  // ── Machine lifecycle (used by supervisor) ──

  async registerMachine(info: {
    machineId: string;
    region: string;
    maxWorkers: number;
  }) {
    await this.client.mutation(api.connector.registerMachine, info);
  }

  async updateMachineHealth(info: {
    machineId: string;
    region: string;
    workerCount: number;
    maxWorkers: number;
    memoryUsageMB: number;
    status: "active" | "draining" | "offline";
  }) {
    await this.client.mutation(api.connector.updateMachineHealth, info);
  }

  async deregisterMachine(machineId: string) {
    await this.client.mutation(api.connector.deregisterMachine, { machineId });
  }
}
