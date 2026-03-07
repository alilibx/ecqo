# Schema & ERD

This document describes every entity in the Ecqqo data model, their relationships, field definitions, indexes, and idempotency rules. All data lives in Convex, which serves as the single source of truth.

## Entity-Relationship Diagram

```
+========================================================================================+
|                                   ECQO DATA MODEL                                      |
+========================================================================================+

  +-------------------+        +-------------------------------+
  |    workspaces     |        |           users               |
  |-------------------|        |-------------------------------|
  | _id               |<──┐    | _id                           |
  | name              |   │    | clerkId                       |
  | plan              |   │    | name                          |
  | stripeCustomerId  |   │    | email                         |
  | stripeSubscriptionId  │    | phone                         |
  +-------------------+   │    | role (owner|principal|operator)|
           │              └────| workspaceId                   |
           │                   +-------------------------------+
           │
           │ 1:N
           ├──────────────────────────────────────────────────────────────────────┐
           │                          │                           │              │
           v                          v                           v              v
  +---------------------+  +-------------------------+  +------------------+  +----------------------+
  |     waAccounts      |  | integrationConnections  |  |  subscriptions   |  |    auditEvents       |
  |---------------------|  |-------------------------|  |------------------|  |----------------------|
  | _id                 |  | _id                     |  | _id              |  | _id                  |
  | workspaceId     [FK]|  | workspaceId         [FK]|  | workspaceId  [FK]|  | workspaceId      [FK]|
  | principalId     [FK]|  | provider                |  | stripeSubId      |  | actorId          [FK]|
  | phone               |  | status                  |  | plan             |  | entityType           |
  | status              |  | tokenEncrypted          |  | status           |  | entityId             |
  | syncState           |  | scopes                  |  | currentPeriodEnd |  | action               |
  | connectorWorkerId   |  | lastRefreshedAt         |  +------------------+  | metadata             |
  +--------+------------+  +-------------------------+                        | occurredAt           |
           │                                                                  +----------------------+
           │
           │ 1:N
           ├───────────────────────────────────────┐
           │                    │                   │
           v                    v                   v
  +--------------------+  +------------------+  +---------------------+
  | waConnectSessions  |  | waConnectorWorkers| |      waChats        |
  |--------------------|  |------------------|  |---------------------|
  | _id                |  | _id              |  | _id                 |
  | waAccountId    [FK]|  | waAccountId  [FK]|  | waAccountId     [FK]|
  | status             |  | flyMachineId     |  | chatExternalId      |
  | qrPayload          |  | leaseStatus      |  | name                |
  | workerId           |  | lastHeartbeat    |  | isGroup             |
  | createdAt          |  +------------------+  | allowlistMode       |
  | expiresAt          |                        | lastSyncedAt        |
  +--------------------+                        +---------------------+
                                                         │
                                                         │ (shared key:
                                                         │  waAccountId +
                                                         │  chatExternalId)
           ┌─────────────────────────────────────────────┤
           │                          │                   │
           v                          v                   v
  +------------------------+  +-------------------+  +-----------------------+
  |      waMessages        |  |   waSyncCursors   |  |    inboundMessages    |
  |------------------------|  |-------------------|  |-----------------------|
  | _id                    |  | _id               |  | _id                   |
  | waAccountId        [FK]|  | waAccountId   [FK]|  | fromPhone             |
  | chatExternalId         |  | chatExternalId    |  | waAccountId       [FK]|
  | messageExternalId      |  | lastMsgTimestamp  |  | messageId             |
  | sender                 |  | lastSyncJobId [FK]|  | body                  |
  | body                   |  +-------------------+  | timestamp             |
  | timestamp              |                         | type                  |
  | language               |                         | processed             |
  | ingestionHash          |                         +-----------------------+
  +------------------------+
                                                +-------------------+
  waAccounts ──1:N──> waSyncJobs                |   waSyncJobs      |
                                                |-------------------|
                                                | _id               |
                                                | waAccountId   [FK]|
                                                | status            |
                                                | startedAt         |
                                                | completedAt       |
                                                | messagesProcessed |
                                                | errors            |
                                                +-------------------+

  +---------------------------------------------------------------------------+
  |                          AGENT RUNTIME                                    |
  +---------------------------------------------------------------------------+

  workspaces ──1:N──> agentRuns

  +------------------------+
  |      agentRuns         |
  |------------------------|
  | _id                    |
  | workspaceId        [FK]|
  | principalId        [FK]|
  | triggerId              |
  | status                 |
  | specialistType         |
  | startedAt              |
  | completedAt            |
  +--------+---------------+
           │
           │ 1:N
           ├───────────────────────────────────────────┐
           │                                           │
           v                                           v
  +---------------------+                    +------------------------+
  |     runSteps        |                    |   approvalRequests     |
  |---------------------|                    |------------------------|
  | _id                 |                    | _id                    |
  | agentRunId      [FK]|                    | agentRunId         [FK]|
  | stepType            |                    | toolCallId         [FK]|
  | input               |                    | status                 |
  | output              |                    | requestedAt            |
  | durationMs          |                    | decidedAt              |
  +--------+------------+                    | decidedBy          [FK]|
           │                                 | rationale              |
           │ 1:N                             +------------------------+
           v
  +---------------------+
  |     toolCalls       |
  |---------------------|
  | _id                 |
  | runStepId       [FK]|
  | toolName            |
  | dryRunPayload       |
  | approvedPayload     |
  | result              |
  | status              |
  +---------------------+

  +---------------------------------------------------------------------------+
  |                             MEMORY                                        |
  +---------------------------------------------------------------------------+

  users (principalId) ──1:N──> memories

  +------------------------+
  |      memories          |
  |------------------------|
  | _id                    |
  | principalId        [FK]|
  | tier                   |
  | content                |
  | embedding              |  <── vector index for semantic search
  | confidence             |
  | language               |
  | source                 |
  | expiresAt              |
  | isPinned               |
  +------------------------+
```

