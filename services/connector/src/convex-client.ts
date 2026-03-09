/**
 * Convex client for the connector worker.
 * Uses ConvexHttpClient (stateless, no WebSocket) since
 * the connector is a separate process, not a browser.
 *
 * All mutations include HMAC-SHA256 signed headers for authentication.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";
import { signPayload, type SignedHeaders } from "@ecqqo/shared";

export class ConnectorConvexClient {
  private client: ConvexHttpClient;
  private sessionId: Id<"waConnectSessions"> | null = null;
  private signingSecret: string | null;

  constructor(convexUrl: string) {
    this.client = new ConvexHttpClient(convexUrl);
    this.signingSecret = process.env.CONNECTOR_SIGNING_SECRET ?? null;
    if (!this.signingSecret) {
      console.warn(
        "[convex-client] CONNECTOR_SIGNING_SECRET not set — requests will be unsigned",
      );
    }
  }

  /** Sign a payload and return headers. Returns undefined if no secret configured. */
  private sign(payload: unknown): SignedHeaders | undefined {
    if (!this.signingSecret) return undefined;
    return signPayload(this.signingSecret, payload);
  }

  // ── Session lifecycle ──

  setSessionId(id: Id<"waConnectSessions">) {
    this.sessionId = id;
  }

  async createSession(): Promise<Id<"waConnectSessions">> {
    const args = {};
    const signed = this.sign(args);
    this.sessionId = await this.client.mutation(
      api.connector.createSession,
      { ...args, ...(signed && { _sig: signed }) },
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
    const args = {
      sessionId: this.sessionId,
      status,
      qrCode: opts?.qrCode,
      errorMessage: opts?.errorMessage,
    };
    const signed = this.sign(args);
    await this.client.mutation(api.connector.updateSessionStatus, {
      ...args,
      ...(signed && { _sig: signed }),
    });
  }

  async createAccount(info: {
    phoneNumber: string;
    pushName?: string;
    platform?: string;
  }) {
    if (!this.sessionId) throw new Error("No session created");
    const args = { sessionId: this.sessionId, ...info };
    const signed = this.sign(args);
    return await this.client.mutation(api.connector.createAccount, {
      ...args,
      ...(signed && { _sig: signed }),
    });
  }

  async updateAccountStatus(
    status: "pending" | "connected" | "disconnected" | "reconnect_required",
  ) {
    if (!this.sessionId) throw new Error("No session created");
    const args = { sessionId: this.sessionId, status };
    const signed = this.sign(args);
    await this.client.mutation(api.connector.updateAccountStatus, {
      ...args,
      ...(signed && { _sig: signed }),
    });
  }

  async heartbeat() {
    if (!this.sessionId) return;
    const args = { sessionId: this.sessionId };
    const signed = this.sign(args);
    await this.client.mutation(api.connector.heartbeat, {
      ...args,
      ...(signed && { _sig: signed }),
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
    const args = { sessionId: this.sessionId, messages };
    const signed = this.sign(args);
    return await this.client.mutation(api.connector.ingestMessages, {
      ...args,
      ...(signed && { _sig: signed }),
    });
  }

  getSessionId() {
    return this.sessionId;
  }

  async enqueueDeadLetter(
    messages: Array<{
      externalId: string;
      chatJid: string;
      senderJid: string;
      timestamp: number;
      type: string;
      text?: string;
      fromMe: boolean;
      pushName?: string;
      ingestionHash: string;
    }>,
    error: string,
  ) {
    if (!this.sessionId) throw new Error("No session created");
    await this.client.mutation(api.deadLetter.enqueue, {
      sessionId: this.sessionId,
      messages,
      error,
    });
  }

  // ── Machine lifecycle (used by supervisor) ──

  async registerMachine(info: {
    machineId: string;
    region: string;
    maxWorkers: number;
  }) {
    const signed = this.sign(info);
    await this.client.mutation(api.connector.registerMachine, {
      ...info,
      ...(signed && { _sig: signed }),
    });
  }

  async updateMachineHealth(info: {
    machineId: string;
    region: string;
    workerCount: number;
    maxWorkers: number;
    memoryUsageMB: number;
    status: "active" | "draining" | "offline";
  }) {
    const signed = this.sign(info);
    await this.client.mutation(api.connector.updateMachineHealth, {
      ...info,
      ...(signed && { _sig: signed }),
    });
  }

  async deregisterMachine(machineId: string) {
    const args = { machineId };
    const signed = this.sign(args);
    await this.client.mutation(api.connector.deregisterMachine, {
      ...args,
      ...(signed && { _sig: signed }),
    });
  }

  async assignSessionToMachine(
    sessionId: Id<"waConnectSessions">,
    machineId: string,
  ) {
    const args = { sessionId, machineId };
    const signed = this.sign(args);
    await this.client.mutation(api.connector.assignSessionToMachine, {
      ...args,
      ...(signed && { _sig: signed }),
    });
  }

  async cleanupStaleMachines() {
    const args = {};
    const signed = this.sign(args);
    return await this.client.mutation(api.connector.cleanupStaleMachines, {
      ...args,
      ...(signed && { _sig: signed }),
    });
  }
}
