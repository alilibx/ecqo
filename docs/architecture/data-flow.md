# End-to-End Data Flow

This document traces the complete path of data through the Ecqo system for two critical flows: an agent-driven scheduling request and the background message sync/ingestion pipeline.

## Flow 1: Scheduling Request

A user sends "Schedule meeting with Sarah tomorrow at 3pm" to the Ecqo WhatsApp number. Here is the complete end-to-end flow from message send to calendar confirmation.

```
 USER                META CLOUD API         CONVEX (Control Plane)
 +----------+        +---------------+      +------------------------------------------+
 |          |  msg   |               |  webhook (POST /webhook)                        |
 | WhatsApp |------->| WhatsApp      |----->| 1. Verify Meta signature                 |
 | App      |        | Business API  |      |    (HMAC-SHA256 with META_APP_SECRET)     |
 |          |        |               |      |                                          |
 |          |        +---------------+      | 2. Extract phone number + message body   |
 |          |                               |                                          |
 |          |                               | 3. Lookup user by phone number           |
 |          |                               |    +------------------+                  |
 |          |                               |    | users table      |                  |
 |          |                               |    | phone: +971...   |---> user found   |
 |          |                               |    +------------------+                  |
 |          |                               |                                          |
 |          |                               | 4. Store inbound message                 |
 |          |                               |    +------------------+                  |
 |          |                               |    | messages table   |                  |
 |          |                               |    | from: user_123   |                  |
 |          |                               |    | body: "Schedule."|                  |
 |          |                               |    | ts: 1712345600   |                  |
 |          |                               |    +------------------+                  |
 |          |                               |                                          |
 |          |                               | 5. Schedule agent run                    |
 |          |                               |    (ctx.scheduler.runAfter)              |
 |          |                               |                                          |
 +----------+                               +-------------------+----------------------+
                                                                |
                                                                | scheduled function fires
                                                                v
                                            +-------------------+----------------------+
                                            |  INTELLIGENCE PLANE (Convex Action)      |
                                            |                                          |
                                            |  6. Orchestrator starts                  |
                                            |                                          |
                                            |  7. Retrieve context:                    |
                                            |     +-----------------------------+      |
                                            |     | a. Recent messages (last 20)|      |
                                            |     | b. Vector search memories:  |      |
                                            |     |    "Sarah" -> contact info  |      |
                                            |     |    "meetings" -> prefs      |      |
                                            |     | c. User policies:           |      |
                                            |     |    calendar_approval: true  |      |
                                            |     |    default_duration: 30min  |      |
                                            |     +-----------------------------+      |
                                            |                                          |
                                            |  8. Call AI provider (Vercel AI SDK)     |
                                            |     +-----------------------------+      |
                                            |     | Provider: OpenAI gpt-4o    |      |
                                            |     | System: "You are Ecqo..."  |      |
                                            |     | Context: [memories, msgs]  |      |
                                            |     | Tools: [create_event,      |      |
                                            |     |  lookup_contact, ...]      |      |
                                            |     +-----------------------------+      |
                                            |                                          |
                                            |  9. AI returns tool call:                |
                                            |     create_event({                       |
                                            |       title: "Meeting with Sarah",       |
                                            |       date: "2026-04-06T15:00:00",       |
                                            |       duration: 30,                      |
                                            |       attendees: ["sarah@email.com"]     |
                                            |     })                                   |
                                            |                                          |
                                            | 10. Policy check: calendar_approval=true |
                                            |     --> Approval required                |
                                            |                                          |
                                            +-------------------+----------------------+
                                                                |
                                                                | create approval record
                                                                v
 OPERATOR            META CLOUD API         +-------------------+----------------------+
 +----------+        +---------------+      |                                          |
 |          |  notif |               | send | 11. Create approval request              |
 | WhatsApp |<-------| WhatsApp      |<-----+     +-------------------------+          |
 | App      |        | Business API  |      |     | approvals table         |          |
 | (Operator)|       |               |      |     | type: calendar_create   |          |
 |          |        +---------------+      |     | status: pending         |          |
 |          |                               |     | payload: {event data}   |          |
 |          |  "Approve meeting with        |     | run_id: run_456         |          |
 |          |   Sarah tomorrow 3pm?         |     +-------------------------+          |
 |          |   Reply YES or NO"            |                                          |
 |          |                               | 12. Send approval request to operator    |
 |          |--------- "YES" ------------->|     via Meta Cloud API                    |
 |          |                               |                                          |
 |          |        +---------------+      | 13. Operator replies "YES"               |
 |          |        | WhatsApp      |----->|     - Webhook receives reply             |
 |          |        | Business API  |      |     - Match to pending approval          |
 |          |        +---------------+      |     - Update status: approved            |
 |          |                               |                                          |
 +----------+                               | 14. Resume agent run                     |
                                            |                                          |
                                            +-------------------+----------------------+
                                                                |
                                                                | approval granted
                                                                v
                                            +-------------------+----------------------+
                                            |  TOOL EXECUTION                          |
                                            |                                          |
                                            | 15. Call Google Calendar API             |
                                            |     +-----------------------------+      |
                                            |     | POST /calendars/.../events  |      |
                                            |     | Authorization: Bearer ...   |      |
                                            |     | {                           |      |
                                            |     |   summary: "Meeting w/     |      |
                                            |     |             Sarah",        |      |
                                            |     |   start: {dateTime: ...},  |      |
                                            |     |   end: {dateTime: ...},    |      |
                                            |     |   attendees: [...]         |      |
                                            |     | }                          |      |
                                            |     +-----------------------------+      |
                                            |                                          |
                                            | 16. Store result in agent run            |
                                            |     +-----------------------------+      |
                                            |     | agent_runs table            |      |
                                            |     | status: completed           |      |
                                            |     | result: {eventId, link}     |      |
                                            |     +-----------------------------+      |
                                            |                                          |
                                            | 17. Log to audit trail                   |
                                            |     +-----------------------------+      |
                                            |     | audit_log table             |      |
                                            |     | action: calendar_create     |      |
                                            |     | actor: agent                |      |
                                            |     | approved_by: operator_789   |      |
                                            |     | timestamp: 1712345800       |      |
                                            |     +-----------------------------+      |
                                            |                                          |
                                            +-------------------+----------------------+
                                                                |
                                                                | compose response
                                                                v
 USER                META CLOUD API         +-------------------+----------------------+
 +----------+        +---------------+      |                                          |
 |          |  msg   |               | send | 18. Send confirmation via WhatsApp       |
 | WhatsApp |<-------| WhatsApp      |<-----+     "Done! Meeting with Sarah            |
 | App      |        | Business API  |      |      scheduled for tomorrow at 3:00 PM.  |
 |          |        |               |      |      Calendar link: https://..."          |
 |          |        +---------------+      |                                          |
 |          |                               | 19. Extract & store memory               |
 |          |                               |     +-----------------------------+      |
 |          |                               |     | memory table (vector)       |      |
 |          |                               |     | fact: "User has meetings    |      |
 |          |                               |     |  with Sarah (sarah@...)"   |      |
 |          |                               |     | embedding: [0.12, -0.34...]|      |
 |          |                               |     +-----------------------------+      |
 |          |                               |                                          |
 +----------+                               +------------------------------------------+
```

