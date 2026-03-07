# Sync & Ingestion

## Overview

Ecqqo syncs messages from a user's personal WhatsApp account via the **wacli** worker running on a Fly.io Machine. Sync operates on a **dual-cadence model**:

- **Periodic sync** -- Every 5 minutes, a Convex scheduled function triggers a full sync cycle for each connected account. This catches any messages that may have been missed.
- **Continuous follow** -- While the wacli worker is connected, it streams new messages to Convex in near-real-time as they arrive.

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
    { from: "si-worker", to: "si-convex", label: "Batch (signed, versioned)" },
    { over: "si-convex", note: "Validate HMAC, version, allowlist\nIdempotent upsert (dedup)\nAdvance cursor" },
    { from: "si-worker", to: "si-convex", label: "SYNC_COMPLETE" },
    { over: "si-convex", note: "syncJob = completed\nprocessed = N, cursor = X\nPublish health to dashboard" },
  ],
  groups: [
    { label: "Sync Loop (until caught up)", color: "teal", from: 4, to: 5 },
  ],
}
</script>

<ArchDiagram :config="syncSeqConfig" />

## Sync Job State Machine

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> running : Worker picks up job

    running --> completed : Success
    running --> retry_pending : Transient error

    retry_pending --> running : Retry ok (< 5 retries)
    retry_pending --> failed : Max retries exceeded (>= 5)

    completed --> [*]
    failed --> [*]
```

## Metadata-First Policy

By default, Ecqqo does **not** sync full message content. This is a deliberate privacy-by-design choice.

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

When a message batch fails to process, it follows this retry path:

```mermaid
flowchart TD
    A["fa:fa-envelope Message Batch"] --> B{"Process batch"}
    B -- SUCCESS --> S["fa:fa-circle-check Cursor advanced<br/>Batch acked"]
    B -- FAILURE --> C{"Classify error"}

    C -- "Transient" --> D["fa:fa-rotate Exponential backoff<br/>5s / 25s / 125s / 625s<br/>then max retries"]
    D --> DLQ1["fa:fa-inbox DLQ<br/>Manual review/replay"]

    C -- "Validation" --> DLQ2["fa:fa-inbox DLQ (no retry)<br/>Bad schema or signature"]

    C -- "Policy" --> DROP["fa:fa-circle-xmark Dropped (logged)<br/>Not allowlisted / suspended"]
```

Retry strategy uses **exponential backoff** with base 5s and multiplier 5x. Jitter (+/- 20%) is added to prevent thundering herd when multiple accounts retry simultaneously.

## Cursor Progression and Reconciliation

Each `waAccount` maintains a **sync cursor** -- an opaque token representing the last successfully processed position in the message stream.

```mermaid
flowchart LR
    msg1 --> msg2 --> msg3 --> msg4 --> msg5 --> msg6 --> msg7

    msg3 -. "lastCursor<br/>(stored in Convex)" .-> msg3
    msg7 -. "currentHead<br/>(latest on device)" .-> msg7

    style msg4 fill:#e8f5f2,stroke:#0d7a6a,stroke-width:2px
    style msg5 fill:#e8f5f2,stroke:#0d7a6a,stroke-width:2px
    style msg6 fill:#e8f5f2,stroke:#0d7a6a,stroke-width:2px
    style msg7 fill:#e8f5f2,stroke:#0d7a6a,stroke-width:2px
```

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

```mermaid
flowchart TD
    A{"syncJob.state?"} -- running --> SYNC["fa:fa-arrows-rotate syncing"]
    A -- not running --> B{"Last sync<br/>< 10 min ago?"}
    B -- YES --> C{"failureCount?"}
    C -- "== 0" --> HEALTHY["fa:fa-circle-check healthy"]
    C -- "> 0" --> DEGRADED["fa:fa-triangle-exclamation degraded"]
    B -- "NO (> 15 min)" --> D{"Worker connected?"}
    D -- YES --> STALE["fa:fa-clock stale (auto-retrigger)"]
    D -- NO --> ERROR["fa:fa-circle-xmark error (manual)"]

    style HEALTHY fill:#e8f5f2,stroke:#0d7a6a
    style DEGRADED fill:#fef9f2,stroke:#d4a017
    style STALE fill:#fff0ec,stroke:#e04b2c
    style ERROR fill:#fff0ec,stroke:#e04b2c
    style SYNC fill:#e8f0fe,stroke:#2563eb
```
