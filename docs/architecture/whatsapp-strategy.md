# WhatsApp Integration Strategy

> Last updated: 2026-03-10
>
> **Decision: Zero ban risk by default.** Users must never lose their personal WhatsApp account because of Ecqo. History sync via Baileys is opt-in only, with explicit risk acceptance, informed consent, and a separate burner-number recommendation.

---

## The problem

Ecqo has two WhatsApp paths:

| Path | Method | Purpose | Ban risk |
|---|---|---|---|
| **Primary** | Meta Cloud API (official) | User messages Ecqo's business number; agent responds | **Zero** |
| **History sync** | Baileys via wacli connector | Reads user's other WhatsApp conversations for context | **Non-zero** |

The primary path is safe. The history sync path uses Baileys — an unofficial reverse-engineered WhatsApp Web library that violates WhatsApp's Terms of Service. WhatsApp actively detects and bans unofficial clients.

---

## How WhatsApp detects Baileys

WhatsApp uses three detection layers. A connection must pass **all three** to avoid flagging.

### Layer 1: Protocol fingerprinting (passive, always-on)

These signals are checked on every connection, regardless of behavior:

| Signal | What WhatsApp checks | Baileys status | Fixable? |
|---|---|---|---|
| **Signed PreKey rotation** | Official clients rotate every 2-7 days. Baileys generates one at registration and never rotates it. WhatsApp can query prekey age server-side. | Never rotated | **No** — no patch, PR, or fork exists. Deep Signal Protocol work required. |
| **WAM telemetry** | Official clients send encrypted analytics events (app usage, battery, network). Baileys sends **none**. Absence of expected telemetry = unofficial client. | Missing entirely | **No** — WhatsMeow (Go equivalent) partially implements `unified_session` telemetry; Baileys has nothing. |
| **Keepalive interval** | Official WhatsApp Web uses randomized 20-30s heartbeats. Baileys uses a fixed 30s interval. Fixed intervals are a fingerprint. | Fixed 30s | **Yes** — small patch to randomize with gaussian jitter. |
| **Browser string** | Baileys allows custom browser names (e.g., `Browsers.macOS("Ecqqo")`). Custom names are a red flag. | Custom string | **Yes** — use `Browsers.macOS('Desktop')` to mimic official WhatsApp Desktop. |
| **Protocol version** | WhatsApp deprecates old versions. Baileys hardcodes the version. When WhatsApp bumps, all Baileys instances get 405 errors globally. | Hardcoded | **Partially** — PR #2324 adds auto-detection from `web.whatsapp.com/sw.js`. |

### Layer 2: Behavioral analysis (activity-based)

| Signal | What triggers detection | Ecqo's exposure |
|---|---|---|
| Bulk messaging | Sending to many contacts/groups rapidly | **Low** — Ecqo sends via Meta Cloud API, not Baileys |
| Identical messages | Same text to multiple recipients | **None** — outbound is Cloud API |
| Group posting via bot | Automated messages in groups | **None** — Ecqo doesn't post in user's groups |
| Contact novelty | Messaging many new contacts | **None** — read-only connector |
| Status uploads | Programmatic status/story posts | **None** — Ecqo doesn't touch statuses |

Ecqo's connector is **read-only** — it only receives messages, never sends via Baileys. This eliminates most behavioral triggers. But read-only **does not prevent bans** — protocol-level detection fires regardless of behavior (see Layer 1).

### Layer 3: Network fingerprinting (connection-based)

| Signal | What triggers detection | Ecqo's exposure |
|---|---|---|
| Datacenter IPs | Connections from known hosting providers (AWS, Fly.io, Hetzner) instead of residential ISPs | **High** — all connections from Fly.io `ams` region |
| IP/phone geo mismatch | Connection from Amsterdam, phone number is UAE (+971) | **High** — Fly.io region doesn't match user's country |
| Multiple accounts per IP | Several WhatsApp sessions from one IP | **Medium** — supervisor model runs multiple workers per machine |

