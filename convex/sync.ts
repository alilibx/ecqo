import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { getUser, requireRole } from "./users";

/** Max time a job can be "running" before being marked failed. */
const JOB_TIMEOUT_MS = 5 * 60_000;

/** Thresholds for health status computation. */
const HEALTHY_THRESHOLD_MS = 10 * 60_000;
const STALE_THRESHOLD_MS = 15 * 60_000;

// ── Sync Job lifecycle ──

/**
 * Create a sync job for an account. Enforces at-most-one running job per account.
 * Returns the job ID, or null if a job is already running.
 */
export const createSyncJob = internalMutation({
  args: { waAccountId: v.id("waAccounts") },
  handler: async (ctx, { waAccountId }) => {
    // Check for existing running job
    const running = await ctx.db
      .query("waSyncJobs")
      .withIndex("by_waAccountId", (q) => q.eq("waAccountId", waAccountId))
      .filter((q) => q.eq(q.field("status"), "running"))
      .first();

    if (running) return null;

    return await ctx.db.insert("waSyncJobs", {
      waAccountId,
      status: "running",
      startedAt: Date.now(),
      messagesProcessed: 0,
      errors: [],
    });
  },
});

/** Mark a sync job as completed. */
export const completeSyncJob = internalMutation({
  args: {
    syncJobId: v.id("waSyncJobs"),
    messagesProcessed: v.number(),
  },
  handler: async (ctx, { syncJobId, messagesProcessed }) => {
    const job = await ctx.db.get(syncJobId);
    if (!job || job.status !== "running") return;

    await ctx.db.patch(syncJobId, {
      status: "completed",
      completedAt: Date.now(),
      messagesProcessed,
    });
  },
});

/** Mark a sync job as failed. */
export const failSyncJob = internalMutation({
  args: {
    syncJobId: v.id("waSyncJobs"),
    error: v.string(),
  },
  handler: async (ctx, { syncJobId, error }) => {
    const job = await ctx.db.get(syncJobId);
    if (!job || job.status !== "running") return;

    await ctx.db.patch(syncJobId, {
      status: "failed",
      completedAt: Date.now(),
      errors: [...job.errors, error],
    });
  },
});

// ── Cursor management ──

/**
 * Advance the sync cursor for a chat. Only moves forward (monotonic).
 */
export const advanceCursor = internalMutation({
  args: {
    waAccountId: v.id("waAccounts"),
    chatExternalId: v.string(),
    lastMessageTimestamp: v.number(),
    syncJobId: v.optional(v.id("waSyncJobs")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("waSyncCursors")
      .withIndex("by_waAccountId_chatExternalId", (q) =>
        q
          .eq("waAccountId", args.waAccountId)
          .eq("chatExternalId", args.chatExternalId),
      )
      .unique();

    if (existing) {
      // Only advance forward
      if (args.lastMessageTimestamp > existing.lastMessageTimestamp) {
        await ctx.db.patch(existing._id, {
          lastMessageTimestamp: args.lastMessageTimestamp,
          lastSyncJobId: args.syncJobId,
        });
      }
    } else {
      await ctx.db.insert("waSyncCursors", {
        waAccountId: args.waAccountId,
        chatExternalId: args.chatExternalId,
        lastMessageTimestamp: args.lastMessageTimestamp,
        lastSyncJobId: args.syncJobId,
      });
    }
  },
});

/** Get cursor for a specific chat. */
export const getCursor = internalQuery({
  args: {
    waAccountId: v.id("waAccounts"),
    chatExternalId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waSyncCursors")
      .withIndex("by_waAccountId_chatExternalId", (q) =>
        q
          .eq("waAccountId", args.waAccountId)
          .eq("chatExternalId", args.chatExternalId),
      )
      .unique();
  },
});

/** Get all cursors for an account. */
export const getCursorsForAccount = internalQuery({
  args: { waAccountId: v.id("waAccounts") },
  handler: async (ctx, { waAccountId }) => {
    return await ctx.db
      .query("waSyncCursors")
      .withIndex("by_waAccountId_chatExternalId", (q) =>
        q.eq("waAccountId", waAccountId),
      )
      .collect();
  },
});

// ── Scheduled functions ──

/**
 * Periodic sync trigger. Called every 5 minutes by cron.
 * Creates a sync job for each connected account that doesn't already have one running.
 */
export const triggerPeriodicSync = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("waAccounts")
      .filter((q) => q.eq(q.field("status"), "connected"))
      .collect();

    let triggered = 0;

    for (const account of accounts) {
      // Enforce at-most-one running job per account
      const running = await ctx.db
        .query("waSyncJobs")
        .withIndex("by_waAccountId", (q) => q.eq("waAccountId", account._id))
        .filter((q) => q.eq(q.field("status"), "running"))
        .first();

      if (running) continue;

      await ctx.db.insert("waSyncJobs", {
        waAccountId: account._id,
        status: "running",
        startedAt: Date.now(),
        messagesProcessed: 0,
        errors: [],
      });

      triggered++;
    }

    return { triggered, total: accounts.length };
  },
});

