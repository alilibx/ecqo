# Sync & Ingestion

## Overview

Ecqqo syncs messages from a user's personal WhatsApp account via the **wacli** worker running on a Fly.io Machine. Sync operates on a **dual-cadence model**:

- **Periodic sync** -- Every 5 minutes, a Convex scheduled function triggers a full sync cycle for each connected account. This catches any messages that may have been missed.
- **Continuous follow** -- While the wacli worker is connected, it streams new messages to Convex in near-real-time as they arrive via direct mutation calls (`ConvexHttpClient`).

By default, Ecqqo follows a **metadata-first policy**: only chat-level metadata (contact name, last message timestamp, unread count) is synced. Full message bodies are only fetched for chats the user has explicitly allowlisted. This minimizes data exposure and storage costs.

## Sync Sequence Diagram

<script setup>
const syncSeqConfig = {
  type: "sequence",
  actors: [
    { id: "si-sched", icon: "fa-clock", title: "Scheduler", subtitle: "Convex Cron", color: "warm" },
    { id: "si-convex", icon: "si:convex", title: "Convex", subtitle: "Mutation", color: "teal" },
    { id: "si-worker", icon: "si:flydotio", title: "Fly.io Worker", subtitle: "wacli", color: "red" },
  ],
  steps: [
    { from: "si-sched", to: "si-convex", label: "5-min cron fires" },
    { over: "si-convex", note: "Create syncJob (queued)\ncursor = lastCursor" },
    { from: "si-convex", to: "si-worker", label: "Dispatch sync command" },
    { over: "si-worker", note: "Fetch msgs since cursor\nSign + version each batch" },
    { from: "si-worker", to: "si-convex", label: "ingestMessages mutation\n(signed, versioned)" },
    { over: "si-convex", note: "Validate HMAC, version, allowlist\nIdempotent upsert (dedup)\nAdvance cursor" },
    { from: "si-worker", to: "si-convex", label: "SYNC_COMPLETE" },
    { over: "si-convex", note: "syncJob = completed\nprocessed = N, cursor = X\nPublish health to dashboard" },
  ],
  groups: [
    { label: "Sync Loop (until caught up)", color: "teal", from: 4, to: 5 },
  ],
}

const dlqFlowConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "si1-batch", icon: "fa-envelope", title: "Message Batch", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "si1-process", icon: "fa-gears", title: "Process batch", row: 1, col: 1, shape: "diamond", color: "warm" },
    { id: "si1-success", icon: "fa-circle-check", title: "Cursor advanced", subtitle: "Batch acked", row: 2, col: 0, shape: "rect", color: "teal" },
    { id: "si1-classify", icon: "fa-magnifying-glass", title: "Classify error", row: 2, col: 2, shape: "diamond", color: "warm" },
    { id: "si1-backoff", icon: "fa-rotate", title: "Exp. backoff", subtitle: "5s / 25s / 125s / 625s", row: 3, col: 1, shape: "rect", color: "blue" },
    { id: "si1-dlq1", icon: "fa-inbox", title: "DLQ", subtitle: "Manual review/replay", row: 4, col: 1, shape: "rect", color: "red" },
    { id: "si1-dlq2", icon: "fa-inbox", title: "DLQ (no retry)", subtitle: "Bad schema or signature", row: 3, col: 2, shape: "rect", color: "red" },
    { id: "si1-drop", icon: "fa-circle-xmark", title: "Dropped", subtitle: "Not allowlisted / suspended", row: 3, col: 3, shape: "rect", color: "dark" },
  ],
  edges: [
    { from: "si1-batch", to: "si1-process" },
    { from: "si1-process", to: "si1-success", label: "Success" },
    { from: "si1-process", to: "si1-classify", label: "Failure" },
    { from: "si1-classify", to: "si1-backoff", label: "Transient" },
    { from: "si1-backoff", to: "si1-dlq1", label: "Max retries" },
    { from: "si1-classify", to: "si1-dlq2", label: "Validation" },
    { from: "si1-classify", to: "si1-drop", label: "Policy" },
  ],
}

