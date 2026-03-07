# Security Posture

This document describes Ecqqo's security architecture, threat model, and operational controls. Ecqqo handles sensitive personal and business data on behalf of high-net-worth individuals, so security is not an afterthought -- it is a core product requirement.

## Security Architecture

```
                          +------------------+
                          |   User Browser   |
                          |  (Dashboard UI)  |
                          +--------+---------+
                                   |
                                   | HTTPS (TLS 1.3)
                                   | Clerk JWT in Authorization header
                                   |
                          +--------v---------+
                          |   Vercel Edge    |
                          |   (SSR + CDN)    |
                          +--------+---------+
                                   |
                                   | Authenticated requests
                                   | JWT forwarded to Convex
                                   |
                    +--------------v--------------+
                    |        Convex Cloud          |
                    |                              |
                    |  +------------------------+  |
                    |  | RBAC Enforcement Layer  |  |
                    |  | - JWT validation        |  |
                    |  | - Workspace membership  |  |
                    |  | - Role-based filtering  |  |
                    |  +------------------------+  |
                    |                              |
                    |  +----------+  +-----------+ |
                    |  | Database |  | Functions  | |
                    |  | (tables) |  | (mutations | |
                    |  |          |  |  queries   | |
                    |  |          |  |  actions)  | |
                    |  +----------+  +-----------+ |
                    +-----+------------------+-----+
                          |                  |
            Signed reqs   |                  |  Signed reqs
            (HMAC-SHA256) |                  |  (HMAC-SHA256)
                          |                  |
                 +--------v------+    +------v-----------+
                 |  Fly.io       |    |  Meta Cloud API  |
                 |  Workers      |    |  (Outbound WA)   |
                 |               |    +------+-----------+
                 | +-----------+ |           |
                 | | Encrypted | |           | Webhook callbacks
                 | | Session   | |           | (signature-verified)
                 | | Store     | |           |
                 | +-----------+ |    +------v-----------+
                 |               |    |  Convex Cloud    |
                 +-------+------+    |  (inbound handler)|
                         |           +------------------+
                         |
                         | WhatsApp Web protocol
                         | (E2E encrypted by WhatsApp)
                         |
                +--------v---------+
                |  WhatsApp Network |
                |  (User's chats)   |
                +------------------+
```

### Dual Ingress Paths

Ecqqo has two distinct paths for WhatsApp data:

```
Path 1: Connector (wacli) -- syncs user's personal WhatsApp
+------------+     WA Web Protocol      +-----------+    HMAC-signed     +---------+
| WhatsApp   | <---------------------> | Fly.io    | ----------------> | Convex  |
| Network    |   E2E encrypted session  | Worker    |   events + data   | Cloud   |
+------------+                          +-----------+                    +---------+

Path 2: Meta Cloud API -- Ecqqo's official WhatsApp Business number
+------------+     Webhook POST         +---------+
| Meta       | ----------------------> | Convex  |
| Platform   |   Signature-verified    | Cloud   |
+------------+                          +---------+
       ^                                     |
       |         API call (Bearer token)     |
       +-------------------------------------+
```

## Authentication and Authorization

### Clerk JWT Validation

Every request to the Convex backend carries a Clerk-issued JWT. Validation happens at the Convex function level before any data access.

```
Request Flow:
Browser --> Clerk SDK (client-side) --> JWT issued
    |
    v
Convex function called with JWT
    |
    v
ctx.auth.getUserIdentity()
    |
    +-- null? --> Reject (401 Unauthorized)
    |
    +-- Valid? --> Extract: userId, workspaceId, role
                      |
                      v
                  Check workspace membership table
                      |
                      +-- Not member? --> Reject (403 Forbidden)
                      |
                      +-- Member? --> Check role permissions
                                         |
                                         v
                                     Execute function with scoped data
```

### Role Hierarchy