/**
 * Detect and fail stale sync jobs (running > 5 minutes).
 * Called every 5 minutes by cron.
 */
export const failStaleJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - JOB_TIMEOUT_MS;

    const runningJobs = await ctx.db
      .query("waSyncJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    let failed = 0;
    for (const job of runningJobs) {
      if (job.startedAt < cutoff) {
        await ctx.db.patch(job._id, {
          status: "failed",
          completedAt: Date.now(),
          errors: [
            ...job.errors,
            `Timeout: job exceeded ${JOB_TIMEOUT_MS / 60_000}-minute SLA`,
          ],
        });
        failed++;
      }
    }

    return { failed };
  },
});

/**
 * Nightly reconciliation. Validates cursor consistency and rebuilds if needed.
 * Called once daily by cron.
 */
export const nightlyReconciliation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("waAccounts")
      .filter((q) => q.eq(q.field("status"), "connected"))
      .collect();

    let reconciled = 0;

    for (const account of accounts) {
      // Get all chats for this account
      const chats = await ctx.db
        .query("waChats")
        .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
        .collect();

      for (const chat of chats) {
        // Find the latest message timestamp for this chat
        const latestMessage = await ctx.db
          .query("waMessages")
          .withIndex("by_chat", (q) =>
            q.eq("waAccountId", account._id).eq("chatJid", chat.chatJid),
          )
          .order("desc")
          .first();

        if (!latestMessage) continue;

        // Get current cursor
        const cursor = await ctx.db
          .query("waSyncCursors")
          .withIndex("by_waAccountId_chatExternalId", (q) =>
            q
              .eq("waAccountId", account._id)
              .eq("chatExternalId", chat.chatJid),
          )
          .unique();

        // Reconcile: cursor should match latest message timestamp
        if (!cursor) {
          await ctx.db.insert("waSyncCursors", {
            waAccountId: account._id,
            chatExternalId: chat.chatJid,
            lastMessageTimestamp: latestMessage.timestamp,
          });
          reconciled++;
        } else if (cursor.lastMessageTimestamp < latestMessage.timestamp) {
          await ctx.db.patch(cursor._id, {
            lastMessageTimestamp: latestMessage.timestamp,
          });
          reconciled++;
        }
      }
    }

    return { reconciled, accounts: accounts.length };
  },
});

// ── Dashboard queries (RBAC-protected) ──

type SyncHealthStatus = "syncing" | "healthy" | "degraded" | "stale" | "error";

function computeHealthStatus(
  latestJob: { status: string; startedAt: number; completedAt?: number; errors: string[] } | null,
  hasPendingDLQ: boolean,
  accountConnected: boolean,
): SyncHealthStatus {
  const now = Date.now();

  if (!latestJob) {
    // No sync has ever run
    return accountConnected ? "stale" : "error";
  }

  if (latestJob.status === "running") {
    return "syncing";
  }

  const completedAt = latestJob.completedAt ?? latestJob.startedAt;
  const age = now - completedAt;

  if (latestJob.status === "failed") {
    // Recent failure
    if (age < STALE_THRESHOLD_MS) return "degraded";
    return "error";
  }

  // Job completed
  if (age > STALE_THRESHOLD_MS) {
    return accountConnected ? "stale" : "error";
  }

  if (age > HEALTHY_THRESHOLD_MS || hasPendingDLQ || latestJob.errors.length > 0) {
    return "degraded";
  }

  return "healthy";
}

/**
 * Get sync health status for all accounts in a workspace.
 * Returns per-account health signals for the dashboard.
 */
export const getSyncHealth = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);

    const accounts = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const results = [];

    for (const account of accounts) {
      // Get latest sync job
      const jobs = await ctx.db
        .query("waSyncJobs")
        .withIndex("by_waAccountId", (q) => q.eq("waAccountId", account._id))
        .order("desc")
        .take(1);
      const latestJob = jobs[0] ?? null;

      // Check for pending DLQ entries
      const pendingDLQ = await ctx.db
        .query("waDeadLetters")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .filter((q) => q.eq(q.field("waAccountId"), account._id))
        .first();

      const status = computeHealthStatus(
        latestJob,
        !!pendingDLQ,
        account.status === "connected",
      );

      results.push({
        accountId: account._id,
        phoneNumber: account.phoneNumber,
        connectionStatus: account.status,
        syncHealth: status,
        lastSyncAt: latestJob?.completedAt ?? latestJob?.startedAt,
        lastHeartbeat: account.lastHeartbeat,
        errorCount: latestJob?.errors.length ?? 0,
      });
    }

    return results;
  },
});
