import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUser, requireRole } from "./users";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  ingestPerAccount: { kind: "fixed window", rate: 60, period: MINUTE },
});

// ── Signature verification ──

const sigValidator = v.optional(
  v.object({
    signature: v.string(),
    timestamp: v.number(),
    nonce: v.string(),
  }),
);

/**
 * Async HMAC verification using Web Crypto API (available in Convex runtime).
 */
async function verifySignatureAsync(
  args: Record<string, unknown>,
): Promise<void> {
  const secret = process.env.CONNECTOR_SIGNING_SECRET;
  if (!secret) return; // Dev mode — no verification

  const sig = args._sig as
    | { signature: string; timestamp: number; nonce: string }
    | undefined;

  if (!sig) {
    throw new Error("Missing request signature");
  }

  // Check timestamp freshness
  const maxAgeMs = 5 * 60_000;
  const now = Date.now();
  const age = Math.abs(now - sig.timestamp);
  if (age > maxAgeMs) {
    throw new Error(`Request expired (age: ${age}ms)`);
  }

  // Build payload without _sig
  const payload: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(args)) {
    if (k !== "_sig") payload[k] = val;
  }

  const body = JSON.stringify(payload);
  const message = `${body}.${sig.timestamp}.${sig.nonce}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expectedBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  const expectedHex = Array.from(new Uint8Array(expectedBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex !== sig.signature) {
    throw new Error("Invalid request signature");
  }
}

// ── Mutations called by the connector via ConvexHttpClient ──

export const createSession = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    const now = Date.now();
    const sessionId = await ctx.db.insert("waConnectSessions", {
      workspaceId: args.workspaceId,
      status: "created",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 60_000, // 60s QR timeout
    });
    return sessionId;
  },
});

export const updateSessionStatus = mutation({
  args: {
    sessionId: v.id("waConnectSessions"),
    status: v.union(
      v.literal("created"),
      v.literal("qr_ready"),
      v.literal("scanned"),
      v.literal("connected"),
      v.literal("expired"),
      v.literal("failed"),
      v.literal("retry_pending"),
      v.literal("disconnected"),
    ),
    qrCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    await ctx.db.patch(args.sessionId, {
      status: args.status,
      updatedAt: Date.now(),
      ...(args.qrCode !== undefined && { qrCode: args.qrCode }),
      ...(args.errorMessage !== undefined && {
        errorMessage: args.errorMessage,
      }),
    });
  },
});

export const createAccount = mutation({
  args: {
    sessionId: v.string(),
    phoneNumber: v.string(),
    pushName: v.optional(v.string()),
    platform: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    // Check if account already exists for this session
    const existing = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "connected",
        phoneNumber: args.phoneNumber,
        pushName: args.pushName,
        platform: args.platform,
        connectedAt: Date.now(),
        disconnectedAt: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("waAccounts", {
      workspaceId: args.workspaceId,
      sessionId: args.sessionId,
      status: "connected",
      phoneNumber: args.phoneNumber,
      pushName: args.pushName,
      platform: args.platform,
      connectedAt: Date.now(),
    });
  },
});

export const updateAccountStatus = mutation({
  args: {
    sessionId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("connected"),
      v.literal("disconnected"),
      v.literal("reconnect_required"),
    ),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!account) return;

    await ctx.db.patch(account._id, {
      status: args.status,
      ...(args.status === "disconnected" && { disconnectedAt: Date.now() }),
    });
  },
});

export const heartbeat = mutation({
  args: {
    sessionId: v.string(),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!account) return;

    await ctx.db.patch(account._id, {
      lastHeartbeat: Date.now(),
    });
  },
});

export const ingestMessages = mutation({
  args: {
    sessionId: v.string(),
    messages: v.array(
      v.object({
        externalId: v.string(),
        chatJid: v.string(),
        senderJid: v.string(),
        timestamp: v.number(),
        type: v.union(
          v.literal("text"),
          v.literal("image"),
          v.literal("video"),
          v.literal("audio"),
          v.literal("document"),
          v.literal("sticker"),
          v.literal("location"),
          v.literal("contact"),
          v.literal("reaction"),
          v.literal("other"),
        ),
        text: v.optional(v.string()),
        fromMe: v.boolean(),
        pushName: v.optional(v.string()),
        ingestionHash: v.string(),
      }),
    ),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!account) {
      throw new Error(`No account found for session ${args.sessionId}`);
    }

    // Enforce 60 req/min per account
    await rateLimiter.limit(ctx, "ingestPerAccount", {
      key: account._id,
      throws: true,
    });

    let ingested = 0;
    let deduplicated = 0;

    for (const msg of args.messages) {
      // Dedup by ingestionHash
      const existing = await ctx.db
        .query("waMessages")
        .withIndex("by_ingestionHash", (q) =>
          q.eq("ingestionHash", msg.ingestionHash),
        )
        .unique();

      if (existing) {
        deduplicated++;
        continue;
      }

      // Upsert chat metadata (before message insert to check content policy)
      const existingChat = await ctx.db
        .query("waChats")
        .withIndex("by_account_chat", (q) =>
          q.eq("waAccountId", account._id).eq("chatJid", msg.chatJid),
        )
        .unique();

      const chatPolicy = existingChat?.contentPolicy ?? "metadata";

      if (existingChat) {
        await ctx.db.patch(existingChat._id, {
          lastMessageAt: Math.max(
            existingChat.lastMessageAt ?? 0,
            msg.timestamp,
          ),
          messageCount: existingChat.messageCount + 1,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("waChats", {
          waAccountId: account._id,
          chatJid: msg.chatJid,
          isGroup: msg.chatJid.endsWith("@g.us"),
          lastMessageAt: msg.timestamp,
          messageCount: 1,
          updatedAt: Date.now(),
        });
      }

      // Enforce content policy: only store message body for allowlisted chats
      await ctx.db.insert("waMessages", {
        waAccountId: account._id,
        externalId: msg.externalId,
        chatJid: msg.chatJid,
        senderJid: msg.senderJid,
        timestamp: msg.timestamp,
        type: msg.type,
        text: chatPolicy === "full" ? msg.text : undefined,
        fromMe: msg.fromMe,
        pushName: msg.pushName,
        ingestionHash: msg.ingestionHash,
        ingestedAt: Date.now(),
      });

      ingested++;
    }

    return { ingested, deduplicated };
  },
});

// ── Machine lifecycle mutations (called by supervisor) ──

export const registerMachine = mutation({
  args: {
    machineId: v.string(),
    region: v.string(),
    maxWorkers: v.number(),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    const existing = await ctx.db
      .query("waMachines")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        region: args.region,
        maxWorkers: args.maxWorkers,
        status: "active",
        workerCount: 0,
        memoryUsageMB: 0,
        lastHealthAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("waMachines", {
      machineId: args.machineId,
      region: args.region,
      workerCount: 0,
      maxWorkers: args.maxWorkers,
      memoryUsageMB: 0,
      status: "active",
      lastHealthAt: Date.now(),
    });
  },
});

export const updateMachineHealth = mutation({
  args: {
    machineId: v.string(),
    region: v.string(),
    workerCount: v.number(),
    maxWorkers: v.number(),
    memoryUsageMB: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("draining"),
      v.literal("offline"),
    ),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    const machine = await ctx.db
      .query("waMachines")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .unique();

    if (!machine) {
      // Auto-register if not found
      await ctx.db.insert("waMachines", {
        machineId: args.machineId,
        region: args.region,
        workerCount: args.workerCount,
        maxWorkers: args.maxWorkers,
        memoryUsageMB: args.memoryUsageMB,
        status: args.status,
        lastHealthAt: Date.now(),
      });
      return;
    }

    await ctx.db.patch(machine._id, {
      workerCount: args.workerCount,
      maxWorkers: args.maxWorkers,
      memoryUsageMB: args.memoryUsageMB,
      status: args.status,
      lastHealthAt: Date.now(),
    });
  },
});

export const deregisterMachine = mutation({
  args: {
    machineId: v.string(),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    const machine = await ctx.db
      .query("waMachines")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .unique();

    if (machine) {
      await ctx.db.patch(machine._id, { status: "offline" });
    }
  },
});

export const cleanupStaleMachines = mutation({
  args: {
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    const staleThreshold = Date.now() - 2 * 60_000; // 2 minutes
    const machines = await ctx.db.query("waMachines").collect();

    let cleaned = 0;
    for (const machine of machines) {
      if (
        machine.status !== "offline" &&
        machine.lastHealthAt < staleThreshold
      ) {
        await ctx.db.patch(machine._id, {
          status: "offline",
          workerCount: 0,
        });
        cleaned++;
      }
    }
    return cleaned;
  },
});

export const getAvailableMachine = query({
  args: {},
  handler: async (ctx) => {
    const machines = await ctx.db
      .query("waMachines")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    if (!machines.length) return null;

    // Return machine with lowest worker count that has capacity
    return machines
      .filter((m) => m.workerCount < m.maxWorkers)
      .sort((a, b) => a.workerCount - b.workerCount)[0] ?? null;
  },
});

export const assignSessionToMachine = mutation({
  args: {
    sessionId: v.id("waConnectSessions"),
    machineId: v.string(),
    _sig: sigValidator,
  },
  handler: async (ctx, args) => {
    await verifySignatureAsync(args as Record<string, unknown>);
    await ctx.db.patch(args.sessionId, { machineId: args.machineId });
  },
});

// ── Mutations for dashboard (RBAC-protected) ──

/** Update a chat's content policy. Requires owner or principal role. */
export const updateChatContentPolicy = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    chatId: v.id("waChats"),
    contentPolicy: v.union(
      v.literal("metadata"),
      v.literal("full"),
      v.literal("denied"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, args.workspaceId, [
      "owner",
      "principal",
    ]);

    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");

    // Verify chat belongs to this workspace
    const account = await ctx.db.get(chat.waAccountId);
    if (!account || account.workspaceId !== args.workspaceId) {
      throw new Error("Forbidden: chat belongs to another workspace");
    }

    await ctx.db.patch(args.chatId, {
      contentPolicy: args.contentPolicy,
      updatedAt: Date.now(),
    });
  },
});

// ── Queries for dashboard (RBAC-protected) ──

export const getSession = query({
  args: {
    sessionId: v.id("waConnectSessions"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, args.workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);
    const session = await ctx.db.get(args.sessionId);
    if (session && session.workspaceId !== args.workspaceId) {
      throw new Error("Forbidden: session belongs to another workspace");
    }
    return session;
  },
});

export const getActiveSession = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, args.workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);
    const sessions = await ctx.db
      .query("waConnectSessions")
      .order("desc")
      .take(50);

    return (
      sessions.find(
        (s) =>
          s.workspaceId === args.workspaceId &&
          ["created", "qr_ready", "scanned", "connected"].includes(s.status),
      ) ?? null
    );
  },
});

export const getAccount = query({
  args: {
    sessionId: v.string(),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, args.workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (account && account.workspaceId !== args.workspaceId) {
      throw new Error("Forbidden: account belongs to another workspace");
    }
    return account;
  },
});

export const listChats = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, args.workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();

    if (!account) return [];

    return await ctx.db
      .query("waChats")
      .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
      .collect();
  },
});

export const listMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    chatJid: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, args.workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();

    if (!account) return [];

    const limit = args.limit ?? 50;

    if (args.chatJid) {
      return await ctx.db
        .query("waMessages")
        .withIndex("by_chat", (q) =>
          q.eq("waAccountId", account._id).eq("chatJid", args.chatJid!),
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("waMessages")
      .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
      .order("desc")
      .take(limit);
  },
});
