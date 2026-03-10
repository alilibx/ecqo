# Epics & Issues

10 epics covering the full Ecqqo MVP scope. Each epic lists its objective and a complete issue table with ID, title, priority (1 = must-have, 2 = should-have, 3 = nice-to-have), estimate (story points), dependencies, and acceptance criteria.

---

## Epic A: Identity, Access, and Workspace Foundation

**Objective:** Introduce secure auth and role controls for Principal/Operator workflows.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| A1 | Integrate Clerk with TanStack Start and Convex identity mapping | 1 | 5 | -- | User session resolves in frontend and Convex with stable user identity. |
| A2 | Implement workspace membership and roles (`owner`, `principal`, `operator`) | 1 | 5 | A1 | Role assignment persisted and queryable with membership invariants enforced. |
| A3 | Enforce RBAC in all privileged Convex mutations/actions | 1 | 3 | A2 | Unauthorized requests return deterministic 403 errors. **Complete — dual auth model: HMAC-SHA256 for service-to-service (connector/supervisor), `requireRole()` for all 8 dashboard-facing functions. Cross-workspace access prevented by entity-to-workspace verification.** |
| A4 | Add role-aware route guards for dashboard sections | 1 | 3 | A2 | Principal/operator views are correctly restricted in UI navigation and loaders. **Complete — `PAGE_ACCESS` map, `canAccess()`, `getAccessiblePages()`, and `requireDashboardRole()` in `app/lib/route-guards.ts`. Dashboard layout (`app/routes/dashboard/route.tsx`) enforces auth via `beforeLoad()` and passes workspaceId/role/workspaceName through route context. `getMyRole` query added to `convex/workspaces.ts`.** |
| A5 | Add auth + RBAC audit events for sensitive actions | 2 | 3 | A3 | Role changes and denied actions are logged and traceable. |

**Total estimate:** 19 SP | **Milestone:** M0

---

## Epic B: Managed WhatsApp Connector Lifecycle

**Objective:** Deliver non-technical WhatsApp account linking via server-managed workers.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| B1 | Define `waAccounts` and `waConnectSessions` schema + indexes | 1 | 3 | A2 | Schema supports one-account-per-principal invariant and lifecycle queries. |
| B2 | Build connect-session API (`POST /internal/wa/connect/session`) | 1 | 3 | B1, A3 | Session creation is RBAC-protected and idempotent. |
| B3 | Implement connector worker lease model (`waConnectorWorkers`) | 1 | 5 | B1 | Exactly one active worker lease exists per account. |
| B4 | Implement QR/auth event ingest endpoint (`/connect/{sessionId}/events`) | 1 | 5 | B2, B3 | Signed events transition connect states without illegal transitions. |
| B5 | Implement reconnect + session expiry handling | 1 | 5 | B4 | Expired/invalid sessions move to `reconnect_required` with clear recovery path. |
| B6 | Add worker heartbeat endpoint and stale detection | 2 | 3 | B3 | Missing heartbeat flips account state to `stale`/`degraded`. |
| B7 | Build dashboard Connect WhatsApp UX + live QR status | 1 | 5 | B2, B4, A4 | Non-technical user can complete connect flow end to end. |

**Total estimate:** 29 SP | **Milestone:** M0 (B1), M1 (B2--B7)

---

## Epic C: Sync, Ingestion, and Data Integrity

**Objective:** Provide periodic sync and safe ingestion with metadata-first policy.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| C1 | Define `waChats`, `waMessages`, `waSyncCursors`, `waSyncJobs` schemas | 1 | 3 | B1 | Sync entities support per-chat policy and cursor progression. |
| C2 | Implement sync ingest API (`POST /internal/wa/sync/events`) | 1 | 5 | C1, A3 | Signed events validated by schema version and account lease. **Complete — implemented as direct `ingestMessages` mutation via `ConvexHttpClient` (no HTTP route needed).** |
| C3 | Implement message idempotency key enforcement | 1 | 3 | C2 | Duplicate/replayed events do not produce duplicate records. |
| C4 | Implement periodic sync scheduler (5-min cadence) and nightly reconciliation | 1 | 5 | C2 | Sync freshness maintained and backlog catch-up runs automatically. |
| C5 | Implement metadata-first + allowlist full-content policy enforcement | 1 | 5 | C1 | Non-allowlisted chats never store full message body. |
| C6 | Add dead-letter queue + retry strategy for ingestion failures | 2 | 5 | C2 | Validation/transient failures are recoverable and observable. |
| C7 | Build sync health dashboard signals (`syncing`, `healthy`, `degraded`, `stale`) | 2 | 3 | C4, B6 | Operators can view sync freshness and failure status per account. |

**Total estimate:** 29 SP | **Milestone:** M1