### Timing Breakdown (Typical)

| Step | Time | Cumulative |
|------|------|------------|
| Meta webhook delivery | ~200ms | 200ms |
| Signature verify + user lookup | ~50ms | 250ms |
| Message store + schedule run | ~100ms | 350ms |
| Context assembly (vector search) | ~150ms | 500ms |
| AI provider call (gpt-4o) | ~2-4s | 3-4s |
| Approval request sent | ~300ms | 3.5-4.5s |
| *--- waiting for operator ---* | *variable* | |
| Operator approval received | ~200ms | +200ms |
| Google Calendar API call | ~500ms | +700ms |
| Confirmation sent to user | ~300ms | +1000ms |
| **Total (excluding approval wait)** | **~4-6 seconds** | |

## Flow 2: Message Sync / Ingestion (wacli)

The wacli connector worker on Fly.io syncs historical and ongoing messages from WhatsApp Web into Convex. This runs independently of the Cloud API webhook flow and provides richer context.

```
  WHATSAPP WEB                FLY.IO MACHINE              CONVEX
  NETWORK                     (wacli worker)              (Control Plane)
  +----------------+          +-------------------+       +------------------------+
  |                |          |                   |       |                        |
  |                |  wacli   | 1. Machine boot   |       | 0. Convex starts       |
  |                |  session |    (via Fly API)  |<------+    machine via         |
  |                |          |                   |       |    Fly.io Machines API  |
  |                |          |                   |       |                        |
  |                |          | 2. Load service   |       |                        |
  |                |          |    token + user ID|       |                        |
  |                |          |    from env vars  |       |                        |
  |                |          |                   |       |                        |
  |                |<---------|3. Connect to      |       |                        |
  |                |  WS conn |   WhatsApp Web    |       |                        |
  |                |--------->|   (WebSocket)     |       |                        |
  |                |  session |                   |       |                        |
  |                |  active  |                   |       |                        |
  |                |          |                   |       |                        |
  |                |          | 4. Fetch sync     |       |                        |
  |                |          |    cursor from    |------>| Return last cursor     |
  |                |          |    Convex         |<------| for this user          |
  |                |          |                   |       | +--------------------+ |
  |                |          |                   |       | | ingestion_state    | |
  |                |          |                   |       | | user: user_123     | |
  |                |          |                   |       | | cursor: msg_99872  | |
  |                |          |                   |       | | last_sync: 17123.. | |
  |                |          |                   |       | +--------------------+ |
  |                |          |                   |       |                        |
  +----------------+          +-------------------+       +------------------------+
         |                           |                           |
         |    PERIODIC SYNC LOOP     |                           |
         |    (every 30-60 seconds)  |                           |
         v                           v                           v
  +----------------+          +-------------------+       +------------------------+
  |                |  fetch   |                   |       |                        |
  |  Message       |--------->| 5. Fetch messages |       |                        |
  |  history       |  msgs    |    since cursor   |       |                        |
  |  (encrypted    |  after   |                   |       |                        |
  |   in transit)  |  cursor  |                   |       |                        |
  |                |          | 6. For each new   |       |                        |
  |                |          |    message:        |       |                        |
  |  Contact       |--------->|    - Normalize    |       |                        |
  |  metadata      |  contact |      format       |       |                        |
  |                |  info    |    - Compute       |       |                        |
  |                |          |      dedup hash   |       |                        |
  |  Group         |--------->|    - Attach        |       |                        |
  |  metadata      |  group   |      metadata     |       |                        |
  |                |  info    |                   |       |                        |
  +----------------+          +-------------------+       +------------------------+
                                     |                           |
                                     |                           |
                                     v                           v
                              +-------------------+       +------------------------+
                              |                   |       |                        |
                              | 7. Sign event     | POST  | 8. Validate event      |
                              |    batch with     |------>|    signature           |
                              |    CONNECTOR_     |       |    (HMAC-SHA256)       |
                              |    SIGNING_KEY    |       |                        |
                              |                   |       | 9. Idempotent upsert   |
                              |    Payload:       |       |    for each message:   |
                              |    {              |       |                        |
                              |      user_id,     |       |    +----------------+  |
                              |      messages: [  |       |    | IF dedup_hash  |  |
                              |        {          |       |    | exists:        |  |
                              |          id,      |       |    |   SKIP         |  |
                              |          from,    |       |    | ELSE:          |  |
                              |          body,    |       |    |   INSERT msg   |  |
                              |          ts,      |       |    +----------------+  |
                              |          hash,    |       |                        |
                              |          media?,  |       | 10. Advance cursor     |
                              |        }, ...     |       |     +----------------+ |
                              |      ],           |       |     | ingestion_state| |
                              |      cursor,      |       |     | cursor: NEW    | |
                              |      signature    |       |     | last_sync: NOW | |
                              |    }              |       |     +----------------+ |
                              |                   |       |                        |
                              +-------------------+       | 11. Trigger memory     |
                                                          |     extraction for     |
                                                          |     new messages       |
                                                          |                        |
                                                          |     +----------------+ |
                                                          |     | For each new   | |
                                                          |     | message:       | |
                                                          |     |  - Extract     | |
                                                          |     |    facts       | |
                                                          |     |  - Generate    | |
                                                          |     |    embeddings  | |
                                                          |     |  - Store in    | |
                                                          |     |    vector idx  | |
                                                          |     +----------------+ |
                                                          |                        |
                                                          +------------------------+
```