### Enforcement history (escalating)

| Date | Event |
|---|---|
| Pre-Oct 2025 | Bots ran for years without bans |
| Oct 2025 | Major ban wave — long-running Baileys accounts suddenly banned |
| Oct 15, 2025 | New WABA terms ban general-purpose AI chatbots (new users) |
| Jan 15, 2026 | AI chatbot ban applies to all existing WABA users. ChatGPT and Perplexity removed from WhatsApp. |
| Jan 27, 2026 | Meta deploys Kaleidoscope (Rust-based security overhaul, deeper protocol inspection) |
| Mar 10, 2026 | China CNCERT/CC issues formal security alert about unofficial WhatsApp clients |

---

## What "ban-proof" actually means

Even with every known mitigation applied:

| Mitigation | Impact | Can we do it? |
|---|---|---|
| Fix browser string to `Browsers.macOS('Desktop')` | High | Yes — 1 line |
| Randomize keepalive (20-30s gaussian) | Medium | Yes — small patch |
| Residential proxy per user (same country as phone) | High | Yes — +$5-15/user/mo |
| One machine per user (no IP sharing) | Medium | Already done |
| Fly.io region matching user's country | Medium | Yes — infra change |
| Protocol version auto-detection | Medium | Yes — PR #2324 |
| Exponential backoff reconnection with jitter | Medium | Yes — PR #2405 |
| Account warming (2-4 days before automation) | Medium | Yes — process change |

**Even with all of the above, two critical fingerprints remain unfixed:**

1. **Signed PreKey staleness** — WhatsApp can passively detect every Baileys instance by checking prekey age. No fix exists in the ecosystem.
2. **Missing WAM telemetry** — Official clients send analytics; Baileys sends none. Absence = unofficial.

**Estimated residual ban risk after all mitigations: 5-15% per user per year.**

For a $199-399/mo premium service: at 20 users, expect 1-3 bans per year. Each ban permanently destroys the user's personal WhatsApp number.

---

## Architecture decision: two tiers

### Tier 1: Zero-Risk Mode (default for all users)

All users start here. **No Baileys. No linked device. No ban risk.**

```
User's WhatsApp
    │
    │  messages Ecqo's verified business number
    ↓
Meta Cloud API (official webhook)
    │
    ↓
Convex (agent runtime)
    │
    ├── Calendar (Google Calendar API)
    ├── Email (Gmail API)
    ├── Memory (4-tier, Convex vector search)
    └── Approval workflow (WhatsApp interactive messages)
    │
    ↓
Responds via Meta Cloud API
```

**Context enrichment without Baileys:**

| Method | How it works | Friction | Value |
|---|---|---|---|
| **Forward-to-learn** | User forwards relevant messages to Ecqo's number. Agent extracts facts into memory. Agent can prompt: "I'm prepping your meeting with Sarah — forward me your recent chat?" | Low | High — targeted context on demand |
| **Chat export onboarding** | User exports a WhatsApp chat (Settings → Export Chat) and sends the .txt file to Ecqo. Server parses, extracts facts into memory. | Medium (one-time) | Very high — full chat history, one-time setup |
| **WhatsApp Flows** | Structured multi-step forms inside WhatsApp for scheduling, approvals, data capture. Date pickers, attendee lists, priority selectors. | Zero | High — structured task input, no history needed |
| **Interactive messages** | Reply Buttons (Approve / Reject / More Info), List Messages (time slot selection). Native WhatsApp UI. | Zero | High — approval workflow |
| **Proactive templates** | Morning briefing: "Here's your schedule. Reply to change." End-of-day: "3 meetings, 2 approvals. Anything for tomorrow?" | Zero | Medium — creates organic context over time |
| **External integrations** | Calendar + email + memory tiers provide 70-80% of context the agent needs. | Zero | High — already the primary context sources |
| **Explicit context** | User tells the agent: "I had lunch with Ahmad, he wants to meet Tuesday about Q2." Agent extracts facts immediately. | Low | High — most natural interaction |

