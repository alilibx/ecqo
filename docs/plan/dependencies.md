# Dependency Graph

This document maps the dependency relationships across all 10 epics and 64 issues, identifies the critical path, and highlights parallelization opportunities for a solo developer.

## Epic-Level Dependency DAG

```
                           +-------------------+
                           |    A: Auth/RBAC   |
                           |    (A1-A5)        |
                           +---+---+---+---+---+
                               |   |   |   |
                 +-------------+   |   |   +------------------+
                 |                 |   |                      |
                 v                 v   v                      v
     +-----------+---+   +--------+---+---+          +--------+---+
     | B: Connector  |   | D: Agent       |          | J: Billing |
     | Lifecycle     |   | Runtime        |          | & Stripe   |
     | (B1-B7)       |   | (D1-D6)        |          | (J1-J5)    |
     +---+---+-------+   +---+---+--------+          +---+--------+
         |   |                |   |                       |
         |   |                |   +---------+             |
         v   |                v             |             |
     +---+---+-------+   +---+--------+    |             |
     | C: Sync &     |   | E: Memory  |    |             |
     | Ingestion     |   | System     |    |             |
     | (C1-C7)       |   | (E1-E6)    |    |             |
     +---+-----------+   +---+--------+    |             |
         |                    |             |             |
         |   +----------------+             |             |
         |   |                              |             |
         v   v                              v             v
     +---+---+---+--------+          +-----+-------------+---+
     | G: External         |          | F: Dashboard          |
     | Integrations        |          | (F1-F7)               |
     | (G1-G8)             |          +-----------+-----------+
     +--------+------------+                      |
              |                                    |
              +----------------+-------------------+
                               |
                               v
                    +----------+-----------+
                    | H: Security &        |
                    | Observability        |
                    | (H1-H7)             |
                    +----------+-----------+
                               |
                               v
                    +----------+-----------+
                    | I: QA & Release      |
                    | Readiness            |
                    | (I1-I6)             |
                    +----------------------+
```

## Detailed Issue-Level Dependency Graph

```
A1 (Clerk auth)
 |
 +---> A2 (Workspace roles)
 |      |
 |      +---> A3 (RBAC enforcement) -----+---> B2 (Connect API)
 |      |      |                          |
 |      |      +---> A5 (Audit events)    +---> C2 (Sync ingest API)
 |      |      |      |                   |
 |      |      |      +--- H3 (Audit      +---> G1 (Calendar connect)
 |      |      |           stream)        |      |
 |      |      |                          |      +---> G2 (Cal read)
 |      |      +---> G5 (Gmail connect)   |      |      |
 |      |                                 |      |      +---> G3 (Cal write)
 |      +---> A4 (Route guards)           |      |      |      |
 |      |      |                          |      |      |      +---> G7 (Travel)
 |      |      +---> F1 (Dashboard shell) |      |      |
 |      |      |      |                   |      |      +---> F6 (Integrations)
 |      |      |      +---> F2..F5, J3    |      |
 |      |      |                          |      +---> H1 (Encryption)
 |      |                                 |
 |      +---> B1 (waAccounts schema) -----+
 |      |      |                          |
 |      |      +---> B3 (Worker lease) ---+---> B4 (QR ingest) ---> B5 (Reconnect)
 |      |      |      |                   |      |
 |      |      |      +---> B6 (Heartbeat)|      +---> H2 (Signed requests)
 |      |      |             |            |      |
 |      |      |             +---> C7     |      +---> B7 (Dashboard QR UX)
 |      |      |                          |
 |      |      +---> C1 (Sync schemas) ---+
 |      |             |                   |
 |      |             +---> C5 (Metadata  +---> C2 ---> C3 (Idempotency)
 |      |             |     policy)       |      |
 |      |             |      |            |      +---> C4 (Scheduler)
 |      |             |      +---> F3     |      |      |
 |      |             |                   |      |      +---> C7 (Health)
 |      |             |                   |      |
 |      |                                 |      +---> C6 (DLQ)
 |      |                                 |
 |      +---> D1 (Agent schemas) ---------+
 |      |      |                          |
 |      |      +---> D2 (State machine)   +---> D3 (Policy engine)
 |      |      |      |                          |
 |      |      |      +---> D5 (Retry)           +---> D4 (Approval queue)
 |      |      |      |                          |      |
 |      |      |      +---> D6 (Traces)          |      +---> F2, H3
 |      |      |             |                   |
 |      |      |             +---> F4, H4, H5    +---> G4 (Reminders)
 |      |      |                                 |
 |      |      +---> E1 (Memory schema) ---+     +---> F7 (Policy page)
 |      |             |                    |
 |      |             +---> E2 (Episodic)--+---> E3 (Semantic) ---> E4 (Retrieval)
 |      |             |                                              |
 |      |             +---> E5 (Pinned UI, needs F4)                 +---> E6 (EN/AR)
 |      |                                                            |
 |      |                                                            +---> F5 (Memory UI)
 |      |                                                            |
 |      |                                                            +---> G8 (Meeting briefs)
 |      |
 |      +---> J1 (Stripe customer) --- via A1
 |             |
 |             +---> J2 (Plans) ---> J3 (Billing portal, needs F1)
 |                    |
 |                    +---> J4 (Plan limits, needs A2)
 |                    |
 |                    +---> J5 (Trial/grace)
 |
 +--- (G5 ---> G6 ---> G8 is the Gmail path)
```

