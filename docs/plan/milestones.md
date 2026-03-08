# Milestones & Timeline

Target: **April 15, 2026** pilot launch (5.5 weeks from March 7, 2026).
Developer count: **1** (solo). First engineering hire planned ~3 months post-pilot.

## Timeline Overview

<script setup>
const ganttWeeks = [
  { label: 'Mar 7–13', start: 0 },
  { label: 'Mar 14–20', start: 16.67 },
  { label: 'Mar 21–27', start: 33.33 },
  { label: 'Mar 28–Apr 3', start: 50 },
  { label: 'Apr 4–10', start: 66.67 },
  { label: 'Apr 11–15', start: 83.33 },
]

const ganttMilestones = [
  {
    id: 'm0', label: 'M0 Arch', fullName: 'M0: Architecture Freeze',
    dates: 'Mar 7 – 13', color: '#0d7a6a', expanded: true,
    desc: 'Lock down auth, schemas, and architectural contracts before writing application code.',
    tasks: [
      { id: 'a1-a5', name: 'A1–A5', area: 'Auth + RBAC', desc: 'Clerk integrated, workspace roles enforced, audit events flowing', dates: 'Mar 7–13', start: 0, width: 16.7 },
      { id: 'b1d1', name: 'B1, D1', area: 'Core schemas', desc: 'waAccounts, waConnectSessions, agentRuns, runSteps, toolCalls, approvalRequests tables', dates: 'Mar 7–10', start: 0, width: 10 },
    ],
    start: 0, width: 16.7,
  },
  {
    id: 'm1', label: 'M1 WA+Sync', fullName: 'M1: WhatsApp Connect + Sync',
    dates: 'Mar 10 – 27', color: '#2563eb', expanded: true,
    desc: 'Stand up the managed connector plane and prove end-to-end message ingestion.',
    tasks: [
      { id: 'b2-b4', name: 'B2–B4', area: 'Connector lifecycle', desc: 'Connect-session API, worker lease model, QR flow', dates: 'Mar 10–20', start: 8, width: 22 },
      { id: 'b5-b7', name: 'B5–B7', area: 'Connector lifecycle', desc: 'Heartbeat, reconnect handling, dashboard UX', dates: 'Mar 17–25', start: 25, width: 17 },
      { id: 'c1-c3', name: 'C1–C3', area: 'Sync pipeline', desc: 'Schemas, ingest API, idempotency', dates: 'Mar 10–20', start: 8, width: 22 },
      { id: 'c4-c7', name: 'C4–C7', area: 'Sync pipeline', desc: 'Periodic scheduler, metadata-first policy, DLQ, health signals', dates: 'Mar 17–27', start: 25, width: 22 },
      { id: 'h1-h2', name: 'H1–H2', area: 'Security baseline', desc: 'Encrypted session artifacts, signed request verification, anti-replay', dates: 'Mar 15–24', start: 22, width: 18 },
    ],
    start: 8, width: 39,
  },
  {
    id: 'm2', label: 'M2 Agent', fullName: 'M2: Agent Runtime + Memory + Dashboard',
    dates: 'Mar 22 – Apr 7', color: '#d4a017', expanded: true,
    desc: 'Bring the intelligence plane online and give operators a working console.',
    tasks: [
      { id: 'd2-d6', name: 'D2–D6', area: 'Orchestration', desc: 'Run state machine, policy engine, approval queue, retry, trace publication', dates: 'Mar 22 – Apr 1', start: 38, width: 22 },
      { id: 'e1-e6', name: 'E1–E6', area: 'Memory', desc: '4-tier memory schema, episodic summaries, semantic extraction, EN/AR normalization', dates: 'Mar 28 – Apr 7', start: 53, width: 25 },
      { id: 'f1-f5', name: 'F1–F5', area: 'Dashboard', desc: 'Shell + IA, Inbox approvals, Conversations timeline, Runs explorer, Memory explorer', dates: 'Mar 24 – Apr 5', start: 42, width: 30 },
      { id: 'g1-g4', name: 'G1–G4', area: 'Integrations', desc: 'Google Calendar connect + read/write, reminder scheduler', dates: 'Mar 28 – Apr 7', start: 53, width: 25 },
      { id: 'j1-j5', name: 'J1–J5', area: 'Billing', desc: 'Stripe integration, subscription plans, billing portal, plan limits, trial/grace', dates: 'Mar 24 – Apr 2', start: 42, width: 23 },
    ],
    start: 38, width: 40,
  },
  {
    id: 'm3', label: 'M3 Harden', fullName: 'M3: Capability Completion + Pilot Hardening',
    dates: 'Apr 2 – 15', color: '#e04b2c', expanded: true,
    desc: 'Ship remaining capabilities and prove the system is safe for real users.',
    tasks: [
      { id: 'g5-g8', name: 'G5–G8', area: 'Extended integrations', desc: 'Gmail connect, email digest, travel extraction, meeting briefs', dates: 'Apr 2–10', start: 63, width: 17 },
      { id: 'f6-f7', name: 'F6–F7', area: 'Dashboard polish', desc: 'Integrations status page, Policy settings page', dates: 'Apr 3–9', start: 66, width: 12 },
      { id: 'h3-h7', name: 'H3–H7', area: 'Security + ops', desc: 'Audit stream, trace redaction, LangSmith observability, kill-switch, runbooks', dates: 'Apr 7–15', start: 73, width: 27 },
      { id: 'i1-i6', name: 'I1–I6', area: 'QA + release', desc: 'Unit suite, integration suite, E2E suite, chaos tests, EN/AR eval, pilot gate', dates: 'Apr 8–15', start: 76, width: 24 },
    ],
    start: 63, width: 37,
  },
]
</script>