**What works in Tier 1:**
- All core assistant features (scheduling, email, reminders, approvals)
- Calendar read/write with approval gates
- Email digest and draft capabilities
- Meeting briefs (from calendar + email + memory, without WhatsApp chat context)
- Reminders via WhatsApp
- 4-tier memory (builds incrementally from interactions + forwards + exports)
- Full approval workflow via interactive messages

**What's weaker in Tier 1:**
- "What did I discuss with Sarah last week?" — agent must ask user to provide context
- Meeting briefs lack WhatsApp chat color (only calendar + email + memory)
- Memory takes 2-4 weeks to become rich (vs. instant with history sync)
- Agent can't passively observe patterns from other conversations

**The gap is widest in weeks 1-4 and narrows over time.** After 3 months of regular use, memory quality approaches parity with history-sync users.

### Tier 2: History Sync Mode (opt-in, explicit risk acceptance)

For users who understand the risk and explicitly choose richer context. **Never enabled by default.**

```
User's WhatsApp
    │
    ├── messages Ecqo's business number (Meta Cloud API — safe)
    │
    └── links personal WhatsApp as a device (Baileys — risk)
        │
        ↓
    Fly.io Connector Worker
        │
        ├── Residential proxy (user's country)
        ├── Browser: macOS Desktop
        ├── Randomized keepalive (20-30s)
        ├── Read-only (no outbound via Baileys)
        ├── Metadata-first (full content only for allowlisted chats)
        └── Encrypted session (AES-256-GCM)
        │
        ↓
    Convex (signed ingest, dedup, memory extraction)
```

#### Consent flow (mandatory before activation)

1. **Dashboard toggle**: "Enable WhatsApp History Sync" — off by default, grayed out with explanation.

2. **Risk disclosure screen** (must scroll to bottom):
   > **Important: Read before enabling**
   >
   > History Sync connects to your personal WhatsApp account using an unofficial protocol. This means:
   >
   > - **Your personal WhatsApp number could be temporarily or permanently banned by WhatsApp.** We estimate a 5-15% risk per year even with all mitigations.
   > - **A permanent ban means you lose your WhatsApp number forever.** You cannot re-register it.
   > - **WhatsApp's Terms of Service prohibit unofficial clients.** This feature uses one.
   > - **We strongly recommend using a secondary/burner number** for History Sync instead of your primary number.
   >
   > Ecqo applies every known mitigation (residential proxies, protocol normalization, read-only mode), but **we cannot guarantee zero risk.** WhatsApp's detection evolves continuously.

3. **Explicit checkboxes** (all required):
   - [ ] I understand my WhatsApp number could be permanently banned
   - [ ] I understand this violates WhatsApp's Terms of Service
   - [ ] I accept full responsibility for any account restrictions
   - [ ] I have been advised to use a secondary number

4. **Typed confirmation**: User must type "I ACCEPT THE RISK" (not just click a button).

5. **Consent record**: Timestamp, IP, user agent, and full consent text stored in `auditLog` for compliance.

#### Recommended: burner number approach

For users who want history sync with zero risk to their primary number:

1. User gets a secondary WhatsApp number (prepaid SIM, Google Voice, etc.)
2. User adds this number to relevant WhatsApp groups / contacts
3. User links the secondary number to Ecqo's history sync
4. If banned, only the burner number is affected
5. Primary WhatsApp remains untouched

**Dashboard guidance**: When a user enables Tier 2, show a recommendation banner:
> "We recommend linking a secondary WhatsApp number instead of your primary. This protects your main account while still giving Ecqo access to your conversations."

#### All mitigations applied in Tier 2