const cursorFlowConfig = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "si2-msg1", icon: "fa-envelope", title: "msg1", row: 0, col: 0, shape: "rect", color: "dark" },
    { id: "si2-msg2", icon: "fa-envelope", title: "msg2", row: 0, col: 1, shape: "rect", color: "dark" },
    { id: "si2-msg3", icon: "fa-envelope", title: "msg3", subtitle: "lastCursor", row: 0, col: 2, shape: "rect", color: "dark" },
    { id: "si2-msg4", icon: "fa-envelope", title: "msg4", row: 0, col: 3, shape: "rect", color: "teal" },
    { id: "si2-msg5", icon: "fa-envelope", title: "msg5", row: 0, col: 4, shape: "rect", color: "teal" },
    { id: "si2-msg6", icon: "fa-envelope", title: "msg6", row: 0, col: 5, shape: "rect", color: "teal" },
    { id: "si2-msg7", icon: "fa-envelope", title: "msg7", subtitle: "currentHead", row: 0, col: 6, shape: "rect", color: "teal" },
  ],
  edges: [
    { from: "si2-msg1", to: "si2-msg2" },
    { from: "si2-msg2", to: "si2-msg3" },
    { from: "si2-msg3", to: "si2-msg4" },
    { from: "si2-msg4", to: "si2-msg5" },
    { from: "si2-msg5", to: "si2-msg6" },
    { from: "si2-msg6", to: "si2-msg7" },
  ],
  groups: [
    { label: "Synced (stored in Convex)", color: "dark", nodes: ["si2-msg1", "si2-msg2", "si2-msg3"] },
    { label: "To sync (pending)", color: "teal", nodes: ["si2-msg4", "si2-msg5", "si2-msg6", "si2-msg7"] },
  ],
}

const syncJobStateConfig = {
  type: "state",
  states: [
    { id: "si-s-start", shape: "initial", row: 0, col: 1 },
    { id: "si-s-queued", icon: "fa-inbox", title: "queued", row: 1, col: 1, color: "warm" },
    { id: "si-s-running", icon: "fa-arrows-rotate", title: "running", subtitle: "Worker processing", row: 2, col: 1, color: "teal" },
    { id: "si-s-retry", icon: "fa-rotate", title: "retry_pending", subtitle: "Transient error", row: 2, col: 2, color: "blue" },
    { id: "si-s-completed", icon: "fa-circle-check", title: "completed", row: 3, col: 0, color: "dark" },
    { id: "si-s-failed", icon: "fa-circle-xmark", title: "failed", subtitle: "Max retries (>= 5)", row: 3, col: 2, color: "red" },
    { id: "si-s-end", shape: "final", row: 4, col: 1 },
  ],
  transitions: [
    { from: "si-s-start", to: "si-s-queued" },
    { from: "si-s-queued", to: "si-s-running", label: "Worker picks up" },
    { from: "si-s-running", to: "si-s-completed", label: "Success" },
    { from: "si-s-running", to: "si-s-retry", label: "Transient error" },
    { from: "si-s-retry", to: "si-s-running", label: "< 5 retries", dashed: true },
    { from: "si-s-retry", to: "si-s-failed", label: "Max retries" },
    { from: "si-s-completed", to: "si-s-end" },
    { from: "si-s-failed", to: "si-s-end" },
  ],
}

const healthFlowConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "si3-state", icon: "fa-question", title: "syncJob.state?", row: 0, col: 1, shape: "diamond", color: "warm" },
    { id: "si3-sync", icon: "fa-arrows-rotate", title: "syncing", row: 1, col: 0, shape: "pill", color: "blue" },
    { id: "si3-recent", icon: "fa-clock", title: "< 10 min ago?", row: 1, col: 2, shape: "diamond", color: "warm" },
    { id: "si3-failures", icon: "fa-hashtag", title: "failureCount?", row: 2, col: 1, shape: "diamond", color: "warm" },
    { id: "si3-healthy", icon: "fa-circle-check", title: "healthy", row: 3, col: 0, shape: "pill", color: "teal" },
    { id: "si3-degraded", icon: "fa-triangle-exclamation", title: "degraded", row: 3, col: 2, shape: "pill", color: "warm" },
    { id: "si3-connected", icon: "fa-plug", title: "Worker connected?", row: 2, col: 3, shape: "diamond", color: "warm" },
    { id: "si3-stale", icon: "fa-clock", title: "stale", subtitle: "auto-retrigger", row: 3, col: 3, shape: "pill", color: "warm" },
    { id: "si3-error", icon: "fa-circle-xmark", title: "error", subtitle: "manual", row: 3, col: 4, shape: "pill", color: "red" },
  ],
  edges: [
    { from: "si3-state", to: "si3-sync", label: "running" },
    { from: "si3-state", to: "si3-recent", label: "not running" },
    { from: "si3-recent", to: "si3-failures", label: "Yes" },
    { from: "si3-failures", to: "si3-healthy", label: "== 0" },
    { from: "si3-failures", to: "si3-degraded", label: "> 0" },
    { from: "si3-recent", to: "si3-connected", label: "No (> 15 min)" },
    { from: "si3-connected", to: "si3-stale", label: "Yes" },
    { from: "si3-connected", to: "si3-error", label: "No" },
  ],
}
</script>

