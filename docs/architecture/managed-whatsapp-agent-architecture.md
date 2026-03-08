# Managed WhatsApp Agent Architecture (Server-Managed `wacli`)

Date: March 7, 2026  
Status: Architecture approved for implementation handoff

## 1. Title and Decision Snapshot
Ecqqo operates a server-managed WhatsApp ingestion and agent platform for non-technical users. Users authenticate in the Ecqqo dashboard, link WhatsApp by scanning a QR code, and receive AI assistance based on periodically synced conversation context.

Locked architectural decisions:
- Managed server-side `wacli` sessions per user account.
- Pilot-only rollout with explicit risk controls and instant kill-switch.
- V1 WhatsApp path is read-only (ingestion/context only, no outbound via unofficial client).
- Metadata-first sync by default; full message body sync only for explicitly allowlisted chats.
- Clerk authentication with workspace RBAC (`owner`, `principal`, `operator`).
- Convex-native orchestrator and workflow state management.
- English and Arabic support in runtime, memory extraction, and dashboard views.
- Approval-required execution for all external side-effect tools.

## 2. Goals and Non-Goals
### Goals
- Deliver non-technical onboarding for connecting a personal WhatsApp account.
- Maintain reliable, idempotent, and observable periodic sync.
- Provide memory-backed agent reasoning over approved chat data.
- Provide a dual-role operations dashboard for approvals, traceability, and health monitoring.
- Enforce strict approval gating for side-effectful actions.

### Non-Goals
- Broad public launch in the first release wave.
- Unmanaged local connector requirements for end users.
- Outbound WhatsApp sending through unofficial client path in V1.
- Multi-workspace SaaS tenancy in V1.

## 3. System Architecture
### Architectural Planes
- Experience Plane: TanStack Start dashboard with Clerk session handling and role-based page access.
- Control Plane: Convex as source of truth for identity mapping, ingestion state, policies, runs, memory, and audit.
- Connector Plane: managed worker fleet that hosts isolated `wacli` sessions and emits signed events.
- Intelligence Plane: Convex action-driven orchestration, specialist agents, memory retrieval/extraction, and approval workflow.

### Component responsibilities and trust boundaries
- Dashboard components are untrusted for privileged writes and operate only through authenticated backend contracts.
- Connector workers are trusted workload identities with scoped credentials; no direct human access to worker stores.
- Convex enforces all policy, idempotency, and RBAC decisions.
- External integrations execute only after approval state transitions.

### Deployment model
- Dashboard and Convex deploy as primary control stack.
- Connector runs as a **supervisor + child process** architecture on Fly.io:
  - One supervisor process per machine exposes an HTTP API and manages worker lifecycle.
  - Each user's WhatsApp session runs as an isolated `child_process.fork()` worker.
  - Multiple users (est. 20–50) share a single 1GB Fly.io Machine, scaling horizontally by adding machines.
  - `waMachines` table in Convex tracks machine health, capacity, and worker count.
  - Supervisor reports health periodically; Convex assigns new sessions to the least-loaded active machine.
- Session artifacts are encrypted at rest and scoped to account identity (`/tmp/wa-auth/{sessionId}/`).
- Worker-to-backend communication uses signed service requests and replay protection.
- **CI/CD**: GitHub Actions workflow (`.github/workflows/deploy-connector.yml`) auto-deploys the connector on push to `main` when files in `services/connector/`, `shared/`, or `convex/` change.