| Mitigation | Implementation |
|---|---|
| Browser string | `Browsers.macOS('Desktop')` — mimics official WhatsApp Desktop |
| Keepalive | Randomized 20-30s with gaussian jitter |
| IP | Residential proxy in user's country (Bright Data / Oxylabs) |
| Isolation | One worker per user, one IP per session |
| Reconnection | Exponential backoff with 15% jitter, zombie socket detection |
| Protocol version | Auto-detection from `web.whatsapp.com/sw.js` |
| Read-only | No outbound messages via Baileys, ever |
| Metadata-first | Full message bodies only for user-allowlisted chats |
| Session persistence | AES-256-GCM encrypted auth state on Tigris S3 (avoids repeated QR scans) |
| Account warming | 2-4 day warm-up period after initial link before sync starts |
| Kill-switch | Fleet-wide shutdown in <30 seconds if ban wave detected |
| Monitoring | Track `account_at_risk` warnings; auto-disconnect and notify user immediately |

#### Early warning system

The connector monitors for ban precursors and auto-disconnects:

| Signal | Action |
|---|---|
| "Account may be at risk" warning from WhatsApp | **Immediately** disconnect Baileys session, notify user, disable Tier 2 |
| 405 protocol version error | Disconnect, wait for auto-update, notify user |
| Repeated connection failures (3+ in 1 hour) | Disconnect, enter cooldown (24 hours), notify user |
| Session eviction by WhatsApp | Disconnect, notify user, require re-consent to re-enable |
| Ban wave detected across fleet (2+ users in 24h) | **Kill-switch entire fleet**, notify all Tier 2 users, suspend Tier 2 enrollments |

**The user's primary WhatsApp is never affected** — even if a Tier 2 ban occurs, it only affects the linked device session (or burner number). The user can still message Ecqo's business number via the Meta Cloud API path.

---

## Meta's AI chatbot policy (January 2026)

As of January 15, 2026, Meta bans "general-purpose AI chatbots" from the WhatsApp Business API.

### What's banned
- Open-ended AI assistants (ChatGPT, Perplexity — both removed from WhatsApp)
- AI as the product — using WhatsApp as a distribution channel for an AI service

### What's allowed
- AI-powered scheduling and booking automation
- Approval notifications with action buttons
- Task management and reminders
- Structured data collection via Flows
- Email/calendar digest delivery
- Customer support with AI triage

### Ecqo's compliance framing

Ecqo is a **structured executive operations tool**, not a general-purpose chatbot:
- Enumerated capabilities: schedule, email, brief, remind, approve
- Every action gated by approval workflow
- Structured input via WhatsApp Flows
- Business-service framing: "WhatsApp-native executive operations platform"

**Do NOT position as:** "AI assistant on WhatsApp" or "ChatGPT for executives"
**DO position as:** "Executive scheduling, delegation, and approval tool that works through WhatsApp"

The distinction: the AI supports specific business operations, it is not the product itself.

### Regulatory watch

The European Commission opened an antitrust probe into Meta's chatbot ban (potential anti-competitive behavior). Brazil's competition watchdog ordered Meta to suspend the policy. These could force relaxation of the ban in certain jurisdictions, but timelines are uncertain.

---

## Impact on architecture and roadmap

### What changes

| Component | Before | After |
|---|---|---|
| Default user experience | History sync assumed | Tier 1 (Meta Cloud API only) |
| Connector (Epic B) | Required for all users | Optional, Tier 2 only |
| Onboarding flow | QR scan required | Message our number (zero setup) |
| Memory pipeline | Depends on synced messages | Depends on forwards + exports + interactions + integrations |
| Agent context assembly | Includes synced recent messages | Calendar + email + memory + user-provided context |
| Consent system | Not built | Required for Tier 2 (risk disclosure, checkboxes, typed confirmation) |
| Residential proxies | Not planned | Required for Tier 2 (+$5-15/user/mo) |
| Ban monitoring | Not built | Required for Tier 2 (early warning + auto-disconnect + fleet kill-switch) |

### Milestone impact

**Epic B (WhatsApp Connector Lifecycle) — 29 SP:**
- Moves from M1 (required) to M2/M3 (optional, Tier 2 only)
- Core product ships without it
- Pilot can start with Tier 1 only

