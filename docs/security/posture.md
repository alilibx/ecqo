# Security Posture

This document describes Ecqqo's security architecture, threat model, and operational controls. Ecqqo handles sensitive personal and business data on behalf of high-net-worth individuals, so security is not an afterthought -- it is a core product requirement.

## Security Architecture

<script setup>
const secArchConfig = {
  layers: [
    {
      id: "sec-client",
      title: "Client",
      subtitle: "Browser · Dashboard",
      icon: "fa-globe",
      color: "teal",
      nodes: [
        { id: "sa-browser", icon: "fa-globe", title: "Browser", subtitle: "Dashboard (TLS 1.3 + JWT)" },
      ],
    },
    {
      id: "sec-edge",
      title: "Edge",
      subtitle: "Vercel · SSR + CDN",
      icon: "si:vercel",
      color: "warm",
      nodes: [
        { id: "sa-vercel", icon: "si:vercel", title: "Vercel Edge", subtitle: "SSR + CDN" },
      ],
    },
    {
      id: "sec-backend",
      title: "Backend",
      subtitle: "Convex Cloud",
      icon: "si:convex",
      color: "teal",
      nodes: [
        { id: "sa-rbac", icon: "fa-users", title: "RBAC", subtitle: "JWT + Roles + WS" },
        { id: "sa-db", icon: "fa-database", title: "Database", subtitle: "Encrypted at Rest" },
        { id: "sa-fns", icon: "fa-code", title: "Functions", subtitle: "Mutations · Queries · Actions" },
      ],
    },
    {
      id: "sec-workers",
      title: "Workers",
      subtitle: "Fly.io · Isolated Sessions",
      icon: "si:flydotio",
      color: "red",
      nodes: [
        { id: "sa-fly", icon: "si:flydotio", title: "Fly.io Workers", subtitle: "Encrypted Sessions" },
      ],
    },
    {
      id: "sec-wa",
      title: "WhatsApp",
      subtitle: "Meta Cloud API · User Chats",
      icon: "si:whatsapp",
      color: "dark",
      nodes: [
        { id: "sa-meta", icon: "si:meta", title: "Meta Cloud API", subtitle: "Outbound WA" },
        { id: "sa-wa", icon: "si:whatsapp", title: "WhatsApp", subtitle: "User Chats (E2E)" },
      ],
    },
  ],
  connections: [
    { from: "sa-browser", to: "sa-vercel", label: "TLS 1.3 + JWT" },
    { from: "sa-vercel", to: "sa-rbac", label: "authed reqs" },
    { from: "sa-fns", to: "sa-fly", label: "HMAC-SHA256" },
    { from: "sa-fns", to: "sa-meta", label: "HMAC-SHA256" },
    { from: "sa-meta", to: "sa-rbac", label: "webhook" },
    { from: "sa-fly", to: "sa-wa", label: "WA Web (E2E)" },
  ],
}

const rolesConfig = {
  layers: [
    {
      id: "role-owner",
      title: "Owner",
      subtitle: "Full Control",
      icon: "fa-user",
      color: "red",
      nodes: [
        { id: "rl-owner", icon: "fa-user", title: "Owner", subtitle: "Settings · Members · Billing" },
        { id: "rl-owner-perms", icon: "fa-gear", title: "Permissions", subtitle: "Kill switches · Batch approve" },
      ],
    },
    {
      id: "role-principal",
      title: "Principal",
      subtitle: "Approve + View Own",
      icon: "fa-user",
      color: "warm",
      nodes: [
        { id: "rl-principal", icon: "fa-user", title: "Principal", subtitle: "Inherits from Owner" },
        { id: "rl-principal-perms", icon: "fa-circle-check", title: "Permissions", subtitle: "Approve/reject · View own" },
      ],
    },
    {
      id: "role-operator",
      title: "Operator",
      subtitle: "Triage + Monitor",
      icon: "fa-user",
      color: "teal",
      nodes: [
        { id: "rl-operator", icon: "fa-user", title: "Operator", subtitle: "Inherits from Principal" },
        { id: "rl-operator-perms", icon: "fa-magnifying-glass", title: "Permissions", subtitle: "View all · Triage · Read-only" },
      ],
    },
  ],
  connections: [
    { from: "rl-owner", to: "rl-principal", label: "inherits +" },
    { from: "rl-principal", to: "rl-operator", label: "inherits +" },
  ],
}