<script setup>
const componentConfig = {
  layers: [
    {
      id: "mwa-entry",
      title: "Entry Points",
      subtitle: "User Interfaces · Connectors",
      icon: "fa-globe",
      color: "teal",
      nodes: [
        { id: "mwa-dash", icon: "si:clerk", title: "Dashboard", subtitle: "Clerk Auth · SSR" },
        { id: "mwa-conn", icon: "fa-network-wired", title: "Connector Worker", subtitle: "Managed wacli" },
      ],
    },
    {
      id: "mwa-core",
      title: "Control Plane",
      subtitle: "Convex Cloud · Source of Truth",
      icon: "si:convex",
      color: "warm",
      nodes: [
        { id: "mwa-convex", icon: "si:convex", title: "Convex", subtitle: "State · Policies · Audit" },
      ],
    },
    {
      id: "mwa-intelligence",
      title: "Intelligence",
      subtitle: "AI Processing · Memory",
      icon: "fa-brain",
      color: "dark",
      nodes: [
        { id: "mwa-runtime", icon: "fa-robot", title: "Agent Runtime", subtitle: "Convex Actions" },
        { id: "mwa-memory", icon: "fa-microchip", title: "Memory Pipeline", subtitle: "Extract · Retrieve" },
      ],
    },
    {
      id: "mwa-integrations",
      title: "Integrations",
      subtitle: "External Services",
      icon: "fa-plug",
      color: "blue",
      nodes: [
        { id: "mwa-cal", icon: "si:googlecalendar", title: "Calendar", subtitle: "Events · Reminders" },
      ],
    },
  ],
  connections: [
    { from: "mwa-dash", to: "mwa-convex" },
    { from: "mwa-conn", to: "mwa-convex", label: "signed events" },
    { from: "mwa-convex", to: "mwa-runtime" },
    { from: "mwa-convex", to: "mwa-memory" },
    { from: "mwa-convex", to: "mwa-cal" },
  ],
}

const mwaConnectSeqConfig = {
  type: "sequence",
  actors: [
    { id: "mc-user", icon: "fa-user", title: "User", color: "teal" },
    { id: "mc-dash", icon: "fa-gauge", title: "Dashboard", color: "teal" },
    { id: "mc-convex", icon: "si:convex", title: "Convex", color: "warm" },
    { id: "mc-worker", icon: "fa-server", title: "Connector Worker", color: "red" },
    { id: "mc-wa", icon: "si:whatsapp", title: "WhatsApp Network", color: "dark" },
  ],
  steps: [
    { from: "mc-user", to: "mc-dash", label: "Click 'Connect WhatsApp'" },
    { from: "mc-dash", to: "mc-convex", label: "Create waConnectSession" },
    { from: "mc-convex", to: "mc-worker", label: "Allocate worker + start auth" },
    { from: "mc-worker", to: "mc-wa", label: "Initiate QR auth handshake" },
    { from: "mc-worker", to: "mc-convex", label: "Stream QR/auth events (signed)" },
    { from: "mc-convex", to: "mc-dash", label: "Push session status + QR" },
    { from: "mc-dash", to: "mc-user", label: "Render QR + status" },
    { from: "mc-user", to: "mc-wa", label: "Scan QR from Linked Devices" },
    { from: "mc-wa", to: "mc-worker", label: "Auth confirmed", dashed: true },
    { from: "mc-worker", to: "mc-convex", label: "Emit CONNECTED event" },
    { from: "mc-convex", to: "mc-dash", label: "Session connected" },
    { from: "mc-dash", to: "mc-user", label: "Show 'Connected'" },
  ],
}

const mwaSyncSeqConfig = {
  type: "sequence",
  actors: [
    { id: "ms-worker", icon: "fa-server", title: "Connector Worker", color: "red" },
    { id: "ms-wacli", icon: "si:whatsapp", title: "wacli", color: "dark" },
    { id: "ms-convex", icon: "si:convex", title: "Convex", color: "teal" },
    { id: "ms-db", icon: "fa-database", title: "Convex DB", color: "warm" },
    { id: "ms-dash", icon: "fa-gauge", title: "Dashboard", color: "teal" },
  ],
  steps: [
    { from: "ms-worker", to: "ms-wacli", label: "Run sync/follow fetch" },
    { from: "ms-wacli", to: "ms-worker", label: "Messages/chats payload", dashed: true },
    { from: "ms-worker", to: "ms-convex", label: "POST sync events (signed)" },
    { over: "ms-convex", note: "Validate signature + schema + policy" },
    { from: "ms-convex", to: "ms-db", label: "Upsert waChats/waMessages" },
    { from: "ms-convex", to: "ms-db", label: "Advance waSyncCursor" },
    { from: "ms-convex", to: "ms-dash", label: "Publish sync health" },
    { over: "ms-dash", note: "Render freshness and lag" },
  ],
}

