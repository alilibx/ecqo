import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Identity & Access ──

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  workspaces: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }),

  memberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("principal"),
      v.literal("operator"),
    ),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_role", ["workspaceId", "role"])
    .index("by_user", ["userId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  // ── Billing ──

  subscriptions: defineTable({
    workspaceId: v.id("workspaces"),
    stripeCustomerId: v.string(),
    stripeSubId: v.string(),
    stripePriceId: v.string(),
    plan: v.union(
      v.literal("founder"),
      v.literal("dreamer"),
      v.literal("custom"),
    ),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
    ),
    currency: v.union(v.literal("usd"), v.literal("aed")),
    currentPeriodEnd: v.number(),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_stripe_sub", ["stripeSubId"])
    .index("by_stripe_cust", ["stripeCustomerId"])
    .index("by_status", ["status", "currentPeriodEnd"]),

  // ── Waitlist ──

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
    workspaceId: v.optional(v.id("workspaces")),
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
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_workspace", ["workspaceId"]),

  waConnectSessions: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
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
    /** Content policy: "metadata" (default) stores only metadata, "full" stores message body, "denied" hides from agent */
    contentPolicy: v.optional(
      v.union(
        v.literal("metadata"),
        v.literal("full"),
        v.literal("denied"),
      ),
    ),
    lastMessageAt: v.optional(v.number()),
    messageCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_account_chat", ["waAccountId", "chatJid"])
    .index("by_account", ["waAccountId"]),

  // ── Sync tracking ──

  waSyncCursors: defineTable({
    waAccountId: v.id("waAccounts"),
    chatExternalId: v.string(),
    lastMessageTimestamp: v.number(),
    lastSyncJobId: v.optional(v.id("waSyncJobs")),
  }).index("by_waAccountId_chatExternalId", [
    "waAccountId",
    "chatExternalId",
  ]),

  waSyncJobs: defineTable({
    waAccountId: v.id("waAccounts"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    messagesProcessed: v.number(),
    errors: v.array(v.string()),
  })
    .index("by_waAccountId", ["waAccountId"])
    .index("by_status", ["status"]),

  // ── Dead-letter queue for failed ingestion ──

  waDeadLetters: defineTable({
    waAccountId: v.optional(v.id("waAccounts")),
    sessionId: v.string(),
    /** The batch of messages that failed */
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
    /** Error details */
    error: v.string(),
    errorType: v.union(
      v.literal("transient"),
      v.literal("validation"),
      v.literal("unknown"),
    ),
    /** Retry tracking */
    retryCount: v.number(),
    maxRetries: v.number(),
    nextRetryAt: v.optional(v.number()),
    /** Terminal state */
    status: v.union(
      v.literal("pending"),
      v.literal("retrying"),
      v.literal("resolved"),
      v.literal("dead"),
    ),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_session", ["sessionId"])
    .index("by_nextRetry", ["status", "nextRetryAt"]),

  // ── Agent Runtime ──

  agentRuns: defineTable({
    workspaceId: v.id("workspaces"),
    principalId: v.id("users"),
    /** ID of the triggering message/event — unique for idempotency */
    triggerId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("planning"),
      v.literal("awaiting_approval"),
      v.literal("executing"),
      v.literal("retry_executing"),
      v.literal("completed"),
      v.literal("rejected"),
      v.literal("expired"),
      v.literal("failed"),
    ),
    specialistType: v.union(
      v.literal("scheduler"),
      v.literal("calendar"),
      v.literal("email"),
      v.literal("reminder"),
      v.literal("travel"),
      v.literal("brief"),
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    /** Number of execution retries attempted */
    retryCount: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_principal", ["principalId"])
    .index("by_status", ["status"])
    .index("by_triggerId", ["triggerId"]),

  runSteps: defineTable({
    agentRunId: v.id("agentRuns"),
    stepType: v.union(
      v.literal("llm_call"),
      v.literal("tool_call"),
      v.literal("approval_wait"),
      v.literal("memory_query"),
    ),
    /** JSON-serialized input */
    input: v.string(),
    /** JSON-serialized output (set after completion) */
    output: v.optional(v.string()),
    /** Execution time in milliseconds */
    durationMs: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_agentRun", ["agentRunId"]),

  toolCalls: defineTable({
    runStepId: v.id("runSteps"),
    agentRunId: v.id("agentRuns"),
    toolName: v.string(),
    /** JSON of what the tool would do (shown in approval UI) */
    dryRunPayload: v.string(),
    /** JSON of approved payload (may differ from dry run) */
    approvedPayload: v.optional(v.string()),
    /** JSON-serialized tool result */
    result: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("executed"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
  })
    .index("by_runStep", ["runStepId"])
    .index("by_agentRun", ["agentRunId"])
    .index("by_status", ["status"]),

  approvalRequests: defineTable({
    agentRunId: v.id("agentRuns"),
    toolCallId: v.id("toolCalls"),
    workspaceId: v.id("workspaces"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("expired"),
    ),
    requestedAt: v.number(),
    /** Auto-expire after 30 minutes */
    expiresAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
    /** Optional reason for the decision */
    rationale: v.optional(v.string()),
  })
    .index("by_agentRun", ["agentRunId"])
    .index("by_toolCall", ["toolCallId"])
    .index("by_status", ["status"])
    .index("by_workspace_status", ["workspaceId", "status"]),
});