<ArchDiagram :config="syncSeqConfig" />

## Sync Job State Machine

<ArchDiagram :config="syncJobStateConfig" />

## Metadata-First Policy

**Implemented — enforced via `waChats.contentPolicy` field (`"metadata"` | `"full"` | `"denied"`).**

By default, Ecqqo does **not** sync full message content. This is a deliberate privacy-by-design choice. The `contentPolicy` field on each chat record is checked by `ingestMessages` (in `convex/connector.ts`) and by `processRetries` (in `convex/deadLetter.ts`) before storing message text. Only chats with `contentPolicy: "full"` have their message body persisted. The policy is managed via the `updateChatContentPolicy` mutation, which is RBAC-protected (owner/principal) and validates workspace ownership.

### What Gets Synced By Default

**All chats (automatic) — metadata only:**
- Chat ID (external)
- Contact / group name
- Last message timestamp
- Unread count
- Chat type (individual / group)
- Muted status
- Pinned status

**Allowlisted chats (user opt-in) — metadata plus:**
- Full message body (text)
- Message sender
- Timestamps (sent, delivered, read)
- Reply-to references
- Media metadata (type, size, caption)
- Media content (if enabled separately)

Users manage their allowlist from the dashboard. Each chat can be individually toggled. When a chat is added to the allowlist, a backfill sync is triggered to fetch historical messages (up to 30 days or 500 messages, whichever limit is hit first).

## Dead-Letter Queue and Retry Strategy

**Implemented in `convex/deadLetter.ts`, `convex/schema.ts` (`waDeadLetters` table), and `convex/crons.ts`.**

When a message batch fails to process, errors are classified and the batch follows this retry path:

<ArchDiagram :config="dlqFlowConfig" />

### Error Classification and Retry Limits

| Error Type   | Max Retries | Example                                   |
|--------------|-------------|--------------------------------------------|
| Transient    | 5           | Network timeout, rate limit, temporary 5xx |
| Validation   | 0 (dead)    | Bad schema, invalid signature              |
| Unknown      | 3           | Unclassified errors                        |

Retry strategy uses **exponential backoff**: `5s * 5^attempt` with jitter. A Convex cron processes the retry queue every 30 seconds. Batches that exhaust retries land in the `waDeadLetters` table for manual review. Dashboard queries expose DLQ stats (pending, retrying, dead counts). Manual retry is available for dead-lettered batches.

## Cursor Progression and Reconciliation

Each `waAccount` maintains a **sync cursor** -- an opaque token representing the last successfully processed position in the message stream.

<ArchDiagram :config="cursorFlowConfig" />

Sync fetches `msg4` through `msg7`. On success, `lastCursor` advances to `msg7`.

### Reconciliation

If the cursor becomes invalid (e.g., message history was cleared on the device, or the wacli session was reset), a reconciliation process runs:

1. Worker reports `CURSOR_INVALID` event.
2. Convex marks the sync as `needs_reconciliation`.
3. A full metadata scan is triggered to rebuild the chat list.
4. For allowlisted chats, a bounded backfill is performed.
5. New cursor is established from the current head position.

## Sync Health Statuses

The dashboard displays a real-time sync health indicator per connected WhatsApp account:

| Status       | Indicator    | Meaning                                                | Auto-recovery?  |
|--------------|--------------|--------------------------------------------------------|-----------------|
| `syncing`    | Blue spinner | Sync currently in progress                             | N/A             |
| `healthy`    | Green dot    | Last sync completed < 10 min ago, no errors            | N/A             |
| `degraded`   | Yellow dot   | Last sync had partial failures or retries are pending  | Yes, automatic  |
| `stale`      | Orange dot   | Last successful sync > 15 min ago                      | Yes, re-trigger |
| `error`      | Red dot      | Last sync failed, all retries exhausted                | No, manual      |

<ArchDiagram :config="healthFlowConfig" />