### Sync Guarantees

| Property | Mechanism |
|----------|-----------|
| Exactly-once delivery | Deduplication hash (SHA-256 of sender + timestamp + body) checked before insert. Duplicate messages from overlapping syncs are silently dropped. |
| Ordering | Messages stored with original WhatsApp timestamp. Cursor advances only after successful batch commit. If a batch fails, the cursor stays put and the next sync retries from the same point. |
| Crash recovery | Cursor is persisted in Convex after each successful batch. If the Fly.io machine crashes: (1) Convex detects missed health check, (2) Convex restarts the machine, (3) Machine fetches last cursor and resumes. No messages are lost; some may be re-fetched (handled by dedup). |
| Authentication | Every event batch is signed with CONNECTOR_SIGNING_KEY (HMAC-SHA256). Convex rejects unsigned or incorrectly signed payloads. |
| Isolation | Each machine's service token is scoped to a single user_id. A compromised worker cannot read or write another user's data. |

## Data Sensitivity Classification

| Data Category | Storage Location | Sensitivity | Encryption | Retention |
|---|---|---|---|---|
| **Phone numbers** | Convex `users` table | PII - High | Encrypted at rest (Convex managed) | Until account deletion |
| **Message content** | Convex `messages` table | PII - High | Encrypted at rest; in transit via TLS | Configurable per user (default: 1 year) |
| **Contact metadata** | Convex `contacts` table | PII - Medium | Encrypted at rest | Until account deletion |
| **Memory embeddings** | Convex vector index | Derived PII - Medium | Encrypted at rest | Pruned after 90 days of irrelevance |
| **Extracted facts** | Convex `memory` table | PII - High | Encrypted at rest | Pruned after 90 days of irrelevance |
| **OAuth tokens** | Convex (encrypted field) | Secret - Critical | AES-256 encrypted field + at rest | Revoked on disconnect; refreshed automatically |
| **API keys** | Convex env vars, Fly.io secrets | Secret - Critical | Platform-managed secret storage | Rotated quarterly |
| **Agent run logs** | Convex `agent_runs` table | Internal - Medium | Encrypted at rest | 6 months |
| **Audit log** | Convex `audit_log` table | Compliance - High | Encrypted at rest; append-only | 2 years minimum |
| **Billing data** | Stripe (primary), Convex (mirror) | Financial - High | Stripe PCI compliance; Convex encrypted at rest | Per Stripe retention policy |
| **wacli session keys** | Fly.io machine memory only | Secret - Critical | In-memory only; never persisted to disk | Destroyed on machine stop |
| **Media files** | Convex file storage | PII - High | Encrypted at rest; signed URLs for access | Configurable per user |