## Entity Details

### Auth & Workspace

#### workspaces

The top-level organizational unit. Each workspace maps to a billing entity.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"workspaces">` | Convex document ID |
| `name` | `string` | Workspace display name |
| `plan` | `string` | Current plan: `"free"`, `"starter"`, `"pro"`, `"enterprise"` |
| `stripeCustomerId` | `string?` | Stripe customer ID for billing |
| `stripeSubscriptionId` | `string?` | Active Stripe subscription ID |

**Indexes:**
- `by_stripeCustomerId` on `(stripeCustomerId)` -- lookup on webhook events
- `by_stripeSubscriptionId` on `(stripeSubscriptionId)` -- subscription lifecycle

**Invariants:**
- A workspace with `plan !== "free"` must have both `stripeCustomerId` and `stripeSubscriptionId` set.
- Deleting a workspace cascades to all child entities (waAccounts, users, integrationConnections, subscriptions).

---

#### users

A person within a workspace. The `role` field determines RBAC permissions.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"users">` | Convex document ID |
| `clerkId` | `string` | Clerk user ID (for dashboard auth) |
| `name` | `string` | Display name |
| `email` | `string` | Email address |
| `phone` | `string?` | Phone number in E.164 format |
| `role` | `string` | One of: `"owner"`, `"principal"`, `"operator"` |
| `workspaceId` | `Id<"workspaces">` | FK to parent workspace |

**Indexes:**
- `by_clerkId` on `(clerkId)` -- Clerk JWT resolution
- `by_email` on `(email)` -- email-based lookup
- `by_phone` on `(phone)` -- WhatsApp sender identification
- `by_workspaceId` on `(workspaceId)` -- list workspace members

**Invariants:**
- `clerkId` is globally unique.
- `phone` is globally unique when set (one phone = one user).
- Each workspace must have exactly one `"owner"`.
- A `"principal"` is the person being assisted; an `"operator"` manages the assistant on their behalf.

---

### WhatsApp Connection

#### waAccounts