---

## Epic D: Agent Runtime and Policy-Gated Execution

**Objective:** Build Convex-native orchestration with strict approval gates.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| D1 | Define `agentRuns`, `runSteps`, `toolCalls`, `approvalRequests` schemas | 1 | 3 | A2 | State and trace entities support full auditability. |
| D2 | Implement run state machine (`queued -> planning -> awaiting_approval -> executing -> terminal`) | 1 | 5 | D1 | Invalid transitions are rejected. |
| D3 | Build policy engine requiring approval for all external writes | 1 | 5 | D1 | No side-effect tool runs without approved decision record. |
| D4 | Implement approval queue API and status transitions | 1 | 5 | D3 | Approve/reject/expire states update runs deterministically. |
| D5 | Implement retry behavior for execution failures (`retry_executing`) | 2 | 3 | D2 | Retries are bounded and terminal failure is explicit. |
| D6 | Add run trace publication for dashboard observability | 2 | 3 | D2 | Operators can inspect run timeline and decision points. |

**Total estimate:** 24 SP | **Milestone:** M0 (D1), M2 (D2--D6)

---

## Epic E: Memory System (Short-Term, Episodic, Semantic, Pinned)

**Objective:** Build memory loop for high-context assistant behavior in EN/AR.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| E1 | Define `memories` schema with tier, TTL, confidence, language | 1 | 3 | A2 | Memory model supports retrieval precedence and expiry. |
| E2 | Implement post-run episodic summary pipeline | 1 | 5 | D2, E1 | Completed runs produce episodic memory records. |
| E3 | Implement semantic fact extraction with confidence scoring | 1 | 5 | E2 | Actionable facts/preferences extracted with source linkage. |
| E4 | Implement retrieval composer (pinned -> short-term -> semantic -> episodic) | 1 | 5 | E3 | Context assembly is deterministic and policy-compliant. |
| E5 | Implement pinned memory management UI and APIs | 2 | 3 | E1, F4 | Users can pin/unpin durable facts with audit trail. |
| E6 | Add EN/AR normalization and retrieval quality checks | 1 | 5 | E4 | Memory retrieval quality passes EN and AR test suite. |

**Total estimate:** 26 SP | **Milestone:** M2

---

## Epic F: Dashboard (Principal + Operator)

**Objective:** Deliver operational console for approvals, monitoring, and control.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| F1 | Build dashboard shell and IA (Connect, Inbox, Conversations, Runs, Memory, Integrations, Policy) | 1 | 5 | A4 | Pages and role navigation are complete and coherent. |
| F2 | Build Inbox approvals UI with dry-run details | 1 | 5 | D4 | Operator/principal can approve/reject with clear action context. |
| F3 | Build Conversations timeline with allowlist controls | 1 | 5 | C5 | Chat-level permissions can be managed and reflected instantly. |
| F4 | Build Runs explorer with state/status and failure diagnostics | 1 | 5 | D6 | Run lifecycle and errors are visible and filterable. |
| F5 | Build Memory explorer and controls | 2 | 5 | E4 | Memory tiers are visible, searchable, and manageable. |
| F6 | Build Integrations status page (WhatsApp, Calendar, Gmail, Reminder) | 2 | 3 | G2, B7 | Health and token/session state are visible per integration. |
| F7 | Build Policy page for approval and quiet-hour settings | 2 | 3 | D3 | Policy changes are persisted and audited. |

**Total estimate:** 31 SP | **Milestone:** M2 (F1--F5), M3 (F6--F7)

---

## Epic G: External Integrations and Capability Set

**Objective:** Deliver the feature capability roadmap with safe sequencing.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| G1 | Implement Google Calendar connection + token lifecycle | 1 | 5 | A3 | Calendar connection is stable with refresh handling. |
| G2 | Implement Calendar read tool (availability, day summary) | 1 | 5 | G1, D3 | Agent answers calendar-check requests accurately. |
| G3 | Implement Calendar write tool (event create/update) under approval gate | 1 | 5 | G2, D4 | Scheduling actions require and respect approvals. |
| G4 | Implement reminder scheduler and delivery tool | 1 | 5 | D3 | Reminders trigger reliably and are auditable. |
| G5 | Implement Gmail connection foundation (scopes, token health) | 2 | 3 | A3 | Gmail connect state is visible and valid for future workflows. |
| G6 | Implement Email digest capability (unread/flagged/key contacts) | 2 | 8 | G5, D3 | Digest responses are concise and source-grounded. |
| G7 | Implement Travel coordination extraction to calendar proposal | 2 | 5 | G3, D3 | Flight/travel details generate approval-gated calendar proposals. |
| G8 | Implement Meeting briefs capability over memory + calendar + email context | 2 | 8 | G6, E4 | Brief output includes agenda, attendee context, and relevant prior notes. |