const langsmithConfig = {
  layers: [
    {
      id: "ls-source",
      title: "Agent Runtime",
      subtitle: "Convex Actions",
      icon: "fa-code",
      color: "teal",
      nodes: [
        { id: "ls-action", icon: "fa-code", title: "Convex Action", subtitle: "Agent Run" },
      ],
    },
    {
      id: "ls-sdk",
      title: "AI SDK",
      subtitle: "Provider Interface + Tracing",
      icon: "fa-plug",
      color: "warm",
      nodes: [
        { id: "ls-sdk-node", icon: "fa-plug", title: "Vercel AI SDK", subtitle: "traceable()" },
        { id: "ls-llm", icon: "fa-brain", title: "LLM Provider", subtitle: "OpenAI · Anthropic" },
      ],
    },
    {
      id: "ls-observability",
      title: "Observability",
      subtitle: "LangSmith · Traces · Alerts",
      icon: "fa-chart-line",
      color: "dark",
      nodes: [
        { id: "ls-explorer", icon: "fa-magnifying-glass", title: "Trace Explorer", subtitle: "p50 / p95 / p99" },
        { id: "ls-evals", icon: "fa-list-check", title: "Prompt Regression", subtitle: "Eval Suites" },
        { id: "ls-alerts", icon: "fa-triangle-exclamation", title: "Alerts", subtitle: "Cost · Latency" },
      ],
    },
  ],
  connections: [
    { from: "ls-action", to: "ls-sdk-node", label: "traceable()" },
    { from: "ls-sdk-node", to: "ls-llm" },
    { from: "ls-sdk-node", to: "ls-explorer", label: "async trace" },
    { from: "ls-llm", to: "ls-explorer" },
  ],
}

const dualPath1Config = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "dp1-wa", icon: "fa-comments", title: "WhatsApp", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "dp1-worker", icon: "fa-server", title: "Fly.io Worker", row: 0, col: 1, shape: "rect", color: "warm" },
    { id: "dp1-convex", icon: "fa-cloud", title: "Convex", row: 0, col: 2, shape: "rect", color: "teal" },
  ],
  edges: [
    { from: "dp1-wa", to: "dp1-worker", label: "WA Web (E2E)" },
    { from: "dp1-worker", to: "dp1-wa", label: "WA Web (E2E)" },
    { from: "dp1-worker", to: "dp1-convex", label: "HMAC-signed" },
  ],
}

const dualPath2Config = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "dp2-meta", icon: "fa-globe", title: "Meta Platform", row: 0, col: 0, shape: "rect", color: "dark" },
    { id: "dp2-convex", icon: "fa-cloud", title: "Convex", row: 0, col: 1, shape: "rect", color: "teal" },
  ],
  edges: [
    { from: "dp2-meta", to: "dp2-convex", label: "Webhook (verified)" },
    { from: "dp2-convex", to: "dp2-meta", label: "Bearer token" },
  ],
}

const clerkJwtConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "cj-browser", icon: "fa-globe", title: "Browser", row: 0, col: 1, shape: "pill", color: "teal" },
    { id: "cj-clerk", icon: "fa-key", title: "Clerk SDK", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "cj-jwt", icon: "fa-key", title: "JWT issued", row: 2, col: 1, shape: "rect", color: "warm" },
    { id: "cj-fn", icon: "fa-code", title: "Convex fn called", row: 3, col: 1, shape: "rect", color: "teal" },
    { id: "cj-identity", icon: "fa-user", title: "getUserIdentity()", row: 4, col: 1, shape: "rect", color: "teal" },
    { id: "cj-reject401", icon: "fa-circle-xmark", title: "Reject 401", row: 5, col: 0, shape: "pill", color: "red" },
    { id: "cj-extract", icon: "fa-user", title: "Extract userId, wsId, role", row: 5, col: 2, shape: "rect", color: "teal" },
    { id: "cj-membership", icon: "fa-users", title: "Check WS membership", row: 6, col: 2, shape: "rect", color: "teal" },
    { id: "cj-reject403", icon: "fa-circle-xmark", title: "Reject 403", row: 7, col: 1, shape: "pill", color: "red" },
    { id: "cj-role", icon: "fa-shield-halved", title: "Check role perms", row: 7, col: 3, shape: "rect", color: "blue" },
    { id: "cj-execute", icon: "fa-circle-check", title: "Execute (scoped)", row: 8, col: 3, shape: "pill", color: "teal" },
  ],
  edges: [
    { from: "cj-browser", to: "cj-clerk" },
    { from: "cj-clerk", to: "cj-jwt" },
    { from: "cj-jwt", to: "cj-fn" },
    { from: "cj-fn", to: "cj-identity" },
    { from: "cj-identity", to: "cj-reject401", label: "null" },
    { from: "cj-identity", to: "cj-extract", label: "Valid" },
    { from: "cj-extract", to: "cj-membership" },
    { from: "cj-membership", to: "cj-reject403", label: "Not member" },
    { from: "cj-membership", to: "cj-role", label: "Member" },
    { from: "cj-role", to: "cj-execute" },
  ],
}

const webhookSecConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "wh-meta", icon: "fa-globe", title: "Meta POST", subtitle: "X-Hub-Signature-256", row: 0, col: 1, shape: "pill", color: "dark" },
    { id: "wh-read", icon: "fa-code", title: "Read raw body", row: 1, col: 1, shape: "rect", color: "teal" },
    { id: "wh-hmac", icon: "fa-lock", title: "HMAC-SHA256", subtitle: "app secret", row: 2, col: 1, shape: "rect", color: "teal" },
    { id: "wh-compare", icon: "fa-scale-balanced", title: "Compare", subtitle: "constant-time", row: 3, col: 1, shape: "diamond", color: "warm" },
    { id: "wh-reject", icon: "fa-circle-xmark", title: "Reject 401", row: 4, col: 0, shape: "pill", color: "red" },
    { id: "wh-parse", icon: "fa-code", title: "Parse payload", row: 4, col: 2, shape: "rect", color: "teal" },
    { id: "wh-phone", icon: "fa-user", title: "Extract phone", row: 5, col: 2, shape: "rect", color: "teal" },
    { id: "wh-lookup", icon: "fa-magnifying-glass", title: "Lookup workspace", row: 6, col: 2, shape: "rect", color: "teal" },
    { id: "wh-rate", icon: "fa-clock", title: "Rate limit", row: 7, col: 2, shape: "diamond", color: "warm" },
    { id: "wh-route", icon: "fa-arrow-right", title: "Route to handler", row: 8, col: 3, shape: "pill", color: "teal" },
    { id: "wh-overflow", icon: "fa-triangle-exclamation", title: "Overflow", subtitle: "notify owner", row: 8, col: 1, shape: "pill", color: "red" },
  ],
  edges: [
    { from: "wh-meta", to: "wh-read" },
    { from: "wh-read", to: "wh-hmac" },
    { from: "wh-hmac", to: "wh-compare" },
    { from: "wh-compare", to: "wh-reject", label: "Mismatch" },
    { from: "wh-compare", to: "wh-parse", label: "Match" },
    { from: "wh-parse", to: "wh-phone" },
    { from: "wh-phone", to: "wh-lookup" },
    { from: "wh-lookup", to: "wh-rate" },
    { from: "wh-rate", to: "wh-route", label: "Within limits" },
    { from: "wh-rate", to: "wh-overflow", label: "Exceeded" },
  ],
}

const killSwitchConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ks-op", icon: "fa-bolt", title: "Sensitive op", subtitle: "send/run/sync", row: 0, col: 1, shape: "pill", color: "teal" },
    { id: "ks-read", icon: "fa-power-off", title: "Read killSwitches", row: 1, col: 1, shape: "rect", color: "teal" },
    { id: "ks-conn", icon: "fa-plug", title: "connector?", row: 2, col: 1, shape: "diamond", color: "warm" },
    { id: "ks-reject1", icon: "fa-circle-xmark", title: "Reject", row: 2, col: 0, shape: "pill", color: "red" },
    { id: "ks-agent", icon: "fa-robot", title: "agent?", row: 3, col: 1, shape: "diamond", color: "warm" },
    { id: "ks-reject2", icon: "fa-circle-xmark", title: "Reject", row: 3, col: 0, shape: "pill", color: "red" },
    { id: "ks-outbound", icon: "fa-paper-plane", title: "outbound?", row: 4, col: 1, shape: "diamond", color: "warm" },
    { id: "ks-reject3", icon: "fa-circle-xmark", title: "Reject", row: 4, col: 0, shape: "pill", color: "red" },
    { id: "ks-proceed", icon: "fa-circle-check", title: "Proceed", row: 5, col: 1, shape: "pill", color: "teal" },
  ],
  edges: [
    { from: "ks-op", to: "ks-read" },
    { from: "ks-read", to: "ks-conn" },
    { from: "ks-conn", to: "ks-reject1", label: "Yes" },
    { from: "ks-conn", to: "ks-agent", label: "No" },
    { from: "ks-agent", to: "ks-reject2", label: "Yes" },
    { from: "ks-agent", to: "ks-outbound", label: "No" },
    { from: "ks-outbound", to: "ks-reject3", label: "Yes" },
    { from: "ks-outbound", to: "ks-proceed", label: "No" },
  ],
}

const traceFlowConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "tf-trace", icon: "fa-robot", title: "Agent Run Trace", subtitle: "run_id, ws_hash, specialist", row: 0, col: 0, shape: "pill", color: "teal" },
    { id: "tf-s1", icon: "fa-microchip", title: "1. Context Assembly", subtitle: "memory, tokens", row: 1, col: 0, shape: "rect", color: "teal" },
    { id: "tf-s2", icon: "fa-brain", title: "2. Orchestrator LLM", subtitle: "model, intent", row: 2, col: 0, shape: "rect", color: "warm" },
    { id: "tf-s3", icon: "fa-brain", title: "3. Specialist LLM", subtitle: "tool proposed", row: 3, col: 0, shape: "rect", color: "warm" },
    { id: "tf-s4", icon: "fa-scale-balanced", title: "4. Policy Eval", subtitle: "approval? risk", row: 4, col: 0, shape: "rect", color: "blue" },
    { id: "tf-s5", icon: "fa-clock", title: "5. Approval Wait", subtitle: "time, decision", row: 5, col: 0, shape: "rect", color: "dark" },
    { id: "tf-s6", icon: "fa-gear", title: "6. Tool Exec", subtitle: "latency, retries", row: 6, col: 0, shape: "rect", color: "teal" },
    { id: "tf-s7", icon: "fa-message", title: "7. Response Delivery", subtitle: "channel, latency", row: 7, col: 0, shape: "rect", color: "teal" },
    { id: "tf-total", icon: "fa-chart-line", title: "Total", subtitle: "latency, cost, tokens, outcome", row: 8, col: 0, shape: "pill", color: "dark" },
  ],
  edges: [
    { from: "tf-trace", to: "tf-s1" },
    { from: "tf-s1", to: "tf-s2" },
    { from: "tf-s2", to: "tf-s3" },
    { from: "tf-s3", to: "tf-s4" },
    { from: "tf-s4", to: "tf-s5" },
    { from: "tf-s5", to: "tf-s6" },
    { from: "tf-s6", to: "tf-s7" },
    { from: "tf-s7", to: "tf-total" },
  ],
}

const hmacReqSeqConfig = {
  type: "sequence",
  actors: [
    { id: "hr-worker", icon: "si:flydotio", title: "Fly.io Worker", color: "red" },
    { id: "hr-convex", icon: "si:convex", title: "Convex Cloud", color: "teal" },
  ],
  steps: [
    { over: "hr-worker", note: "1. Build payload\n(wsId, event, data, ts)" },
    { over: "hr-worker", note: "2. HMAC-SHA256\n(secret, payload)" },
    { from: "hr-worker", to: "hr-convex", label: "POST /api/connector/event" },
    { over: "hr-convex", note: "3a. Check timestamp (5min)\n3b. Recompute HMAC\n3c. Constant-time compare\n3d. Reject if mismatch" },
    { from: "hr-convex", to: "hr-worker", label: "Accept or Reject", dashed: true },
  ],
}