**New work:**
- Forward-to-learn flow (~5 SP)
- Chat export parser (~5 SP)
- WhatsApp Flows for structured task input (~8 SP)
- Tier 2 consent system (~3 SP)
- Ban monitoring + early warning (~5 SP)
- Residential proxy integration (~3 SP)

**Net effect:** Core path is simpler (no connector required). Tier 2 adds ~16 SP of new work but is deferred and optional.

### Pilot strategy

**Phase 1 (launch):** All pilot users on Tier 1. Validate that forward-to-learn + chat exports + calendar + email provide sufficient context for the core use cases.

**Phase 2 (week 3-4):** Offer Tier 2 to pilot users who want richer context. Collect data on memory quality gap between Tier 1 and Tier 2 users.

**Phase 3 (month 2+):** Decision point — if Tier 1 context quality is within 80% of Tier 2, consider deprecating Tier 2 entirely and simplifying the architecture.

---

## Data model additions

### Consent record (Tier 2)

```typescript
// In waAccounts table, add:
historySyncConsent: v.optional(v.object({
  accepted: v.boolean(),
  acceptedAt: v.number(),        // Unix timestamp
  ipAddress: v.string(),
  userAgent: v.string(),
  consentVersion: v.string(),    // "2026-03-10-v1"
  useBurnerNumber: v.boolean(),  // Did user indicate using a secondary number?
})),
historySyncStatus: v.optional(v.literal(
  "disabled",       // Default, Tier 1
  "consent_pending", // User started consent flow
  "warming_up",     // 2-4 day warm-up period
  "active",         // Syncing
  "paused_warning", // Auto-paused due to ban warning
  "paused_cooldown",// Auto-paused due to connection failures
  "killed",         // Fleet kill-switch activated
  "banned",         // User's account was banned
)),
```

### Ban monitoring events

```typescript
// In auditLog, new event types:
"history_sync.consent_granted"
"history_sync.consent_revoked"
"history_sync.warming_started"
"history_sync.activated"
"history_sync.warning_detected"    // "Account at risk" from WhatsApp
"history_sync.auto_disconnected"   // Precautionary disconnect
"history_sync.cooldown_entered"    // Connection failures
"history_sync.ban_detected"        // Confirmed ban
"history_sync.fleet_killswitch"    // Multiple bans detected
```

---

## Summary

| | Tier 1 (default) | Tier 2 (opt-in) |
|---|---|---|
| **Method** | Meta Cloud API only | Meta Cloud API + Baileys |
| **Ban risk** | Zero | 5-15% per year (with all mitigations) |
| **Setup** | Message our number | QR scan + consent flow + 2-4 day warm-up |
| **Context sources** | Forwards, exports, interactions, calendar, email, memory | All of Tier 1 + passive WhatsApp history |
| **Memory richness (week 1)** | Sparse | Rich |
| **Memory richness (month 3)** | Good | Very good |
| **Infrastructure** | Convex + Vercel | + Fly.io connector + residential proxy |
| **Cost per user** | ~$0/mo | +$5-15/mo (proxy) + Fly.io compute |
| **Consent required** | No | Full risk disclosure + typed confirmation |
| **Recommendation** | Default for everyone | Only with burner number |

**The product must work great on Tier 1.** Tier 2 is an enhancement for power users who understand the tradeoff, not a crutch the product depends on.

---

## Cross-references

- [Competitive Positioning](/plan/positioning) — How zero-ban-risk differentiates from OpenClaw
- [Security: vs Self-Hosted](/security/vs-self-hosted) — Full security comparison
- [Sync & Ingestion](/flows/sync-ingestion) — Current sync pipeline (will be updated for tiered model)
- [Connect WhatsApp](/flows/connect-whatsapp) — QR flow (becomes Tier 2 only)
- [Memory Pipeline](/flows/memory-pipeline) — Context enrichment paths
- [Landing Page Brief](/plan/landing-page-brief) — Messaging guidance