const mwaAgentSeqConfig = {
  type: "sequence",
  actors: [
    { id: "ma-orch", icon: "si:convex", title: "Orchestrator", subtitle: "Convex", color: "teal" },
    { id: "ma-mem", icon: "fa-microchip", title: "Memory Service", color: "dark" },
    { id: "ma-agent", icon: "fa-robot", title: "Specialist Agent", color: "warm" },
    { id: "ma-policy", icon: "fa-scale-balanced", title: "Policy Engine", color: "dark" },
    { id: "ma-dash", icon: "fa-gauge", title: "Dashboard", color: "teal" },
    { id: "ma-tool", icon: "fa-wrench", title: "External Tool", color: "blue" },
  ],
  steps: [
    { from: "ma-orch", to: "ma-mem", label: "Retrieve memory context" },
    { from: "ma-mem", to: "ma-orch", label: "Memory bundle", dashed: true },
    { from: "ma-orch", to: "ma-agent", label: "Plan next action" },
    { from: "ma-agent", to: "ma-orch", label: "Proposed tool action", dashed: true },
    { from: "ma-orch", to: "ma-policy", label: "Evaluate approval policy" },
    { from: "ma-policy", to: "ma-orch", label: "Approval required", dashed: true },
    { from: "ma-orch", to: "ma-dash", label: "Create approval request" },
    { over: "ma-dash", note: "Operator approves or rejects" },
    { from: "ma-dash", to: "ma-orch", label: "Approval decision" },
    { from: "ma-orch", to: "ma-tool", label: "Execute tool action" },
    { from: "ma-tool", to: "ma-orch", label: "Execution result", dashed: true },
    { from: "ma-orch", to: "ma-dash", label: "Publish completed run" },
  ],
  groups: [
    { label: "Context Assembly", color: "dark", from: 0, to: 1 },
    { label: "Planning", color: "warm", from: 2, to: 3 },
    { label: "Approval", color: "teal", from: 4, to: 8 },
    { label: "Execution", color: "blue", from: 9, to: 11 },
  ],
}

const mwaConnectStateConfig = {
  type: "state",
  states: [
    { id: "mwa-cs-start", shape: "initial", row: 0, col: 1 },
    { id: "mwa-cs-created", icon: "fa-plus", title: "created", row: 1, col: 1, color: "warm" },
    { id: "mwa-cs-qr", icon: "fa-qrcode", title: "qr_ready", row: 2, col: 1, color: "teal" },
    { id: "mwa-cs-scanned", icon: "fa-camera", title: "scanned", row: 3, col: 0, color: "teal" },
    { id: "mwa-cs-retry", icon: "fa-rotate", title: "retry_pending", row: 2, col: 2, color: "blue" },
    { id: "mwa-cs-connected", icon: "fa-circle-check", title: "connected", row: 4, col: 0, color: "dark" },
    { id: "mwa-cs-expired", icon: "fa-hourglass", title: "expired", row: 4, col: 1, color: "red" },
    { id: "mwa-cs-failed", icon: "fa-circle-xmark", title: "failed", row: 4, col: 2, color: "red" },
    { id: "mwa-cs-end", shape: "final", row: 5, col: 1 },
  ],
  transitions: [
    { from: "mwa-cs-start", to: "mwa-cs-created" },
    { from: "mwa-cs-created", to: "mwa-cs-qr" },
    { from: "mwa-cs-qr", to: "mwa-cs-scanned" },
    { from: "mwa-cs-scanned", to: "mwa-cs-connected" },
    { from: "mwa-cs-qr", to: "mwa-cs-retry" },
    { from: "mwa-cs-retry", to: "mwa-cs-qr", dashed: true },
    { from: "mwa-cs-qr", to: "mwa-cs-expired" },
    { from: "mwa-cs-retry", to: "mwa-cs-failed" },
    { from: "mwa-cs-connected", to: "mwa-cs-end" },
    { from: "mwa-cs-expired", to: "mwa-cs-end" },
    { from: "mwa-cs-failed", to: "mwa-cs-end" },
  ],
}