```
owner (full control)
  |
  +-- Can do everything principal can do, plus:
  |     - Manage workspace settings
  |     - Invite/remove members
  |     - Manage billing (Stripe)
  |     - Activate/deactivate kill switches
  |     - Connect/disconnect WhatsApp
  |     - Modify all policies
  |     - Batch approve actions
  |     - Access audit logs
  |
  v
principal (approve + view own context)
  |
  +-- Can do everything operator can do, plus:
  |     - Approve/reject actions in queue
  |     - View own conversation context
  |     - View own run history
  |     - Edit own default preferences
  |
  v
operator (triage + monitor)
      - View all conversations (monitor)
      - View all runs (monitor)
      - Triage approval queue (escalate, not approve)
      - View memory (read-only)
      - View integration statuses
      - Cannot modify policies, billing, or settings
```

### Workspace Isolation

All data is scoped to a workspace. Cross-workspace data access is structurally impossible because every Convex query filters by `workspaceId` extracted from the authenticated user's JWT claims. There is no admin API that bypasses workspace scoping.

## Data Protection

### Encryption

| Layer                  | Encryption                                          |
|------------------------|-----------------------------------------------------|
| Data in transit        | TLS 1.3 (Vercel, Convex, Fly.io all enforce HTTPS) |
| Data at rest (Convex)  | AES-256 (managed by Convex Cloud)                   |
| Session artifacts      | AES-256 encrypted before storage on Fly.io volumes  |
| OAuth tokens           | Encrypted at rest in Convex, never exposed to client|
| WhatsApp E2E           | Signal Protocol (managed by WhatsApp, opaque to us) |

### Metadata-First Sync Policy

By default, the connector syncs only metadata from WhatsApp conversations:

```
Default sync (all chats):
+-------------------------------------------+
|  Chat: Ahmed Al-Mansour                    |
|  Last message: 2026-03-07T10:42:00Z        |
|  Message count: 147                         |
|  Chat type: individual                      |
|  Status: active                             |
+-------------------------------------------+
   * No message content stored *

Allowlisted chat (explicit user opt-in):
+-------------------------------------------+
|  Chat: Ahmed Al-Mansour       [ALLOWLISTED] |
|  Last message: 2026-03-07T10:42:00Z        |
|  Message count: 147                         |
|  Chat type: individual                      |
|  Status: active                             |
|                                              |
|  Messages:                                   |
|  [10:42] Ahmed: "Confirm the dinner for 8"  |
|  [10:38] Ahmed: "Did you check the venue?"  |
|  [10:21] You: "Yes, La Petite Maison works" |
+-------------------------------------------+
```

This minimizes data exposure. The agent can only read and act on conversations the user has explicitly allowlisted.

### PII Handling

- **No PII in logs**: Application logs strip phone numbers, names, and message content before emission. Structured log fields use workspace and entity IDs only.
- **No PII in error traces**: Error reporting (if integrated) receives sanitized stack traces. Message content is replaced with `[REDACTED]` in error context.
- **Trace redaction**: Agent reasoning traces that reference message content are stored with the content portions hashed. The dashboard reconstructs display from the original message reference, not from the trace.

## Connector Security

The Fly.io connector worker communicates with Convex using signed requests to prevent spoofing and replay attacks.

### HMAC-SHA256 Request Signing

```
Worker --> Convex request signing:

1. Worker constructs payload:
   {
     "workspaceId": "ws_abc123",
     "event": "message.received",
     "data": { ... },
     "timestamp": 1741334400000
   }

2. Worker computes signature:
   signature = HMAC-SHA256(
     key = WORKER_SIGNING_SECRET,
     message = JSON.stringify(payload)
   )

3. Worker sends request:
   POST /api/connector/event
   X-Ecqqo-Signature: sha256=<signature>
   X-Ecqqo-Timestamp: 1741334400000
   Content-Type: application/json

   <payload>

4. Convex handler verifies:
   a. Parse X-Ecqqo-Timestamp
   b. Reject if |now - timestamp| > 300000 (5-minute window)
   c. Recompute HMAC-SHA256 with stored secret
   d. Constant-time compare with X-Ecqqo-Signature
   e. Reject if mismatch
```

