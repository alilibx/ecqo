# Milestones & Timeline

Target: **April 15, 2026** pilot launch (5.5 weeks from March 7, 2026).
Developer count: **1** (solo). First engineering hire planned ~3 months post-pilot.

## Timeline Overview

```
Week        | Mar 7-13  | Mar 14-20 | Mar 21-27 | Mar 28-Apr 3 | Apr 4-10  | Apr 11-15
------------|-----------|-----------|-----------|--------------|-----------|----------
M0 Arch     |###########|           |           |              |           |
  A1-A5     |===========|           |           |              |           |
  B1,D1     |======     |           |           |              |           |
            |           |           |           |              |           |
M1 WA+Sync  |      =====|===========|========   |              |           |
  B2-B4     |      =====|=====      |           |              |           |
  B5-B7     |           |     ======|====       |              |           |
  C1-C3     |      =====|======     |           |              |           |
  C4-C7     |           |     ======|========   |              |           |
  H1-H2     |           |      ====|====       |              |           |
            |           |           |           |              |           |
M2 Agent    |           |           |     ======|==============|====       |
  D2-D6     |           |           |     ======|======        |           |
  E1-E6     |           |           |           |   ===========|===        |
  F1-F5     |           |           |        ===|===========   |           |
  G1-G4     |           |           |           |     =========|===        |
  J1-J5     |           |           |       ====|========      |           |
            |           |           |           |              |           |
M3 Harden   |           |           |           |         =====|===========|=====
  G5-G8     |           |           |           |         =====|=====      |
  F6-F7     |           |           |           |          ====|===        |
  H3-H7     |           |           |           |              |  =========|===
  I1-I6     |           |           |           |              |     ======|=====
```

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