const mwaSyncStateConfig = {
  type: "state",
  states: [
    { id: "mwa-sj-start", shape: "initial", row: 0, col: 1 },
    { id: "mwa-sj-queued", icon: "fa-inbox", title: "queued", row: 1, col: 1, color: "warm" },
    { id: "mwa-sj-running", icon: "fa-arrows-rotate", title: "running", row: 2, col: 1, color: "teal" },
    { id: "mwa-sj-retry", icon: "fa-rotate", title: "retry_pending", row: 2, col: 2, color: "blue" },
    { id: "mwa-sj-completed", icon: "fa-circle-check", title: "completed", row: 3, col: 0, color: "dark" },
    { id: "mwa-sj-failed", icon: "fa-circle-xmark", title: "failed", row: 3, col: 2, color: "red" },
    { id: "mwa-sj-end", shape: "final", row: 4, col: 1 },
  ],
  transitions: [
    { from: "mwa-sj-start", to: "mwa-sj-queued" },
    { from: "mwa-sj-queued", to: "mwa-sj-running" },
    { from: "mwa-sj-running", to: "mwa-sj-completed" },
    { from: "mwa-sj-running", to: "mwa-sj-retry" },
    { from: "mwa-sj-retry", to: "mwa-sj-running", dashed: true },
    { from: "mwa-sj-running", to: "mwa-sj-failed" },
    { from: "mwa-sj-completed", to: "mwa-sj-end" },
    { from: "mwa-sj-failed", to: "mwa-sj-end" },
  ],
}

const mwaAgentRunStateConfig = {
  type: "state",
  states: [
    { id: "mwa-ar-start", shape: "initial", row: 0, col: 2 },
    { id: "mwa-ar-queued", icon: "fa-inbox", title: "queued", row: 1, col: 2, color: "warm" },
    { id: "mwa-ar-planning", icon: "fa-brain", title: "planning", row: 2, col: 2, color: "teal" },
    { id: "mwa-ar-awaiting", icon: "fa-clock", title: "awaiting_approval", row: 3, col: 1, color: "warm" },
    { id: "mwa-ar-executing", icon: "fa-play", title: "executing", row: 3, col: 3, color: "teal" },
    { id: "mwa-ar-rejected", icon: "fa-ban", title: "rejected", row: 4, col: 0, color: "red" },
    { id: "mwa-ar-expired", icon: "fa-hourglass", title: "expired", row: 4, col: 1, color: "red" },
    { id: "mwa-ar-retry", icon: "fa-rotate", title: "retry_executing", row: 4, col: 3, color: "blue" },
    { id: "mwa-ar-completed", icon: "fa-circle-check", title: "completed", row: 4, col: 2, color: "dark" },
    { id: "mwa-ar-failed", icon: "fa-circle-xmark", title: "failed", row: 5, col: 3, color: "red" },
    { id: "mwa-ar-end", shape: "final", row: 6, col: 2 },
  ],
  transitions: [
    { from: "mwa-ar-start", to: "mwa-ar-queued" },
    { from: "mwa-ar-queued", to: "mwa-ar-planning" },
    { from: "mwa-ar-planning", to: "mwa-ar-awaiting" },
    { from: "mwa-ar-awaiting", to: "mwa-ar-executing" },
    { from: "mwa-ar-awaiting", to: "mwa-ar-rejected" },
    { from: "mwa-ar-awaiting", to: "mwa-ar-expired" },
    { from: "mwa-ar-executing", to: "mwa-ar-completed" },
    { from: "mwa-ar-executing", to: "mwa-ar-retry" },
    { from: "mwa-ar-retry", to: "mwa-ar-executing", dashed: true },
    { from: "mwa-ar-retry", to: "mwa-ar-failed" },
    { from: "mwa-ar-completed", to: "mwa-ar-end" },
    { from: "mwa-ar-failed", to: "mwa-ar-end" },
    { from: "mwa-ar-rejected", to: "mwa-ar-end" },
    { from: "mwa-ar-expired", to: "mwa-ar-end" },
  ],
}
</script>

### Component diagram

<ArchDiagram :config="componentConfig" />

## 4. End-to-End Flows
### Flow 1: Connect WhatsApp with QR
Trigger:
- User selects `Connect WhatsApp` in dashboard.

Sequence:
<ArchDiagram :config="mwaConnectSeqConfig" />

State changes:
- `waConnectSessions.status`: `created -> qr_ready -> scanned -> connected` or `failed`.
- `waAccounts.status`: `pending -> connected`.

Failure handling:
- QR timeout transitions session to `expired`.
- Worker crash transitions to `retry_pending`.
- Re-auth required transitions account to `reconnect_required`.

User-visible status:
- `pending`, `qr_ready`, `scanned`, `connected`, `expired`, `reconnect_required`.

### Flow 2: Periodic sync and idempotent ingestion
Trigger:
- Scheduled cadence (every 5 minutes) and continuous follow stream when worker online.

