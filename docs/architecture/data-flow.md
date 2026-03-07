# End-to-End Data Flow

This document traces the complete path of data through the Ecqqo system for two critical flows: an agent-driven scheduling request and the background message sync/ingestion pipeline.

## Flow 1: Scheduling Request

A user sends "Schedule meeting with Sarah tomorrow at 3pm" to the Ecqqo WhatsApp number. Here is the complete end-to-end flow from message send to calendar confirmation.

<ArchDiagram :config="schedulingSeqConfig" />

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

<ArchDiagram :config="syncSeqConfig" />

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

<script setup>
const schedulingSeqConfig = {
  type: "sequence",
  actors: [
    { id: "df-user", icon: "si:whatsapp", title: "User", subtitle: "WhatsApp", color: "teal" },
    { id: "df-meta", icon: "si:meta", title: "Meta Cloud API", color: "warm" },
    { id: "df-convex", icon: "si:convex", title: "Convex", subtitle: "Control Plane", color: "teal" },
    { id: "df-ai", icon: "si:openai", title: "AI Provider", subtitle: "gpt-4o", color: "dark" },
    { id: "df-op", icon: "fa-user", title: "Operator", subtitle: "WhatsApp", color: "warm" },
    { id: "df-gcal", icon: "si:googlecalendar", title: "Google Calendar", color: "blue" },
  ],
  steps: [
    { from: "df-user", to: "df-meta", label: "Schedule meeting..." },
    { from: "df-meta", to: "df-convex", label: "Webhook POST" },
    { over: "df-convex", note: "1. Verify Meta signature (HMAC)\n2. Extract phone + body\n3. Lookup user\n4. Store message\n5. Schedule agent run" },
    { from: "df-convex", to: "df-ai", label: "Call AI w/ context + tools" },
    { from: "df-ai", to: "df-convex", label: "Tool: create_event", dashed: true },
    { over: "df-convex", note: "Policy check → approval required" },
    { from: "df-convex", to: "df-meta", label: "Send approval request", dashed: true },
    { from: "df-meta", to: "df-op", label: "Approve meeting?" },
    { from: "df-op", to: "df-meta", label: "YES" },
    { from: "df-meta", to: "df-convex", label: "Approval matched" },
    { from: "df-convex", to: "df-gcal", label: "POST create event" },
    { from: "df-gcal", to: "df-convex", label: "Event created", dashed: true },
    { from: "df-convex", to: "df-meta", label: "Send confirmation", dashed: true },
    { from: "df-meta", to: "df-user", label: "Meeting confirmed" },
    { over: "df-convex", note: "Extract memory → embedding" },
  ],
  groups: [
    { label: "Intelligence Plane", color: "dark", from: 3, to: 5 },
    { label: "Approval Flow", color: "warm", from: 6, to: 9 },
    { label: "Tool Execution", color: "teal", from: 10, to: 11 },
  ],
}

const syncSeqConfig = {
  type: "sequence",
  actors: [
    { id: "sy-convex", icon: "si:convex", title: "Convex", subtitle: "Control Plane", color: "teal" },
    { id: "sy-fly", icon: "si:flydotio", title: "Fly.io Machine", subtitle: "wacli", color: "red" },
    { id: "sy-wa", icon: "si:whatsapp", title: "WhatsApp Web", color: "warm" },
  ],
  steps: [
    { from: "sy-convex", to: "sy-fly", label: "Start machine" },
    { over: "sy-fly", note: "1. Machine boots\n2. Load token + user ID" },
    { from: "sy-fly", to: "sy-wa", label: "Connect WebSocket" },
    { from: "sy-wa", to: "sy-fly", label: "Session active", dashed: true },
    { from: "sy-fly", to: "sy-convex", label: "Fetch sync cursor" },
    { from: "sy-convex", to: "sy-fly", label: "Last cursor", dashed: true },
    { from: "sy-wa", to: "sy-fly", label: "Fetch msgs since cursor" },
    { over: "sy-fly", note: "Normalize format\nDedup hash (SHA-256)\nSign batch w/ signing key" },
    { from: "sy-fly", to: "sy-convex", label: "POST signed batch" },
    { over: "sy-convex", note: "1. Validate signature (HMAC)\n2. Upsert messages (dedup)\n3. Advance cursor\n4. Memory extraction" },
  ],
  groups: [
    { label: "Sync Loop (every 30-60s)", color: "teal", from: 6, to: 9 },
  ],
}

const securityConfig = {
  layers: [
    {
      id: "user-device",
      title: "User Device",
      subtitle: "End-to-End Encrypted",
      icon: "fa-lock",
      color: "red",
      nodes: [
        { id: "sec-wa", icon: "si:whatsapp", title: "WhatsApp", subtitle: "E2EE · User Device" },
      ],
    },
    {
      id: "edge-gw",
      title: "Edge / Gateway",
      subtitle: "TLS 1.3 Termination",
      icon: "fa-shield-halved",
      color: "warm",
      nodes: [
        { id: "sec-meta", icon: "si:meta", title: "Meta Cloud API", subtitle: "TLS Termination" },
        { id: "sec-vercel", icon: "si:vercel", title: "Vercel Edge", subtitle: "TLS Termination" },
      ],
    },
    {
      id: "backend-enc",
      title: "Backend",
      subtitle: "Encrypted at Rest · Convex Cloud",
      icon: "fa-database",
      color: "teal",
      nodes: [
        { id: "sec-convex", icon: "si:convex", title: "Convex Cloud", subtitle: "Encrypted at Rest" },
      ],
    },
    {
      id: "connector-sec",
      title: "Connector Path",
      subtitle: "Signed Events · Memory-only Keys",
      icon: "fa-network-wired",
      color: "dark",
      nodes: [
        { id: "sec-waweb", icon: "fa-globe", title: "WA Web", subtitle: "Noise Protocol" },
        { id: "sec-fly", icon: "si:flydotio", title: "Fly.io wacli", subtitle: "Keys in Memory Only" },
      ],
    },
    {
      id: "ext-sec",
      title: "External APIs",
      subtitle: "OAuth 2.0 · API Keys",
      icon: "fa-plug",
      color: "blue",
      nodes: [
        { id: "sec-google", icon: "si:google", title: "Google APIs", subtitle: "OAuth 2.0 Tokens" },
        { id: "sec-stripe", icon: "si:stripe", title: "Stripe", subtitle: "API Keys · Webhooks" },
      ],
    },
  ],
  connections: [
    { from: "sec-wa", to: "sec-meta", label: "TLS 1.3" },
    { from: "sec-meta", to: "sec-convex", label: "TLS 1.3" },
    { from: "sec-vercel", to: "sec-convex", label: "TLS 1.3" },
    { from: "sec-convex", to: "sec-google", label: "TLS 1.3" },
    { from: "sec-convex", to: "sec-stripe", label: "TLS 1.3" },
    { from: "sec-waweb", to: "sec-fly", label: "TLS 1.3" },
    { from: "sec-fly", to: "sec-convex", label: "signed events" },
  ],
}
</script>

<ArchDiagram :config="securityConfig" />

::: info Note on encryption
Messages between a user and the Ecqqo WhatsApp Business number are encrypted in transit but readable by the Ecqqo system. This is by design -- the agent must read messages to process them. Users are informed of this during onboarding. E2EE applies only between WhatsApp users, not between a user and Ecqqo.
:::