**Total estimate:** 44 SP | **Milestone:** M2 (G1--G4), M3 (G5--G8)

---

## Epic H: Security, Observability, and Pilot Operations

**Objective:** Make the system safe and operable under pilot conditions.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| H1 | Encrypt connector session artifacts and third-party tokens at rest | 1 | 5 | B3, G1 | Secrets are encrypted with scoped access controls. |
| H2 | Implement signed request verification + anti-replay checks | 1 | 5 | B4, C2 | All connector ingress enforces signature and timestamp window. |
| H3 | Implement immutable audit event stream for security-critical actions | 1 | 3 | A5, D4 | Approval, policy, and connect/sync events are fully traceable. |
| H4 | Add trace redaction policy for sensitive message fragments | 2 | 3 | D6 | Sensitive values are not exposed in dashboards/logs. |
| H5 | Integrate LangSmith for agent observability (tracing, evals, monitoring) | 1 | 5 | D2, D6 | All agent runs produce LangSmith traces with latency, token usage, tool calls, and approval outcomes. Prompt performance is measurable. |
| H6 | Build kill-switch controls for connector fleet and ingestion pipeline | 1 | 3 | H2 | Owner can disable risky paths immediately without deployment. |
| H7 | Author pilot runbooks (incident response, reconnect, rollback) | 1 | 3 | H5, H6 | On-call can execute standardized recovery procedures. |

**Total estimate:** 27 SP | **Milestone:** M1 (H1--H2), M3 (H3--H7)

---

## Epic I: QA, Release Readiness, and Acceptance

**Objective:** Verify production quality against architecture and product criteria.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| I1 | Build unit suite for state machines and policy invariants | 1 | 5 | D2, D3 | Transition and approval invariants are fully tested. |
| I2 | Build integration suite for connect/sync ingress and idempotency | 1 | 5 | B4, C3 | Duplicate/replayed payloads are safely handled. |
| I3 | Build E2E suite for principal/operator workflows | 1 | 8 | F1--F7 | Critical dashboard journeys pass in CI. |
| I4 | Build chaos tests for worker crash, stale heartbeat, retry recovery | 2 | 5 | B6, C6, D5 | Recovery behavior matches architecture runbooks. |
| I5 | Run EN/AR memory and response quality evaluation set | 1 | 5 | E6, G2--G8 | Quality bar is met for bilingual scenarios. |
| I6 | Execute pilot gate checklist and release recommendation | 1 | 3 | H1--H7, I1--I5 | Go/no-go decision includes explicit gate evidence. |

**Total estimate:** 31 SP | **Milestone:** M3

---

## Epic J: Billing & Subscription (NEW)

**Objective:** Integrate Stripe for subscription billing, plan enforcement, and self-service management.

| ID | Title | Priority | Est | Depends On | Acceptance Criteria |
|---|---|---:|---:|---|---|
| J1 | Integrate Stripe with Convex (customer creation, webhook handler) | 1 | 5 | A1 | Stripe customer created on signup, webhook events processed idempotently. |
| J2 | Implement subscription plans (Founder, Dreamer, Custom) | 1 | 3 | J1 | Plans match pricing table, upgrades/downgrades work correctly. |
| J3 | Add billing portal and plan selection to dashboard | 1 | 5 | J2, F1 | Users can manage subscription and payment methods from dashboard. |
| J4 | Enforce plan limits (principals per workspace) | 1 | 3 | J2, A2 | Exceeding plan limits blocks relevant actions with clear error message. |
| J5 | Add trial period and grace period handling | 2 | 3 | J2 | Trial expiry and payment failure handled gracefully with user notification. |

**Total estimate:** 19 SP | **Milestone:** M2

---

## Summary

| Epic | Name | Issues | SP | Milestone |
|------|------|-------:|---:|-----------|
| A | Identity, Access, and Workspace Foundation | 5 | 19 | M0 |
| B | Managed WhatsApp Connector Lifecycle | 7 | 29 | M0-M1 |
| C | Sync, Ingestion, and Data Integrity | 7 | 29 | M1 |
| D | Agent Runtime and Policy-Gated Execution | 6 | 24 | M0-M2 |
| E | Memory System | 6 | 26 | M2 |
| F | Dashboard (Principal + Operator) | 7 | 31 | M2-M3 |
| G | External Integrations and Capability Set | 8 | 44 | M2-M3 |
| H | Security, Observability, and Pilot Operations | 7 | 27 | M1-M3 |
| I | QA, Release Readiness, and Acceptance | 6 | 31 | M3 |
| J | Billing & Subscription | 5 | 19 | M2 |
| **TOTAL** | | **64** | **279** | |