Represents a connected WhatsApp account. One per principal.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"waAccounts">` | Convex document ID |
| `workspaceId` | `Id<"workspaces">` | FK to workspace |
| `principalId` | `Id<"users">` | FK to the principal this account belongs to |
| `phone` | `string` | WhatsApp phone number (E.164) |
| `status` | `string` | `"connecting"`, `"connected"`, `"disconnected"`, `"error"` |
| `syncState` | `string` | `"idle"`, `"syncing"`, `"paused"`, `"error"` |
| `connectorWorkerId` | `Id<"waConnectorWorkers">?` | FK to active Fly.io worker |

**Indexes:**
- `by_workspaceId` on `(workspaceId)` -- list accounts in workspace
- `by_principalId` on `(principalId)` -- lookup by user
- `by_phone` on `(phone)` -- phone-based deduplication

**Invariants:**
- One `waAccount` per `principalId` (1:1 relationship).
- `phone` is globally unique across all waAccounts.

---

#### waConnectSessions

Short-lived sessions used during the QR code connection flow.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"waConnectSessions">` | Convex document ID |
| `waAccountId` | `Id<"waAccounts">` | FK to the account being connected |
| `status` | `string` | `"created"`, `"qr_ready"`, `"scanned"`, `"connected"`, `"expired"`, `"failed"` |
| `qrPayload` | `string?` | Base64-encoded QR data (set when status = `"qr_ready"`) |
| `workerId` | `Id<"waConnectorWorkers">?` | FK to the Fly.io worker handling this session |
| `createdAt` | `number` | Unix timestamp (ms) |
| `expiresAt` | `number` | Unix timestamp (ms), typically createdAt + 120_000 |

**Indexes:**
- `by_waAccountId` on `(waAccountId)` -- find active session for account
- `by_status` on `(status)` -- garbage-collect expired sessions

**Invariants:**
- At most one session with status in `["created", "qr_ready", "scanned"]` per waAccountId at any time.
- Sessions past `expiresAt` are garbage-collected by a scheduled function.

---

#### waConnectorWorkers

Tracks Fly.io machine state for each wacli connector worker.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"waConnectorWorkers">` | Convex document ID |
| `waAccountId` | `Id<"waAccounts">` | FK to the account this worker serves |
| `flyMachineId` | `string` | Fly.io Machine ID |
| `leaseStatus` | `string` | `"active"`, `"draining"`, `"stopped"` |
| `lastHeartbeat` | `number` | Unix timestamp (ms) of last heartbeat |

**Indexes:**
- `by_waAccountId` on `(waAccountId)` -- lookup active worker for account
- `by_leaseStatus` on `(leaseStatus)` -- find stale/draining workers
- `by_flyMachineId` on `(flyMachineId)` -- reverse lookup from Fly.io

**Invariants:**
- At most one worker with `leaseStatus = "active"` per waAccountId.
- If `lastHeartbeat` is older than 90 seconds, a scheduled function marks the worker as `"draining"` and attempts restart.

---

### Sync & Messages

#### waChats

Represents a WhatsApp chat (individual or group) discovered during sync.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"waChats">` | Convex document ID |
| `waAccountId` | `Id<"waAccounts">` | FK to the parent WA account |
| `chatExternalId` | `string` | WhatsApp JID (e.g., `1234567890@s.whatsapp.net`) |
| `name` | `string` | Chat display name |
| `isGroup` | `boolean` | Whether this is a group chat |
| `allowlistMode` | `string` | `"all"`, `"allowlist"`, `"denylist"` -- controls agent visibility |
| `lastSyncedAt` | `number?` | Unix timestamp (ms) of last successful sync |

**Indexes:**
- `by_waAccountId` on `(waAccountId)` -- list chats for account
- `by_waAccountId_chatExternalId` on `(waAccountId, chatExternalId)` -- unique lookup

**Invariants:**
- `(waAccountId, chatExternalId)` is a unique compound key.
- Chats with `allowlistMode = "denylist"` are completely invisible to the agent.

---

#### waMessages

