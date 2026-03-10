# Security: Ecqo vs Self-Hosted Agents

> Last updated: 2026-03-10

This document compares Ecqo's managed security model against self-hosted AI agent architectures (primarily OpenClaw and its hosted derivatives). Use this as a reference for security-conscious evaluators and for landing page trust messaging.

---

## Threat landscape for self-hosted agents

Self-hosted AI agents like OpenClaw run on the user's device with broad system permissions: shell access, file read/write, browser control, email/calendar APIs. This creates a massive attack surface.

### Known vulnerabilities (as of March 2026)

| CVE / Issue | Severity | Impact |
|---|---|---|
| **CVE-2026-25253** | Critical | One-click RCE — any website silently connects to agent via unvalidated WebSocket origin |
| **CVE-2026-24763** | High | Command injection via crafted tool inputs |
| **CVE-2026-25157** | High | Prompt injection leading to credential exfiltration |
| **CVE-2026-25475** | High | Command injection in skill execution |
| **Plaintext credentials** | High | API keys, passwords stored in plain text in config/memory/chat logs — targeted by RedLine and Lumma infostealers |
| **Malicious skills** | High | 820+ out of 10,700 audited ClawHub skills found malicious (crypto wallet theft, data exfiltration) |
| **Exposed instances** | Critical | 42,665 instances found internet-exposed, 93.4% with authentication bypass |

### Advisory bodies

- **China CNCERT/CC** — Formal security alert issued March 10, 2026
- **Cisco** — Published "personal AI agents like OpenClaw are a security nightmare"
- **Microsoft** — Published guidance on "running OpenClaw safely" (identity, isolation, runtime risk)
- **Northeastern University / Cisco Talos** — Called it a "privacy nightmare"

---

## Architecture comparison

### Self-hosted agent (OpenClaw model)

```
User's Device
├── OpenClaw Gateway (WebSocket :18789)
│   ├── Shell access (full system)
│   ├── File system (read/write anywhere)
│   ├── Browser control (Puppeteer)
│   ├── Memory (plaintext files)
│   └── Skills (community marketplace, unvetted)
├── LLM API keys (plaintext in config)
├── WhatsApp session (Baileys - unofficial)
│   └── User's personal account credentials
├── Email/Calendar tokens (plaintext)
└── All data on local disk (unencrypted)
```

**Trust boundary:** None. Everything runs as the user's OS process with full permissions. A single prompt injection or malicious skill compromises everything.

### Ecqo (managed model)

```
User's WhatsApp
│ (messages Ecqo's verified business number)
│
Meta Cloud API (official, webhook-verified)
│
├── Convex (managed backend)
│   ├── Clerk JWT authentication
│   ├── RBAC (owner / principal / operator)
│   ├── Encrypted storage (Convex-managed at rest)
│   ├── Rate limiting (@convex-dev/rate-limiter)
│   └── Immutable audit trail
│
├── Fly.io Connector (isolated per-user)
│   ├── HMAC-SHA256 signed requests
│   ├── Anti-replay (timestamp + nonce)
│   ├── Scoped service tokens (per workspace)
│   ├── AES-256-GCM encrypted session artifacts
│   └── Kill-switch (< 30s fleet shutdown)
│
└── Agent Runtime (server-side)
    ├── Policy engine (approval gates on all side effects)
    ├── Structured memory (4-tier, Convex vector search)
    ├── PII redaction in traces
    └── LangSmith observability (no raw secrets)
```

**Trust boundaries:** Four layers — user perimeter, platform perimeter (Meta + Clerk + Vercel), trusted core (Convex), connector isolation (Fly.io). Each boundary enforces authentication and authorization independently.

---

## Point-by-point comparison

