# End-to-End Data Flow

This document traces the complete path of data through the Ecqqo system for two critical flows: an agent-driven scheduling request and the background message sync/ingestion pipeline.

## Flow 1: Scheduling Request

A user sends "Schedule meeting with Sarah tomorrow at 3pm" to the Ecqqo WhatsApp number. Here is the complete end-to-end flow from message send to calendar confirmation.

```mermaid
sequenceDiagram
    participant User as User (WhatsApp)
    participant Meta as Meta Cloud API
    participant Convex as Convex (Control Plane)
    participant AI as AI Provider (OpenAI gpt-4o)
    participant Operator as Operator (WhatsApp)
    participant GCal as Google Calendar API

    User->>Meta: "Schedule meeting with Sarah tomorrow at 3pm"
    Meta->>Convex: Webhook (POST /webhook)

    Note over Convex: 1. Verify Meta signature (HMAC-SHA256)
    Note over Convex: 2. Extract phone number + message body
    Note over Convex: 3. Lookup user by phone → users table
    Note over Convex: 4. Store inbound message → messages table
    Note over Convex: 5. Schedule agent run (ctx.scheduler.runAfter)

    rect rgb(240, 245, 255)
        Note over Convex,AI: Intelligence Plane (Convex Action)
        Note over Convex: 6. Orchestrator starts
        Note over Convex: 7. Retrieve context:<br/>a) Recent messages (last 20)<br/>b) Vector search: "Sarah" → contact info<br/>c) User policies: calendar_approval=true

        Convex->>AI: 8. Call AI with context + tools
        AI-->>Convex: 9. Tool call: create_event({title, date, duration, attendees})
        Note over Convex: 10. Policy check → calendar_approval=true → approval required
    end

    rect rgb(255, 245, 235)
        Note over Convex,Operator: Approval Flow
        Note over Convex: 11. Create approval request → approvals table (status: pending)
        Convex->>Meta: 12. Send approval notification
        Meta->>Operator: "Approve meeting with Sarah tomorrow 3pm? Reply YES or NO"
        Operator->>Meta: "YES"
        Meta->>Convex: 13. Webhook receives reply → match to pending approval → status: approved
        Note over Convex: 14. Resume agent run
    end

    rect rgb(235, 255, 240)
        Note over Convex,GCal: Tool Execution
        Convex->>GCal: 15. POST /calendars/.../events (Meeting with Sarah)
        GCal-->>Convex: Event created (eventId, link)
        Note over Convex: 16. Store result → agent_runs table (status: completed)
        Note over Convex: 17. Log to audit trail → audit_log table
    end

    Convex->>Meta: 18. Send confirmation
    Meta->>User: "Done! Meeting with Sarah scheduled for tomorrow at 3:00 PM. Calendar link: ..."
    Note over Convex: 19. Extract & store memory → vector embedding
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

```mermaid
sequenceDiagram
    participant Convex as Convex (Control Plane)
    participant Fly as Fly.io Machine (wacli)
    participant WA as WhatsApp Web Network

    Note over Convex: 0. Start machine via Fly.io Machines API
    Convex->>Fly: Start machine
    Note over Fly: 1. Machine boots
    Note over Fly: 2. Load service token + user ID from env vars

    Fly->>WA: 3. Connect to WhatsApp Web (WebSocket)
    WA-->>Fly: Session active

    Fly->>Convex: 4. Fetch sync cursor
    Convex-->>Fly: Return last cursor (ingestion_state: user_123, cursor: msg_99872)

    rect rgb(245, 245, 255)
        Note over WA,Convex: Periodic Sync Loop (every 30-60 seconds)

        WA->>Fly: 5. Fetch messages since cursor (messages, contacts, groups)
        Note over Fly: 6. For each new message:<br/>- Normalize format<br/>- Compute dedup hash (SHA-256)<br/>- Attach contact/group metadata

        Note over Fly: 7. Sign event batch with CONNECTOR_SIGNING_KEY
        Fly->>Convex: POST signed event batch {user_id, messages[], cursor, signature}

        Note over Convex: 8. Validate event signature (HMAC-SHA256)
        Note over Convex: 9. Idempotent upsert per message:<br/>IF dedup_hash exists → SKIP<br/>ELSE → INSERT message
        Note over Convex: 10. Advance cursor (ingestion_state → NEW cursor, last_sync: NOW)
        Note over Convex: 11. Trigger memory extraction:<br/>- Extract facts<br/>- Generate embeddings<br/>- Store in vector index
    end
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

```mermaid
flowchart LR
    subgraph UserDevice["User Device"]
        WA_E2EE["WhatsApp<br/>(E2EE between users)"]
    end

    subgraph Edge["Meta / Vercel (Edge)"]
        TLS_TERM["TLS terminates here"]
    end

    subgraph Backend["Convex Cloud (Backend)"]
        EAR["Encrypted at rest"]
    end

    subgraph ExtAPIs["External APIs"]
        GOOG["Google · Stripe<br/>(OAuth 2.0 / API key auth)"]
    end

    subgraph ConnPath["Connector Path"]
        WA_WEB["WhatsApp Web<br/>(Noise protocol)"]
        FLY_M["Fly.io Machine (wacli)<br/>Session keys in memory only"]
        CVX["Convex<br/>(signed events)"]
    end

    UserDevice -- "TLS 1.3" --- Edge
    Edge -- "TLS 1.3" --- Backend
    Backend -- "TLS 1.3" --- ExtAPIs
    WA_WEB -- "TLS 1.3" --- FLY_M
    FLY_M -- "TLS 1.3" --- CVX
```

::: info Note on encryption
Messages between a user and the Ecqo WhatsApp Business number are encrypted in transit but readable by the Ecqo system. This is by design -- the agent must read messages to process them. Users are informed of this during onboarding. E2EE applies only between WhatsApp users, not between a user and Ecqo.
:::