Individual WhatsApp messages ingested from wacli sync.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"waMessages">` | Convex document ID |
| `waAccountId` | `Id<"waAccounts">` | FK to the parent WA account |
| `chatExternalId` | `string` | WhatsApp JID of the chat |
| `messageExternalId` | `string` | WhatsApp message ID |
| `sender` | `string` | Sender JID |
| `body` | `string` | Message text content |
| `timestamp` | `number` | Unix timestamp (ms) from WhatsApp |
| `language` | `string?` | Detected language (`"en"`, `"ar"`, etc.) |
| `ingestionHash` | `string` | SHA-256 hash of `(waAccountId, messageExternalId)` for dedup |

**Indexes:**
- `by_waAccountId_chatExternalId` on `(waAccountId, chatExternalId)` -- list messages in a chat
- `by_ingestionHash` on `(ingestionHash)` -- idempotent insert
- `by_waAccountId_timestamp` on `(waAccountId, timestamp)` -- chronological scan

**Invariants:**
- `ingestionHash` is globally unique. Insert is a no-op if hash already exists.
- Messages are append-only. No updates or deletes.

---

#### waSyncCursors

Tracks sync progress per chat. Used to resume incremental sync.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"waSyncCursors">` | Convex document ID |
| `waAccountId` | `Id<"waAccounts">` | FK to the WA account |
| `chatExternalId` | `string` | WhatsApp JID |
| `lastMessageTimestamp` | `number` | Timestamp of the last synced message |
| `lastSyncJobId` | `Id<"waSyncJobs">?` | FK to the sync job that last updated this cursor |

**Indexes:**
- `by_waAccountId_chatExternalId` on `(waAccountId, chatExternalId)` -- unique cursor per chat

**Invariants:**
- `(waAccountId, chatExternalId)` is a unique compound key.
- `lastMessageTimestamp` only advances forward (never set to an older value).

---

#### waSyncJobs

Records of sync operations for observability and debugging.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"waSyncJobs">` | Convex document ID |
| `waAccountId` | `Id<"waAccounts">` | FK to the WA account |
| `status` | `string` | `"running"`, `"completed"`, `"failed"` |
| `startedAt` | `number` | Unix timestamp (ms) |
| `completedAt` | `number?` | Unix timestamp (ms) |
| `messagesProcessed` | `number` | Count of messages ingested in this job |
| `errors` | `string[]` | Error messages encountered during sync |

**Indexes:**
- `by_waAccountId` on `(waAccountId)` -- list jobs for account
- `by_status` on `(status)` -- find stuck/running jobs

**Invariants:**
- A `"running"` job must be completed or failed within 5 minutes, or a scheduled function marks it failed.
- At most one `"running"` job per waAccountId at a time.

---

### Agent Runtime

#### agentRuns

Top-level record of a single agent invocation.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"agentRuns">` | Convex document ID |
| `workspaceId` | `Id<"workspaces">` | FK to workspace |
| `principalId` | `Id<"users">` | FK to the principal who triggered the run |
| `triggerId` | `string` | ID of the triggering message or event |
| `status` | `string` | `"pending"`, `"running"`, `"awaiting_approval"`, `"completed"`, `"failed"` |
| `specialistType` | `string?` | `"scheduler"`, `"calendar"`, `"email"`, `"reminder"`, `"travel"`, `"brief"` |
| `startedAt` | `number` | Unix timestamp (ms) |
| `completedAt` | `number?` | Unix timestamp (ms) |

**Indexes:**
- `by_workspaceId` on `(workspaceId)` -- list runs for workspace
- `by_principalId` on `(principalId)` -- list runs for a user
- `by_status` on `(status)` -- find pending/stuck runs
- `by_triggerId` on `(triggerId)` -- idempotent trigger

**Invariants:**
- `triggerId` is unique. Duplicate triggers are rejected (idempotent).
- Runs in `"running"` or `"awaiting_approval"` for more than 10 minutes are auto-failed by a scheduled function.

---

#### runSteps

Individual steps within an agent run (LLM calls, tool invocations, etc.).

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"runSteps">` | Convex document ID |
| `agentRunId` | `Id<"agentRuns">` | FK to parent run |
| `stepType` | `string` | `"llm_call"`, `"tool_call"`, `"approval_wait"`, `"memory_query"` |
| `input` | `string` | JSON-serialized input to this step |
| `output` | `string?` | JSON-serialized output from this step |
| `durationMs` | `number?` | Execution time in milliseconds |

**Indexes:**
- `by_agentRunId` on `(agentRunId)` -- list steps for a run

**Invariants:**
- Steps are append-only within a run. No updates after creation (except setting `output` and `durationMs`).

---

#### toolCalls

Records of individual tool invocations within a run step.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"toolCalls">` | Convex document ID |
| `runStepId` | `Id<"runSteps">` | FK to parent step |
| `toolName` | `string` | Tool identifier (e.g., `"calendar_write"`, `"email_read"`) |
| `dryRunPayload` | `string` | JSON of what the tool would do (shown in approval UI) |
| `approvedPayload` | `string?` | JSON of the approved payload (may differ from dry run) |
| `result` | `string?` | JSON-serialized tool result |
| `status` | `string` | `"pending"`, `"approved"`, `"rejected"`, `"executed"`, `"failed"` |