Sequence:
<ArchDiagram :config="mwaSyncSeqConfig" />

State changes:
- `waSyncJobs.status`: `queued -> running -> completed` or `failed`.
- `waAccounts.syncState`: `syncing -> healthy` or `degraded`.

Failure handling:
- Validation failures produce dead-letter records and `failed` job state.
- Transient ingest faults transition to retry queue with bounded exponential backoff.
- Missing heartbeat marks worker `stale`.

User-visible status:
- `syncing`, `healthy`, `degraded`, `stale`.

### Flow 3: Agent run lifecycle with approval gate
Trigger:
- New inbound synced message or user dashboard action requiring agent reasoning.

Sequence:
<ArchDiagram :config="mwaAgentSeqConfig" />

State changes:
- `agentRuns.status`: `queued -> planning -> awaiting_approval -> executing -> completed|failed|rejected`.
- `approvalRequests.status`: `pending -> approved|rejected|expired`.

Failure handling:
- Tool transient failure transitions run to `retry_executing`.
- Policy evaluation failure transitions run to `failed_safe`.
- Timeout at approval transitions to `expired`.

User-visible status:
- `awaiting_approval`, `executing`, `completed`, `failed`, `rejected`, `expired`.

### Flow 4: Memory extract/retrieve loop
Trigger:
- Run completion event or periodic memory maintenance pass.

Flow behavior:
- Completed runs trigger episodic summarization and semantic fact extraction.
- Facts receive confidence, language marker (`en|ar`), and TTL policy.
- Pinned memories remain until explicit removal.
- Retrieval stage composes final context in priority order: pinned -> short-term -> high-confidence semantic -> episodic.

Failure handling:
- Extraction errors move run to `memory_partial` and enqueue retry.
- Retrieval fallback returns minimal short-term context when semantic store unavailable.

User-visible status:
- Dashboard marks memory sync as `up_to_date`, `partial`, or `lagging`.

### State machines
#### Connect Session State Machine

<ArchDiagram :config="mwaConnectStateConfig" />

Terminal states:
- `connected`, `expired`, `failed`.
Retry states:
- `retry_pending`.

#### Sync Job State Machine

<ArchDiagram :config="mwaSyncStateConfig" />

Terminal states:
- `completed`, `failed`.
Retry states:
- `retry_pending`.

#### Agent Run State Machine

<ArchDiagram :config="mwaAgentRunStateConfig" />

Terminal states:
- `completed`, `failed`, `rejected`, `expired`.
Retry states:
- `retry_executing`.

## 5. Data Model and Contracts
### Primary entities
- `waAccounts`: account binding, connection status, sync health, reconnect reason.
- `waConnectSessions`: QR lifecycle and auth attempt history.
- `waChats`: chat metadata, allowlist mode, sync policy flags.
- `waMessages`: normalized message records, ingestion hash, language markers.
- `waSyncCursors`: per-account/per-chat cursor and last successful watermark.
- `waConnectorWorkers`: lease owner, heartbeat, runtime status.
- `agentRuns`: run-level orchestration state and policy context.
- `runSteps`: plan/decision/execution steps for traceability.
- `toolCalls`: dry-run payload, approved action, execution result metadata.
- `approvalRequests`: actor, decision, expiration, rationale.
- `memories`: tier, confidence, TTL, language, source linkage.
- `integrationConnections`: Google Calendar/Gmail/Reminder connection status and scope.
- `auditEvents`: immutable security and operations timeline.

### Required indexes and idempotency rules
- `waAccounts`: unique by `(workspaceId, principalId)` for V1 single-account binding.
- `waConnectSessions`: index by `(workspaceId, status, createdAt)` for recovery and dashboards.
- `waChats`: unique by `(waAccountId, chatExternalId)`.
- `waMessages`: unique idempotency index by `(waAccountId, chatExternalId, messageExternalId)`.
- `waSyncCursors`: unique by `(waAccountId, chatExternalId)`.
- `waConnectorWorkers`: index by `(waAccountId, leaseStatus)`.
- `agentRuns`: index by `(workspaceId, status, createdAt)`.
- `approvalRequests`: index by `(workspaceId, status, expiresAt)`.
- `memories`: index by `(principalId, tier, expiresAt)` and `(principalId, language)`.
- `auditEvents`: index by `(workspaceId, occurredAt)` and `(entityType, entityId)`.