## Critical Path

The longest dependency chain determines the minimum possible project duration. Two candidates:

```
Critical Path Option 1 (Agent + Memory + Meeting Briefs):
A1 -> A2 -> A3 -> D1 -> D2 -> E1 -> E2 -> E3 -> E4 -> E6 -> G8 -> I5 -> I6
                                                                      |
Total: 12 issues, ~62 SP                                    (longest chain)


Critical Path Option 2 (Connector + Security + QA):
A1 -> A2 -> B1 -> B3 -> B4 -> B5 -> H2 -> H6 -> H7 -> I2 -> I6
                                                  |
Total: 10 issues, ~46 SP                (shorter but high-risk)
```

**Critical path is Option 1.** The chain from auth through agent runtime, memory, and advanced integrations (meeting briefs) is the longest. Any delay on D2, E3, or E4 pushes the entire project.

| Rank | ID | Why it is critical |
|------|----|--------------------|
| 1 | A1 | Everything depends on auth |
| 2 | A2 | Workspace roles unlock B1, D1, E1, J |
| 3 | D1 | Agent schemas unlock state machine |
| 4 | D2 | State machine unlocks memory + traces |
| 5 | E3 | Semantic extraction is hardest ML task |
| 6 | E4 | Retrieval composer gates G8 + F5 |

## Parallelization Opportunities

As a solo developer, true parallelism is impossible, but context-switching between loosely coupled workstreams is efficient when one stream is blocked or needs a mental break.

| Stream A | Stream B | Why they parallelize |
|----------|----------|---------------------|
| B (Connector) | D (Agent runtime) | Share only A as ancestor; no direct dependency until H1 |
| C (Sync) | E (Memory) | C produces data that E consumes, but E1-E3 can be stubbed with test data |
| J (Billing) | B/C (WA stack) | J depends only on A1; fully independent of connector work |
| F (Dashboard) | G (Integrations) | F consumes G outputs but F1 shell can be built before G delivers data |
| H (Security) | I (QA) | H must finish first, but H1-H2 can run alongside M1 connector work |

**Recommended context-switching pattern per week:**

```
Week 1 (M0):   A  ================>  (focus: auth + schemas)
                B1, D1  =====>       (schema stubs in parallel)

Week 2 (M1a):  B2-B4  ============> (AM: connector work)
                C1-C3  ============> (PM: sync pipeline)

Week 3 (M1b):  B5-B7  ============> (AM: connector polish)
                C4-C5, H1-H2  ====> (PM: sync + security)

Week 4 (M2a):  D2-D4  ============> (AM: orchestration)
                J1-J3  ============> (PM: billing)
                F1     ============> (evening: dashboard shell)

Week 5 (M2b):  E1-E4  ============> (AM: memory system)
                G1-G3  ============> (PM: calendar integration)
                F2-F4  ============> (evening: dashboard pages)

Week 6 (M3):   H3-H7  ============> (AM: security hardening)
                I1-I6  ============> (PM: testing + gate check)
                G5-G6  ============> (if time permits)
```

## Dependency Table

| Epic | Depends On | Blocks | Risk Level |
|---|---|---|---|
| **A** (Auth) | None | B, C, D, E, F, G, H, I, J | **Critical** -- delays cascade everywhere |
| **B** (Connector) | A | C, F, H, I | **High** -- external API risk (Meta/WhatsApp) |
| **C** (Sync) | A, B | E (indirectly), F, G, H, I | **High** -- data integrity is foundational |
| **D** (Runtime) | A | E, F, G, H, I | **High** -- core product value |
| **E** (Memory) | A, D | F, G (G8), I | **Medium** -- can degrade gracefully |
| **F** (Dashboard) | A, D, E, C, G | I | **Medium** -- UI can be iterative |
| **G** (Integrations) | A, D | F, H, I | **Medium** -- G5-G8 are deferrable |
| **H** (Security) | A, B, C, D | I | **High** -- pilot safety requirement |
| **I** (QA) | All | None (terminal) | **Medium** -- scoped by what ships |
| **J** (Billing) | A | F (J3) | **Low** -- Stripe is well-documented |
