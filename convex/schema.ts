import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    joinedAt: v.number(),
    verified: v.boolean(),
    verificationCode: v.string(),
    tokenExpiresAt: v.number(),
    position: v.number(), // 0 = pending verification
  })
    .index("by_email", ["email"])
    .index("by_position", ["position"]),

  // ── WhatsApp connector tables ──

  waAccounts: defineTable({
    sessionId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("connected"),
      v.literal("disconnected"),
      v.literal("reconnect_required"),
    ),
    phoneNumber: v.optional(v.string()),
    pushName: v.optional(v.string()),
    platform: v.optional(v.string()),
    connectedAt: v.optional(v.number()),
    disconnectedAt: v.optional(v.number()),
    lastHeartbeat: v.optional(v.number()),
    machineId: v.optional(v.string()),
  }).index("by_sessionId", ["sessionId"]),

  waConnectSessions: defineTable({
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
    retryCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    machineId: v.optional(v.string()),
  }).index("by_status", ["status"]),

  waMachines: defineTable({
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
    lastHealthAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_machineId", ["machineId"]),

  waMessages: defineTable({
    waAccountId: v.id("waAccounts"),
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
    ingestedAt: v.number(),
  })
    .index("by_ingestionHash", ["ingestionHash"])
    .index("by_chat", ["waAccountId", "chatJid", "timestamp"])
    .index("by_account", ["waAccountId", "timestamp"]),

  waChats: defineTable({
    waAccountId: v.id("waAccounts"),
    chatJid: v.string(),
    chatName: v.optional(v.string()),
    isGroup: v.boolean(),
    lastMessageAt: v.optional(v.number()),
    messageCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_account_chat", ["waAccountId", "chatJid"])
    .index("by_account", ["waAccountId"]),
});