### Worker Lease System

Each workspace has at most one active connector worker. The lease system prevents duplicate workers from running simultaneously.

```
Lease lifecycle:

[Start worker]
      |
      v
  Acquire lease (Convex mutation)
      |
      +-- Lease exists and is active? --> Reject (409 Conflict)
      |
      +-- No active lease? --> Issue lease
            |                    leaseId: uuid
            |                    workspaceId: ws_abc123
            |                    workerId: fly_machine_id
            |                    issuedAt: timestamp
            |                    expiresAt: timestamp + 5min
            |                    status: active
            |
            v
      Worker starts heartbeat loop (every 60s)
            |
            v
      Heartbeat renews lease (extends expiresAt by 5min)
            |
            v
      [Worker crash or disconnect]
            |
            v
      Lease expires naturally after 5min
            |
            v
      New worker can acquire lease
```

## WhatsApp Webhook Security (Meta Cloud API)

Inbound webhooks from Meta's WhatsApp Business Platform are verified before processing.

```
Meta Platform --> Convex webhook endpoint:

1. Meta sends POST with headers:
   X-Hub-Signature-256: sha256=<signature>

2. Convex handler verifies:
   a. Read raw request body
   b. Compute HMAC-SHA256 with app secret
   c. Constant-time compare with X-Hub-Signature-256
   d. Reject if mismatch (return 401)

3. Parse verified payload:
   a. Extract phone number from message.from
   b. Look up workspace by verified phone number
   c. Apply rate limiting (per-phone, per-workspace)
   d. Route to appropriate handler

4. Rate limits:
   - 30 inbound messages per phone per minute
   - 200 inbound messages per workspace per hour
   - Exceeded? --> Queue overflow, notify owner
```

### Phone Number Verification

The user's phone number in inbound webhooks is verified by Meta's platform -- it cannot be spoofed by the sender. This provides a reliable identity signal for routing messages to the correct workspace.

## Audit Trail

All security-relevant and operationally significant events are recorded in an immutable `auditEvents` table.

### Logged Events

| Category | Events |
|----------|--------|
| Authentication | login, logout, session_expired, failed_login_attempt |
| Authorization | role_changed, member_invited, member_removed, permission_denied |
| Connector | wa_connected, wa_disconnected, wa_reconnected, heartbeat_missed, lease_acquired, lease_expired |
| Sync | sync_started, sync_completed, sync_failed, chat_allowlisted, chat_removed_from_allowlist |
| Approvals | approval_requested, approval_approved, approval_rejected, approval_expired, batch_approved |
| Agent | run_started, run_completed, run_failed, run_retried, tool_call_executed, tool_call_failed |
| Policy | policy_created, policy_updated, policy_deleted, quiet_hours_changed, guardrail_triggered |
| Kill Switch | kill_switch_activated, kill_switch_deactivated |
| Billing | plan_changed, payment_failed, payment_succeeded |
| Data | data_exported, workspace_deleted |

### Audit Event Schema

```
auditEvent {
  _id:          Id<"auditEvents">
  workspaceId:  Id<"workspaces">
  actorId:      string           // Clerk user ID or "system"
  actorRole:    "owner" | "principal" | "operator" | "system"
  category:     string           // e.g., "connector", "approvals"
  event:        string           // e.g., "wa_connected"
  entityType:   string           // e.g., "connector", "approval"
  entityId:     string           // ID of the affected entity
  metadata:     object           // Event-specific details (no PII)
  timestamp:    number           // Unix milliseconds
  ip:           string           // Client IP (hashed for privacy)
}

Indexes:
  by_workspace_time:  [workspaceId, timestamp]
  by_workspace_event: [workspaceId, event]
  by_entity:          [entityType, entityId]
```

