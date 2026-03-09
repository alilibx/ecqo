import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/** Max retries for transient errors. Validation errors go straight to dead. */
const MAX_RETRIES_TRANSIENT = 5;
const MAX_RETRIES_UNKNOWN = 3;

/** Exponential backoff base: 5s, 25s, 125s, 625s, 3125s */
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MULTIPLIER = 5;
const JITTER_MAX_MS = 2_000;

function computeNextRetry(retryCount: number): number {
  const delay = BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount);
  const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
  return Date.now() + delay + jitter;
}

function classifyError(error: string): "transient" | "validation" | "unknown" {
  const lower = error.toLowerCase();

  // Validation errors — no point retrying
  if (
    lower.includes("validation") ||
    lower.includes("invalid") ||
    lower.includes("schema") ||
    lower.includes("not a valid")
  ) {
    return "validation";
  }

  // Transient errors — worth retrying
  if (
    lower.includes("timeout") ||
    lower.includes("rate limit") ||
    lower.includes("too many") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("503") ||
    lower.includes("overloaded")
  ) {
    return "transient";
  }

  return "unknown";
}

/**
 * Enqueue a failed message batch into the dead-letter queue.
 * Called by the connector when ingestMessages fails.
 */
export const enqueue = mutation({
  args: {
    sessionId: v.string(),
    messages: v.array(
      v.object({
        externalId: v.string(),
        chatJid: v.string(),
        senderJid: v.string(),
        timestamp: v.number(),
        type: v.string(),
        text: v.optional(v.string()),
        fromMe: v.boolean(),
        pushName: v.optional(v.string()),
        ingestionHash: v.string(),
      }),
    ),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const errorType = classifyError(args.error);
    const maxRetries =
      errorType === "validation"
        ? 0
        : errorType === "transient"
          ? MAX_RETRIES_TRANSIENT
          : MAX_RETRIES_UNKNOWN;

    // Find associated account
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    const status = maxRetries === 0 ? ("dead" as const) : ("pending" as const);

    return await ctx.db.insert("waDeadLetters", {
      waAccountId: account?._id,
      sessionId: args.sessionId,
      messages: args.messages,
      error: args.error,
      errorType,
      retryCount: 0,
      maxRetries,
      nextRetryAt: maxRetries > 0 ? computeNextRetry(0) : undefined,
      status,
      createdAt: Date.now(),
    });
  },
});

/**
 * Process pending retries. Called by cron job.
 */
export const processRetries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get pending items ready for retry
    const pending = await ctx.db
      .query("waDeadLetters")
      .withIndex("by_nextRetry", (q) => q.eq("status", "pending"))
      .collect();

    const ready = pending.filter(
      (dl) => dl.nextRetryAt && dl.nextRetryAt <= now,
    );

    let retried = 0;
    let exhausted = 0;

    for (const dl of ready) {
      // Find the account
      const account = dl.waAccountId
        ? await ctx.db.get(dl.waAccountId)
        : await ctx.db
            .query("waAccounts")
            .withIndex("by_sessionId", (q) =>
              q.eq("sessionId", dl.sessionId),
            )
            .unique();

      if (!account) {
        // Account gone — mark as dead
        await ctx.db.patch(dl._id, { status: "dead", resolvedAt: Date.now() });
        exhausted++;
        continue;
      }

      // Attempt re-ingestion
      await ctx.db.patch(dl._id, { status: "retrying" });

      try {
        let ingested = 0;
        let deduplicated = 0;

        for (const msg of dl.messages) {
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
            type: msg.type as any,
            text: msg.text,
            fromMe: msg.fromMe,
            pushName: msg.pushName,
            ingestionHash: msg.ingestionHash,
            ingestedAt: Date.now(),
          });

          // Upsert chat
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

        // Success — mark resolved
        await ctx.db.patch(dl._id, {
          status: "resolved",
          resolvedAt: Date.now(),
        });
        retried++;
      } catch (err) {
        const newRetryCount = dl.retryCount + 1;
        if (newRetryCount >= dl.maxRetries) {
          // Exhausted retries
          await ctx.db.patch(dl._id, {
            status: "dead",
            retryCount: newRetryCount,
            error: `${dl.error} | Retry ${newRetryCount}: ${String(err)}`,
            resolvedAt: Date.now(),
          });
          exhausted++;
        } else {
          // Schedule next retry
          await ctx.db.patch(dl._id, {
            status: "pending",
            retryCount: newRetryCount,
            nextRetryAt: computeNextRetry(newRetryCount),
            error: `${dl.error} | Retry ${newRetryCount}: ${String(err)}`,
          });
        }
      }
    }

    return { retried, exhausted, total: ready.length };
  },
});

// ── Dashboard queries ──

export const listDeadLetters = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("retrying"),
        v.literal("resolved"),
        v.literal("dead"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.status) {
      return await ctx.db
        .query("waDeadLetters")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("waDeadLetters")
      .order("desc")
      .take(limit);
  },
});

export const getDeadLetterStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("waDeadLetters").collect();

    return {
      pending: all.filter((dl) => dl.status === "pending").length,
      retrying: all.filter((dl) => dl.status === "retrying").length,
      resolved: all.filter((dl) => dl.status === "resolved").length,
      dead: all.filter((dl) => dl.status === "dead").length,
      total: all.length,
    };
  },
});

/**
 * Manually retry a dead-lettered batch.
 */
export const retryDeadLetter = mutation({
  args: { id: v.id("waDeadLetters") },
  handler: async (ctx, args) => {
    const dl = await ctx.db.get(args.id);
    if (!dl) throw new Error("Dead letter not found");
    if (dl.status === "resolved") throw new Error("Already resolved");

    await ctx.db.patch(dl._id, {
      status: "pending",
      retryCount: 0,
      maxRetries: Math.max(dl.maxRetries, 1),
      nextRetryAt: Date.now(), // Retry immediately on next cron tick
    });
  },
});