**Indexes:**
- `by_runStepId` on `(runStepId)` -- list tool calls for a step
- `by_status` on `(status)` -- find pending approvals

**Invariants:**
- Tool calls with `status = "pending"` must have a corresponding `approvalRequests` entry if the tool is approval-gated.
- `approvedPayload` is only set when `status` transitions to `"approved"`.

---

#### approvalRequests

Human-in-the-loop approval requests for sensitive tool calls.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"approvalRequests">` | Convex document ID |
| `agentRunId` | `Id<"agentRuns">` | FK to the agent run |
| `toolCallId` | `Id<"toolCalls">` | FK to the specific tool call |
| `status` | `string` | `"pending"`, `"approved"`, `"rejected"`, `"expired"` |
| `requestedAt` | `number` | Unix timestamp (ms) |
| `decidedAt` | `number?` | Unix timestamp (ms) |
| `decidedBy` | `Id<"users">?` | FK to the user who approved/rejected |
| `rationale` | `string?` | Optional reason for the decision |

**Indexes:**
- `by_agentRunId` on `(agentRunId)` -- list approvals for a run
- `by_status` on `(status)` -- approval queue for operators
- `by_toolCallId` on `(toolCallId)` -- lookup approval for a tool call

**Invariants:**
- One approval request per `toolCallId` (1:1).
- Approvals pending for more than 30 minutes are auto-expired by a scheduled function.
- Only users with role `"operator"` or `"owner"` can approve/reject.

---

### Memory

#### memories

Extracted facts and preferences stored with vector embeddings for semantic retrieval.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"memories">` | Convex document ID |
| `principalId` | `Id<"users">` | FK to the principal this memory belongs to |
| `tier` | `string` | `"pinned"`, `"short_term"`, `"episodic"`, `"semantic"` |
| `content` | `string` | The fact or preference in natural language |
| `embedding` | `number[]` | Vector embedding (1536 dimensions for text-embedding-3-small) |
| `confidence` | `number` | 0.0 to 1.0 confidence score |
| `language` | `string` | Source language (`"en"`, `"ar"`) |
| `source` | `string` | Source reference (e.g., agent run ID, message ID) |
| `expiresAt` | `number?` | Unix timestamp (ms). Null for permanent memories. |
| `isPinned` | `boolean` | Whether explicitly pinned by operator |

**Indexes:**
- `by_principalId` on `(principalId)` -- list all memories for a user
- `by_principalId_tier` on `(principalId, tier)` -- filter by tier
- `by_embedding` -- Convex vector index for semantic search (1536 dimensions)

**Invariants:**
- Memories are scoped per principal. Vector search always filters by `principalId`.
- `tier = "pinned"` memories have `isPinned = true` and `expiresAt = null`.
- `tier = "short_term"` memories expire after 7 days.
- `tier = "episodic"` memories are daily summaries, expire after 90 days.
- `tier = "semantic"` memories are long-term facts, expire after 365 days or never.

---

### Integrations

#### integrationConnections