### External interfaces
#### `POST /internal/wa/connect/session`
- Purpose: create a new WhatsApp connection session.
- Auth semantics: Clerk user JWT validated by dashboard backend, RBAC `owner|principal`.
- Idempotency semantics: optional idempotency key; repeated key returns same active session if present.
- Error semantics:
  - `401` unauthenticated
  - `403` role not permitted
  - `409` active connect session already exists
  - `422` workspace/principal mismatch

#### `POST /internal/wa/connect/{sessionId}/events`
- Purpose: ingest QR/auth lifecycle events from connector worker.
- Auth semantics: service HMAC signature with worker identity and timestamp window.
- Idempotency semantics: dedupe by `(sessionId, eventId)`.
- Error semantics:
  - `401` invalid signature
  - `404` unknown session
  - `409` stale or out-of-order state transition
  - `422` invalid schemaVersion/payload

#### `POST /internal/wa/sync/events`
- Purpose: ingest normalized sync events (chat metadata/messages).
- Auth semantics: service HMAC signature + worker lease token.
- Idempotency semantics: dedupe per message key `(waAccountId, chatExternalId, messageExternalId)`.
- Error semantics:
  - `401` signature invalid
  - `403` lease token not active
  - `409` cursor regression
  - `422` schema validation failure

#### `POST /internal/wa/sync/heartbeat`
- Purpose: mark worker liveness and runtime health.
- Auth semantics: service HMAC signature + worker identity.
- Idempotency semantics: last-write-wins by `(workerId, observedAt)`.
- Error semantics:
  - `401` invalid signature
  - `404` unknown worker
  - `409` worker not lease owner

### Event schema versioning policy
- All connector payloads include `schemaVersion`.
- Minor additive changes keep backward compatibility for two active versions.
- Breaking changes require new major version and dual-read window during migration.
- Unsupported versions return `422` with a version mismatch reason.

## 6. Security, Privacy, and Compliance Posture
- Per-user session isolation: each `waAccount` maps to one leased worker context and isolated encrypted store.
- Token and session artifact encryption at rest with environment-managed key hierarchy.
- Signed connector-to-backend requests with anti-replay timestamp checks.
- Chat-level allowlist policy enforced before full-content persistence and before memory extraction.
- RBAC gates across all dashboard views and mutation paths.
- Immutable audit timeline for connect/sync/policy/approval actions.
- Trace redaction for sensitive message fragments and tokens.
- Pilot consent disclosure: unofficial connector behavior and account risk posture.

## 7. Dashboard Information Architecture
### Pages
- Connect: start/retry/disconnect WhatsApp, QR status, reconnect requirements.
- Inbox: approval queue with context, dry-run previews, approve/reject actions.
- Conversations: synced thread timeline with allowlist controls.
- Runs: orchestration trace, agent decisions, execution outcomes, retry markers.
- Memory: memory tiers, confidence, TTL visibility, pin/unpin controls.
- Integrations: status and health for calendar/reminder/email connectors.
- Policy: approval policy, quiet windows, guardrails, workspace defaults.

### Role behavior
- Principal:
  - configures policy defaults
  - approves high-impact decisions
  - views memory and run history for owned context
- Operator:
  - manages daily approval queue
  - triages degraded sync and reconnect events
  - monitors run failures and retry outcomes

### Status semantics
- `connected`: active lease and recent heartbeat.
- `degraded`: ingestion or orchestration SLO breached, partial service available.
- `reconnect_required`: session invalid and user action needed.
- `syncing`: active sync job in progress.
- `stale`: heartbeat missing beyond threshold.

## 8. Sub-Agent Execution Workstreams
### Workstream A: Auth/RBAC
- Scope: Clerk identity model, workspace membership, role enforcement boundary.
- Dependencies: none.
- Handoff artifacts: access matrix, role-to-action mapping, identity schema.
- Definition of done: all privileged operations have deterministic role checks.

### Workstream B: Connector lifecycle
- Scope: worker lease model, QR auth lifecycle, reconnect semantics, heartbeat.
- Dependencies: A.
- Handoff artifacts: session lifecycle spec, worker lease contract, runbook.
- Definition of done: exactly one active worker lease per account with recoverable reconnect path.