<GanttChart :milestones="ganttMilestones" :weeks="ganttWeeks" start-date="2026-03-07" end-date="2026-04-18" />

## Milestone Definitions

### M0: Architecture Freeze (Mar 7 -- 13)

Lock down auth, schemas, and architectural contracts before writing application code.

| Area | Epics / Issues | Deliverable |
|---|---|---|
| Auth + RBAC | A1 -- A5 | Clerk integrated, workspace roles enforced, audit events flowing |
| Core schemas | B1, D1 | `waAccounts`, `waConnectSessions`, `agentRuns`, `runSteps`, `toolCalls`, `approvalRequests` tables defined with indexes |
| Docs | -- | Architecture docs finalized; this plan ratified |

**Exit criteria:**
- `bun run dev` serves authenticated dashboard with role-guarded routes.
- Convex schema deploys cleanly with all M0 tables and indexes.
- Architecture doc marked "approved for implementation."

---

### M1: WhatsApp Connect + Sync (Mar 14 -- 27)

Stand up the managed connector plane and prove end-to-end message ingestion.

| Area | Epics / Issues | Deliverable |
|---|---|---|
| Connector lifecycle | B2 -- B7 | Connect-session API, worker lease model, QR flow, heartbeat, reconnect handling, dashboard UX |
| Sync pipeline | C1 -- C7 | Schemas, ingest API, idempotency, periodic scheduler, metadata-first policy, DLQ, health signals |
| Security baseline | H1 -- H2 | Encrypted session artifacts, signed request verification, anti-replay |

**Exit criteria:**
- Non-technical user completes QR connect flow in < 2 minutes.
- 5-minute periodic sync produces deduplicated, cursor-tracked message records.
- Signed-request verification rejects tampered or replayed payloads.

---

### M2: Agent Runtime + Memory + Dashboard (Mar 28 -- Apr 7)

Bring the intelligence plane online and give operators a working console.