OAuth connections to external services (Google, etc.).

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"integrationConnections">` | Convex document ID |
| `workspaceId` | `Id<"workspaces">` | FK to workspace |
| `provider` | `string` | `"google_calendar"`, `"gmail"`, `"google_drive"` |
| `status` | `string` | `"active"`, `"expired"`, `"revoked"` |
| `tokenEncrypted` | `string` | AES-256-GCM encrypted OAuth token blob |
| `scopes` | `string[]` | Granted OAuth scopes |
| `lastRefreshedAt` | `number?` | Unix timestamp (ms) of last token refresh |

**Indexes:**
- `by_workspaceId` on `(workspaceId)` -- list connections for workspace
- `by_workspaceId_provider` on `(workspaceId, provider)` -- unique lookup

**Invariants:**
- `(workspaceId, provider)` is a unique compound key. One connection per provider per workspace.
- Tokens are refreshed proactively 5 minutes before expiry.

---

### Billing

#### subscriptions

Mirrors Stripe subscription state in Convex for fast queries.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"subscriptions">` | Convex document ID |
| `workspaceId` | `Id<"workspaces">` | FK to workspace |
| `stripeSubscriptionId` | `string` | Stripe subscription ID |
| `plan` | `string` | `"starter"`, `"pro"`, `"enterprise"` |
| `status` | `string` | `"active"`, `"past_due"`, `"canceled"`, `"trialing"` |
| `currentPeriodEnd` | `number` | Unix timestamp (ms) of billing period end |

**Indexes:**
- `by_workspaceId` on `(workspaceId)` -- lookup subscription for workspace
- `by_stripeSubscriptionId` on `(stripeSubscriptionId)` -- webhook resolution

**Invariants:**
- At most one active subscription per workspace.
- `stripeSubscriptionId` is globally unique.

---

### Audit

#### auditEvents

Immutable audit log for compliance and debugging.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"auditEvents">` | Convex document ID |
| `workspaceId` | `Id<"workspaces">` | FK to workspace |
| `actorId` | `Id<"users">?` | FK to the user who performed the action (null for system) |
| `entityType` | `string` | Entity type (e.g., `"agentRun"`, `"waAccount"`, `"approvalRequest"`) |
| `entityId` | `string` | ID of the affected entity |
| `action` | `string` | Action verb (e.g., `"created"`, `"approved"`, `"disconnected"`) |
| `metadata` | `string?` | JSON-serialized additional context |
| `occurredAt` | `number` | Unix timestamp (ms) |

**Indexes:**
- `by_workspaceId` on `(workspaceId)` -- list events for workspace
- `by_entityType_entityId` on `(entityType, entityId)` -- entity history
- `by_occurredAt` on `(occurredAt)` -- chronological scan

**Invariants:**
- Audit events are append-only. No updates or deletes.
- Every state-changing mutation must emit an audit event.

---

### Inbound Messages (Meta Cloud API)

#### inboundMessages

Messages received from users via the Meta Cloud API webhook.

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"inboundMessages">` | Convex document ID |
| `fromPhone` | `string` | Sender phone number (E.164) |
| `waAccountId` | `Id<"waAccounts">?` | FK to matched WA account (null if unmatched) |
| `messageId` | `string` | Meta Cloud API message ID |
| `body` | `string` | Message text content |
| `timestamp` | `number` | Unix timestamp (ms) from Meta |
| `type` | `string` | `"text"`, `"image"`, `"audio"`, `"document"`, `"location"` |
| `processed` | `boolean` | Whether the agent has processed this message |

**Indexes:**
- `by_messageId` on `(messageId)` -- idempotent insert
- `by_waAccountId` on `(waAccountId)` -- list messages for account
- `by_processed` on `(processed)` -- find unprocessed messages

**Invariants:**
- `messageId` is globally unique (from Meta). Duplicate webhooks are no-ops.
- Unmatched messages (`waAccountId = null`) are stored but not processed.

---

## Idempotency Rules

All external-facing write operations must be idempotent to handle retries, duplicate webhooks, and at-least-once delivery.

| Operation | Idempotency Key | Behavior on Duplicate |
|---|---|---|
| Ingest wacli message | `ingestionHash` (SHA-256 of waAccountId + messageExternalId) | Skip insert, return success |
| Receive Meta webhook message | `messageId` (from Meta payload) | Skip insert, return 200 |
| Trigger agent run | `triggerId` (source message/event ID) | Skip, return existing run ID |
| Stripe webhook event | Stripe event ID (checked in handler) | Skip processing, return 200 |
| Create connect session | Check for existing non-terminal session per waAccountId | Return existing session |
| Sync job start | Check for existing `"running"` job per waAccountId | Return existing job |
| Approval decision | Check `approvalRequests.status !== "pending"` | Return current status, no-op |
| Worker heartbeat | Upsert on `(waAccountId)` | Update `lastHeartbeat` timestamp |
