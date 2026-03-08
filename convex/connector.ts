import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Mutations called by the connector via ConvexHttpClient ──

export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sessionId = await ctx.db.insert("waConnectSessions", {
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
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!account) {
      throw new Error(`No account found for session ${args.sessionId}`);
    }

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

      await ctx.db.insert("waMessages", {
        waAccountId: account._id,
        externalId: msg.externalId,
        chatJid: msg.chatJid,
        senderJid: msg.senderJid,
        timestamp: msg.timestamp,
        type: msg.type,
        text: msg.text,
        fromMe: msg.fromMe,
        pushName: msg.pushName,
        ingestionHash: msg.ingestionHash,
        ingestedAt: Date.now(),
      });

      // Upsert chat metadata
      const existingChat = await ctx.db
        .query("waChats")
        .withIndex("by_account_chat", (q) =>
          q.eq("waAccountId", account._id).eq("chatJid", msg.chatJid),
        )
        .unique();

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

      ingested++;
    }

    return { ingested, deduplicated };
  },
});

// ── Queries for dashboard / debugging ──

export const getSession = query({
  args: { sessionId: v.id("waConnectSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    // Get the most recent non-terminal session
    const sessions = await ctx.db
      .query("waConnectSessions")
      .order("desc")
      .take(10);

    return (
      sessions.find((s) =>
        ["created", "qr_ready", "scanned", "connected"].includes(s.status),
      ) ?? null
    );
  },
});

export const getAccount = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
  },
});

export const listChats = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!account) return [];

    return await ctx.db
      .query("waChats")
      .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
      .collect();
  },
});

export const listMessages = query({
  args: {
    sessionId: v.string(),
    chatJid: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

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