| Area | Epics / Issues | Deliverable |
|---|---|---|
| Orchestration | D2 -- D6 | Run state machine, policy engine, approval queue, retry, trace publication |
| Memory | E1 -- E6 | 4-tier memory schema, episodic summaries, semantic extraction, retrieval composer, EN/AR normalization |
| Dashboard | F1 -- F5 | Shell + IA, Inbox approvals, Conversations timeline, Runs explorer, Memory explorer |
| Integrations | G1 -- G4 | Google Calendar connect + read/write, reminder scheduler |
| Billing | J1 -- J5 | Stripe integration, subscription plans, billing portal, plan limits, trial/grace handling |

**Exit criteria:**
- Agent processes a scheduling request end-to-end: inbound message -> plan -> approval -> calendar event created.
- Memory retrieval returns relevant context across EN and AR conversations.
- Operator can approve/reject actions from the dashboard Inbox.
- New workspace can select a plan and complete Stripe checkout.

---

### M3: Capability Completion + Pilot Hardening (Apr 8 -- 15)

Ship remaining capabilities and prove the system is safe for real users.

| Area | Epics / Issues | Deliverable |
|---|---|---|
| Extended integrations | G5 -- G8 | Gmail connect, email digest, travel extraction, meeting briefs |
| Dashboard polish | F6 -- F7 | Integrations status page, Policy settings page |
| Security + ops | H3 -- H7 | Audit stream, trace redaction, LangSmith observability, kill-switch, runbooks |
| QA + release | I1 -- I6 | Unit suite, integration suite, E2E suite, chaos tests, EN/AR quality eval, pilot gate checklist |

**Exit criteria:**
- All pilot gate criteria (below) pass.
- Runbooks exist for incident response, reconnect, and rollback.
- Kill-switch can disable connector fleet within 30 seconds.

---

## Pilot Gate Criteria

Every item must pass before inviting pilot users:

| Gate | Criterion | Status |
|------|-----------|--------|
| PG-1 | Zero cross-user data leakage in auth, sync, memory, and dashboard surfaces | [ ] |
| PG-2 | No duplicate message ingestion after retries/replays | [ ] |
| PG-3 | No side-effect execution without explicit approval | [ ] |
| PG-4 | Sync freshness SLO met (< 10 min lag for allowlisted chats under pilot load) | [ ] |
| PG-5 | EN/AR memory retrieval quality meets acceptance threshold | [ ] |
| PG-6 | Connect success rate > 95% in pilot cohort | [ ] |
| PG-7 | Kill-switch disables connector fleet in < 30 seconds | [ ] |
| PG-8 | Incident runbooks reviewed and dry-run tested | [ ] |
| PG-9 | Stripe billing active; plan enforcement verified | [ ] |
| PG-10 | Consent disclosure presented to every pilot user | [ ] |

## Risk: Aggressive Timeline for Solo Dev

5.5 weeks is tight. The plan assumes:
- 10--12 productive hours/day, 6 days/week.
- No major blockers from third-party APIs (Meta, Google, Stripe).
- Architecture is frozen at M0 -- no mid-flight redesigns.

### What can be deferred post-pilot

If the timeline slips, cut in this order:

| Priority | Scope | Deferral Impact |
|----------|-------|----------------|
| P1 MUST | Auth (A), WA connect (B1-B5), Sync (C1-C5), Basic agent + calendar (D1-D4, G1-G3), Approvals (D3-D4, F2), Billing (J1-J3) | Cannot launch without these |
| P2 SHOULD | Memory system (E1-E4), Email digest (G5-G6), Dashboard polish (F3-F5), DLQ (C6), Trial/grace (J5), Trace redaction (H4) | Degraded but functional pilot |
| P3 NICE | Travel extraction (G7), Meeting briefs (G8), Chaos tests (I4), Pinned memory UI (E5), EN/AR quality eval (I5), Worker heartbeat (B6) | No user-facing impact at pilot scale |

**Minimum viable pilot** (P1 only) could ship in ~4 weeks if P2/P3 are deferred entirely. This buys roughly 10 days of buffer.