Audit events are append-only. There is no mutation that deletes or modifies existing audit records. Retention follows the workspace's plan-based data retention policy.

## Kill-Switch Controls

The owner can instantly disable critical subsystems when something goes wrong. Kill switches are implemented as feature flags in the Convex `workspaceSettings` table, checked synchronously before every sensitive operation.

| Kill Switch | What It Disables | Trigger Conditions |
|------------|-----------------|-------------------|
| Connector Ingestion | Stops syncing new messages from WhatsApp. Worker pauses but maintains session. | Elevated account restrictions from WhatsApp, signature anomaly detected. |
| Agent Execution | Prevents new agent runs from starting. In-progress runs complete current step then halt. | Runaway cost detected, repeated tool failures, guardrail breach. |
| Outbound Messaging | Blocks all outbound WhatsApp messages (both connector and Meta Cloud API). | Rate limit warning from Meta, user complaint, content policy violation. |

### Kill-Switch Check Flow

```
Any sensitive operation (send message, start run, sync message):
      |
      v
  Read workspaceSettings.killSwitches
      |
      +-- killSwitch.connectorIngestion === true?
      |     --> Reject with KILL_SWITCH_ACTIVE error
      |
      +-- killSwitch.agentExecution === true?
      |     --> Reject with KILL_SWITCH_ACTIVE error
      |
      +-- killSwitch.outboundMessaging === true?
      |     --> Reject with KILL_SWITCH_ACTIVE error
      |
      +-- All clear? --> Proceed with operation
```

Kill-switch activation and deactivation are both recorded in the audit trail. The owner receives a WhatsApp notification (via the Meta Cloud API outbound path, which is independent of the connector) when a kill switch is auto-triggered.

## Compliance Considerations

### Unofficial WhatsApp Client Disclosure

The connector component uses an unofficial WhatsApp Web client library. Pilot users must acknowledge:

1. This approach is not endorsed by Meta/WhatsApp
2. Their WhatsApp account could be temporarily or permanently restricted
3. Ecqqo will attempt reconnection but cannot guarantee uninterrupted service
4. The official Meta Cloud API path (for outbound from Ecqqo's business number) is unaffected

This disclosure is presented during onboarding and recorded in the audit trail as `disclosure_acknowledged`.

### Data Retention

| Plan | Message Metadata | Full Messages | Runs | Audit Events |
|------|-----------------|--------------|------|-------------|
| Pilot | 90 days | 30 days | 30d | 1 year |
| Pro | 1 year | 90 days | 90d | 2 years |
| Enterprise | Custom | Custom | Custom | Custom (min 2y) |

Expired data is soft-deleted (marked for deletion) then hard-deleted in a scheduled Convex cron job that runs daily.

### GDPR Considerations (EU Users)

- **Right to access**: Users can export all their data via Settings > Export Data. This generates a JSON archive of all workspace data.
- **Right to deletion**: Users can delete their workspace via Settings > Danger Zone. This triggers cascading deletion of all associated data within 30 days.
- **Data portability**: Export format is machine-readable JSON.
- **Consent**: Explicit opt-in for each data collection scope (WhatsApp sync, calendar access, email access).

## Agent Observability (LangSmith)

All agent runs are traced via [LangSmith](https://smith.langchain.com) for end-to-end observability of the intelligence plane.

### Why LangSmith

- Purpose-built for LLM application tracing (not generic APM)
- Captures full chain: prompt assembly, model call, tool invocations, approval gate, response delivery
- Supports evals and regression testing on prompt performance
- Works with any provider via Vercel AI SDK (OpenAI, Anthropic, Groq, etc.)
- Free tier covers pilot volume (5K traces/month)

### What Gets Traced

```
Agent Run Trace (one per agentRun)
+-----------------------------------------------------------------------+
|  run_id: agentRun._id                                                 |
|  workspace_id: (workspace hash, no PII)                               |
|  specialist: "scheduler" | "calendar" | "email" | ...                 |
|                                                                       |
|  +-- Step 1: Context Assembly                                         |
|  |     Memory tiers queried, token count, retrieval latency           |
|  |                                                                    |
|  +-- Step 2: Orchestrator LLM Call                                    |
|  |     Model, input/output tokens, latency, intent detected           |
|  |                                                                    |
|  +-- Step 3: Specialist LLM Call                                      |
|  |     Model, input/output tokens, latency, tool call proposed        |
|  |                                                                    |
|  +-- Step 4: Policy Evaluation                                        |
|  |     Approval required? Rule matched, risk level                    |
|  |                                                                    |
|  +-- Step 5: Approval Wait                                            |
|  |     Time to approval, approved/rejected/expired                    |
|  |                                                                    |
|  +-- Step 6: Tool Execution                                           |
|  |     Tool name, latency, success/failure, retry count               |
|  |                                                                    |
|  +-- Step 7: Response Delivery                                        |
|        Channel (WhatsApp/dashboard), delivery latency                 |
+-----------------------------------------------------------------------+
|  Total: latency, cost, token usage, outcome                           |
+-----------------------------------------------------------------------+
```

### Integration Architecture

```
Convex Action (agent run)
      |
      |  1. Wrap LLM calls with LangSmith traceable()
      |
      v
  Vercel AI SDK  ------>  LLM Provider (Anthropic, OpenAI, etc.)
      |
      |  2. LangSmith callback auto-captures:
      |     - input/output
      |     - token counts
      |     - latency
      |     - model name
      |
      v
  LangSmith Cloud  <----  Trace data (async, non-blocking)
      |
      +-- Dashboard: trace explorer, latency p50/p95/p99
      +-- Evals: prompt regression tests, quality scoring
      +-- Alerts: cost spike, latency degradation, error rate
      +-- Datasets: collect production examples for testing
```

### Key Metrics Tracked

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Run latency (e2e) | LangSmith trace | p95 > 30s |
| LLM latency per call | LangSmith span | p95 > 10s |
| Token cost per run | LangSmith token count | > $0.50/run |
| Tool call failure rate | LangSmith span | > 5% per hour |
| Approval wait time | LangSmith span | p95 > 4 hours |
| Memory retrieval latency | LangSmith span | p95 > 2s |

### PII Redaction in Traces

Message content and user names are **not** sent to LangSmith. Traces include:
- Workspace ID (hashed)
- Run/step IDs
- Model names, token counts, latency
- Tool names and success/failure status
- Approval decisions (approve/reject/expire)
- Error types (not error messages containing user data)

Input/output content sent to LangSmith uses the same redaction pipeline as the audit trail (see Trace Redaction above).

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `LANGCHAIN_API_KEY` | Convex dashboard | LangSmith API key |
| `LANGCHAIN_PROJECT` | Convex dashboard | Project name (e.g., `ecqqo-pilot`) |
| `LANGCHAIN_TRACING_V2` | Convex dashboard | Set to `true` to enable tracing |

## Security Checklist for Pilot Launch

```
[x] Clerk JWT validation on all Convex functions
[x] Workspace isolation (all queries scoped by workspaceId)
[x] Role-based access control enforced server-side
[x] HMAC-SHA256 signing for connector-to-Convex communication
[x] Anti-replay protection (5-minute timestamp window)
[x] Worker lease system (one worker per workspace)
[x] Meta webhook signature verification
[x] Rate limiting on inbound message processing
[x] Kill-switch controls for all sensitive subsystems
[x] Audit trail for security-relevant events
[x] No PII in logs or error traces
[x] Metadata-first sync (full content requires allowlist)
[x] Session artifacts encrypted at rest
[x] OAuth tokens encrypted at rest
[x] Unofficial client risk disclosure for pilot users
[ ] Penetration testing (scheduled pre-launch)
[ ] SOC 2 Type I (post-pilot roadmap)
[ ] Bug bounty program (post-launch roadmap)
```