### Data Flow Security Summary

```
  +------------------+          +------------------+          +------------------+
  |  User Device     |   TLS    |  Meta / Vercel   |   TLS    |  Convex Cloud    |
  |                  |<-------->|  (Edge)          |<-------->|  (Backend)       |
  |  WhatsApp E2EE   |          |                  |          |  Encrypted at    |
  |  between users   |          |  TLS terminates  |          |  rest            |
  |                  |          |  here             |          |                  |
  +------------------+          +------------------+          +--------+---------+
                                                                       |
                                                              TLS      |  TLS
                                                                       |
                                                              +--------+---------+
                                                              |  External APIs   |
                                                              |  (Google, Stripe)|
                                                              |                  |
                                                              |  OAuth 2.0 /     |
                                                              |  API key auth    |
                                                              +------------------+

  +------------------+          +------------------+
  |  WhatsApp Web    |   TLS    |  Fly.io Machine  |   TLS    Convex
  |  Network         |<-------->|  (wacli)         |<-------->  (signed events)
  |                  |          |                  |
  |  Noise protocol  |          |  Session keys    |
  |  (WA encryption) |          |  in memory only  |
  +------------------+          +------------------+

  KEY:
  ---- TLS 1.3 in transit
  E2EE = end-to-end encrypted (WhatsApp between users; NOT between user and Ecqo)

  NOTE: Messages between a user and the Ecqo WhatsApp Business number are
  encrypted in transit but readable by the Ecqo system. This is by design --
  the agent must read messages to process them. Users are informed of this
  during onboarding.
```