const leaseStateConfig = {
  type: "state",
  states: [
    { id: "sec-s-start", shape: "initial", row: 0, col: 1 },
    { id: "sec-s-acquire", icon: "fa-key", title: "Acquire Lease", subtitle: "Mutation", row: 1, col: 1, color: "warm" },
    { id: "sec-s-reject", icon: "fa-ban", title: "Reject 409", subtitle: "Lease active", row: 1, col: 2, color: "red" },
    { id: "sec-s-issue", icon: "fa-lock", title: "Issue Lease", subtitle: "TTL 5 min", row: 2, col: 1, color: "teal" },
    { id: "sec-s-heartbeat", icon: "fa-heart-pulse", title: "Heartbeat", subtitle: "60s renew TTL", row: 3, col: 1, color: "dark" },
    { id: "sec-s-crash", icon: "fa-plug", title: "Lease Expires", subtitle: "Crash / disconnect", row: 4, col: 1, color: "red" },
    { id: "sec-s-new", icon: "fa-rotate", title: "New Worker", subtitle: "Acquires lease", row: 4, col: 2, color: "blue" },
    { id: "sec-s-end1", shape: "final", row: 2, col: 2 },
  ],
  transitions: [
    { from: "sec-s-start", to: "sec-s-acquire", label: "Start worker" },
    { from: "sec-s-acquire", to: "sec-s-reject", label: "Lease active" },
    { from: "sec-s-acquire", to: "sec-s-issue", label: "No active lease" },
    { from: "sec-s-reject", to: "sec-s-end1" },
    { from: "sec-s-issue", to: "sec-s-heartbeat" },
    { from: "sec-s-heartbeat", to: "sec-s-crash", label: "Crash" },
    { from: "sec-s-crash", to: "sec-s-new" },
    { from: "sec-s-new", to: "sec-s-acquire", dashed: true },
  ],
}
</script>

<ArchDiagram :config="secArchConfig" />

### Dual Ingress Paths

Ecqqo has two distinct paths for WhatsApp data:

**Path 1: Connector (wacli) -- syncs user's personal WhatsApp**

<ArchDiagram :config="dualPath1Config" />

**Path 2: Meta Cloud API -- Ecqqo's official WhatsApp Business number**

<ArchDiagram :config="dualPath2Config" />

## Authentication and Authorization

### Clerk JWT Validation

Every request to the Convex backend carries a Clerk-issued JWT. Validation happens at the Convex function level before any data access.

<ArchDiagram :config="clerkJwtConfig" />

### Role Hierarchy

<ArchDiagram :config="rolesConfig" />

### Dual Auth Model: HMAC vs RBAC

Convex functions use two distinct auth strategies depending on the caller:

| Function | File | Auth Model | Required Role |
|----------|------|------------|---------------|
| `getSession` | `connector.ts` | `requireRole()` | any (owner / principal / operator) |
| `getActiveSession` | `connector.ts` | `requireRole()` | any |
| `getAccount` | `connector.ts` | `requireRole()` | any |
| `listChats` | `connector.ts` | `requireRole()` | any |
| `listMessages` | `connector.ts` | `requireRole()` | any |
| `listDeadLetters` | `deadLetter.ts` | `requireRole()` | owner or operator |
| `getDeadLetterStats` | `deadLetter.ts` | `requireRole()` | owner or operator |
| `retryDeadLetter` | `deadLetter.ts` | `requireRole()` | owner |
| `updateChatContentPolicy` | `connector.ts` | `requireRole()` | owner or principal |
| Service mutations (ingest, heartbeat, etc.) | `connector.ts` | HMAC-SHA256 | n/a (infrastructure) |
| Supervisor mutations | `connector.ts` | HMAC-SHA256 | n/a (infrastructure) |

**Service-to-service calls** (connector worker, supervisor) keep HMAC-SHA256 signature verification — these are infrastructure calls, not user actions. **Dashboard-facing functions** accept a `workspaceId` argument and validate the caller's role via the `requireRole()` helper in `convex/users.ts`. Cross-workspace access is prevented by verifying the requested entity belongs to the caller's workspace.

### Workspace Isolation