| Dimension | Self-hosted (OpenClaw) | Ecqo (managed) |
|---|---|---|
| **WhatsApp method** | Baileys (unofficial, reverse-engineered) | Meta Cloud API (official, verified business) |
| **Ban risk** | High — accounts banned within 48 hours reported | None — official API, Ecqo's own number |
| **User credentials exposed** | Yes — personal WhatsApp session on device | No — user never shares credentials |
| **API keys** | Plaintext in config files | Server-side only, never on client |
| **Authentication** | Optional (93.4% of instances have none) | Mandatory — Clerk JWT + workspace RBAC |
| **Network exposure** | WebSocket on localhost (often port-forwarded) | No user-hosted ports, all traffic via managed infra |
| **Skill/plugin supply chain** | 820+ malicious skills in marketplace | No marketplace — curated agent capabilities |
| **Approval workflow** | CLI-based (Lobster), developer-only | WhatsApp-native, tap-to-approve, PA delegation |
| **Data encryption at rest** | None (plaintext files) | Convex-managed + AES-256-GCM for session artifacts |
| **Audit trail** | None | Immutable event stream (20+ event categories) |
| **Kill-switch** | None (must SSH and kill process) | < 30 seconds fleet-wide shutdown |
| **PII handling** | No redaction (full content in memory/logs) | PII redacted in traces, metadata-first sync policy |
| **Incident response** | User's responsibility | Managed — runbooks, monitoring, LangSmith observability |
| **Compliance (GDPR)** | User's responsibility | Right-to-access, deletion, portability built in |

---

## WhatsApp security: official API vs Baileys

This is the single most important architectural difference for WhatsApp-native products.

### Baileys (used by OpenClaw and all derivatives)

- Reverse-engineers WhatsApp Web's binary protocol
- Simulates a logged-in browser session using the user's personal credentials
- **Violates WhatsApp Terms of Service** — accounts can be suspended without warning
- Session keys stored on user's device — extractable by malware
- No official support, no SLA, breaks when WhatsApp updates protocol
- Connection instability: session expiry, reconnect loops, silent disconnects
- Bun runtime (recommended by OpenClaw) explicitly NOT recommended for WhatsApp due to connection issues

### Meta Cloud API (used by Ecqo)

- Official, supported API from Meta
- Ecqo operates as a verified WhatsApp Business account
- Users message Ecqo's number — their personal account is never involved
- Webhook signature verification (SHA-256) for all inbound events
- Rate limits and delivery guarantees from Meta
- No ban risk to the user's personal account
- Stable, maintained, SLA-backed

---

## Risk matrix for executive users

| Risk | Self-hosted | Ecqo | Impact if realized |
|---|---|---|---|
| Personal WhatsApp banned | **High** | **None** | Loss of primary communication channel |
| API keys stolen | **High** | **None** | Financial loss, account takeover |
| Calendar/email compromise | **High** | **Low** (approval-gated) | Privacy breach, unauthorized actions |
| Prompt injection | **High** | **Low** (sandboxed runtime) | Data exfiltration, unauthorized actions |
| Malicious plugin | **High** | **None** (no marketplace) | Full system compromise |
| Data breach (at rest) | **High** (plaintext) | **Low** (encrypted) | Regulatory, reputational damage |
| Service disruption | **Medium** (user maintains) | **Low** (managed infra) | Lost productivity |

---

## Messaging guidance

### For landing page trust section

**Heading:** "Not another DIY agent"

**Copy:** "Self-hosted AI agents expose your credentials, break your WhatsApp, and need a developer on call. Ecqo is a managed service — we handle the infrastructure, security, and uptime. You handle your business."

**Stats to cite:**
- 42,665 exposed self-hosted AI agent instances found online
- 93.4% had no authentication
- 820+ malicious plugins in the largest agent marketplace
- Account bans reported within 48 hours of connecting WhatsApp

### For FAQ

**Q: How is this different from OpenClaw?**

A: OpenClaw is a powerful open-source tool for developers who want full control. Ecqo is a managed service for executives who want zero setup and zero risk. We use the official Meta WhatsApp API (no ban risk), run on managed infrastructure (no exposed ports or plaintext keys), and include an approval workflow that ensures your AI never acts without permission.

**Q: Will my WhatsApp get banned?**

A: No. We use the official Meta Business API with a verified Ecqo number. We never log into or simulate your personal WhatsApp account. Your account is never at risk.

**Q: Where is my data stored?**

A: On Convex's managed infrastructure — encrypted at rest, with RBAC access controls, and an immutable audit trail. Nothing is stored on your personal device. You can request full data export or deletion at any time.