### Workstream C: Sync/ingestion
- Scope: event normalization, idempotent writes, cursor progression, dead-letter policy.
- Dependencies: B.
- Handoff artifacts: ingest schema catalog, idempotency contract, retry policy.
- Definition of done: duplicate and out-of-order events are safely handled.

### Workstream D: Orchestration/runtime
- Scope: run state machine, specialist routing, policy checks, approval transition logic.
- Dependencies: A, C.
- Handoff artifacts: orchestration state spec, policy decision table, run trace schema.
- Definition of done: no side-effect transition bypasses approval state.

### Workstream E: Memory system
- Scope: extraction, retrieval ordering, TTL policy, EN/AR memory tagging.
- Dependencies: C, D.
- Handoff artifacts: memory tier contract, retrieval precedence spec, retention policy.
- Definition of done: context assembly is deterministic and policy-compliant.

### Workstream F: Dashboard UX
- Scope: role-aware IA, status semantics, operator workflows, principal controls.
- Dependencies: A, B, C, D, E.
- Handoff artifacts: navigation map, screen-state matrix, copy/status taxonomy.
- Definition of done: principal and operator can operate without backend intervention.

### Workstream G: Security/observability
- Scope: encryption posture, signature verification, audit trails, SLO metrics, kill-switch.
- Dependencies: all prior workstreams.
- Handoff artifacts: security controls matrix, SLO dashboard spec, incident runbooks.
- Definition of done: pilot safety controls are measurable and enforceable.

## 9. Milestones and Rollout
### M0: Architecture + contracts approved
- Architecture document ratified.
- Interface and state contracts frozen for implementation.

### M1: Connection + sync foundation
- Managed connect sessions, worker lease, heartbeat, metadata sync, allowlist policy baseline.

### M2: Runtime + memory + dashboard ops
- Agent orchestration, approval queue, run traces, memory loop, operator controls.

### M3: Pilot hardening + SLOs + runbooks
- Security hardening, reliability guardrails, incident runbooks, pilot operations dashboard.

### Pilot gates
- Connect success rate above threshold in pilot cohort.
- Sync freshness SLO met for allowlisted chats.
- Zero critical cross-user access violations.
- Approval gate invariants proven by audit checks.

### Kill-switch criteria
- Elevated account restriction events from provider ecosystem.
- Repeated signature/auth anomalies from connector fleet.
- Sustained data integrity violations (duplicate/cursor corruption).
- Manual emergency disable by owner role.

## 10. Test and Acceptance Matrix
### Unit tests
- State transition legality for connect/sync/run state machines.
- Policy engine approval requirements.
- Memory retrieval precedence and TTL expiration behavior.

### Integration tests
- QR/auth event ingestion path with signature validation.
- Sync ingestion with dedupe, cursor advancement, and retry behavior.
- Approval workflow from proposal to execution outcome.

### End-to-end tests
- Non-technical connect flow and reconnect flow.
- Operator queue handling and principal oversight paths.
- EN/AR memory-backed response relevance in dashboard traces.

### Chaos/recovery tests
- Worker crash during auth and during sync.
- Out-of-order event replay and duplicate delivery storms.
- Backend partial outage with eventual recovery and cursor continuity.

### Mandatory acceptance checks
- No cross-user data leakage.
- No duplicate message ingestion after retries/replays.
- No side-effect execution without explicit approval.
- Sync freshness SLO is met under pilot load.
- EN/AR memory retrieval quality remains within agreed QA threshold.

## 11. Risks and Mitigations
### Risk: unofficial client/account restrictions
- Mitigation: pilot-only rollout, consent disclosure, account-level kill switch, rapid disconnect controls.
- Rollback: disable connector ingress and preserve readonly historical data.

### Risk: backfill inconsistency when phone offline
- Mitigation: incremental cursor sync first, reconciliation windows, user-visible freshness status.
- Rollback: freeze full-content extraction and continue metadata-only sync.

### Risk: worker churn/session invalidation
- Mitigation: lease ownership checks, heartbeat watchdogs, controlled reconnect state.
- Rollback: quarantine affected account to `reconnect_required` with no data writes until stable.

## 12. Open Decisions Log
No unresolved architecture decisions at this stage.  
If new decisions emerge during implementation, each entry must include: decision statement, owner, due date, and impact surface.