All data is scoped to a workspace. Cross-workspace data access is structurally impossible because every Convex query filters by `workspaceId` extracted from the authenticated user's JWT claims. There is no admin API that bypasses workspace scoping.

## Data Protection

### Encryption

| Layer                  | Encryption                                          |
|------------------------|-----------------------------------------------------|
| Data in transit        | TLS 1.3 (Vercel, Convex, Fly.io all enforce HTTPS) |
| Data at rest (Convex)  | AES-256 (managed by Convex Cloud)                   |
| Session artifacts (S3) | AES-256-GCM encrypted before upload to Tigris S3 (per-file IV, key from `CONNECTOR_ENCRYPTION_KEY` via SHA-256 KDF). Backward compatible: plaintext files are detected and read without decryption. Impl: `shared/encryption.ts`, `services/connector/src/auth-sync.ts` |
| OAuth tokens           | Encrypted at rest in Convex, never exposed to client|
| WhatsApp E2E           | Signal Protocol (managed by WhatsApp, opaque to us) |

### Metadata-First Sync Policy

**Implemented in `convex/connector.ts` (`ingestMessages`), `convex/deadLetter.ts` (`processRetries`), and `convex/schema.ts` (`waChats.contentPolicy`).**

By default, the connector syncs only metadata from WhatsApp conversations. Each chat has a `contentPolicy` field (`"metadata"` | `"full"` | `"denied"`) that is checked at ingestion time -- both in the primary `ingestMessages` path and in the dead-letter retry path. Only chats with `contentPolicy: "full"` have message text stored. The `updateChatContentPolicy` mutation is RBAC-protected (owner/principal only) and validates workspace ownership.

**Default sync (all chats) — metadata only:**

> **Chat:** Ahmed Al-Mansour
> **Last message:** 2026-03-07T10:42:00Z
> **Message count:** 147
> **Chat type:** individual
> **Status:** active
>
> *No message content stored*

**Allowlisted chat (explicit user opt-in) — metadata + content:**

> **Chat:** Ahmed Al-Mansour `[ALLOWLISTED]`
> **Last message:** 2026-03-07T10:42:00Z
> **Message count:** 147
> **Chat type:** individual
> **Status:** active
>
> **Messages:**
> - [10:42] Ahmed: "Confirm the dinner for 8"
> - [10:38] Ahmed: "Did you check the venue?"
> - [10:21] You: "Yes, La Petite Maison works"

This minimizes data exposure. The agent can only read and act on conversations the user has explicitly allowlisted.

### PII Handling

- **No PII in logs**: Application logs strip phone numbers, names, and message content before emission. Structured log fields use workspace and entity IDs only.
- **No PII in error traces**: Error reporting (if integrated) receives sanitized stack traces. Message content is replaced with `[REDACTED]` in error context.
- **Trace redaction**: Agent reasoning traces that reference message content are stored with the content portions hashed. The dashboard reconstructs display from the original message reference, not from the trace.

## Connector Security

The Fly.io connector worker communicates with Convex using signed requests to prevent spoofing and replay attacks.

### HMAC-SHA256 Request Signing

**Implemented in `services/connector/src/` and `convex/connector.ts`.**

The connector signs every Convex mutation with HMAC-SHA256. Verification uses the Web Crypto API inside Convex. Anti-replay is enforced with a 5-minute timestamp window and a per-request nonce. The signing secret is configured via the `CONNECTOR_SIGNING_SECRET` environment variable. Graceful degradation: when the secret is not set (local dev), unsigned requests are accepted.

<ArchDiagram :config="hmacReqSeqConfig" />

### Worker Lease System

Each workspace has at most one active connector worker. The lease system prevents duplicate workers from running simultaneously.

<ArchDiagram :config="leaseStateConfig" />

## WhatsApp Webhook Security (Meta Cloud API)

Inbound webhooks from Meta's WhatsApp Business Platform are verified before processing.

<ArchDiagram :config="webhookSecConfig" />

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

<ArchDiagram :config="killSwitchConfig" />

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

<ArchDiagram :config="traceFlowConfig" />

### Integration Architecture

<ArchDiagram :config="langsmithConfig" />

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
[x] Anti-replay protection (5-minute timestamp window + nonce)
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
