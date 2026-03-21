# User Identification (Single Number)

## M0 Implementation: Contact Auto-Resolution (wacli/Baileys)

In M0, Ecqqo connects to a user's personal WhatsApp via a Baileys-based connector. User identification happens automatically during message ingestion:

### Flow

1. **Message arrives** via `connector.ingestMessages()` mutation
2. **Contact resolution** runs inline for every non-self message via `resolveContact()` (in `convex/contacts.ts`)
3. **JID → phone extraction**: `senderJid` (e.g., `1234567890@s.whatsapp.net`) → phone `1234567890`
4. **Lookup or create**: Query `waContacts` by `(waAccountId, jid)` index
   - **Existing contact**: Update `lastSeenAt`, increment `messageCount`, refresh locale detection
   - **New contact**: Create `waContacts` record with phone, pushName, auto-detected locale
5. **First-message flag**: `isFirstMessage` is passed to `agent.processMessage()` to trigger a welcome message
6. **Agent enrichment**: Contact info (name, locale, phone) is injected into the LLM system prompt

### Locale Detection

Language is auto-detected from message text using Arabic Unicode character ratio:
- If >30% of non-whitespace characters are in the Arabic Unicode range (`\u0600-\u077F`), locale = `ar`
- Otherwise, locale = `en`

The locale updates on each message, so the agent always responds in the user's most recent language.

### Welcome Message

On first interaction (`isFirstMessage = true`), the agent system prompt is augmented with instructions to welcome the user, introduce itself, and explain capabilities.

### Key Files

| File | Purpose |
|------|---------|
| `convex/contacts.ts` | Contact resolution helper, dashboard queries |
| `convex/connector.ts` | Ingestion hook (calls `resolveContact` inline) |
| `convex/agent.ts` | Contact-enriched system prompt, welcome flow |
| `convex/schema.ts` | `waContacts` table definition |

---

## Future: Single Business Number (Meta Cloud API)

## Problem Statement

Ecqqo operates through a **single WhatsApp Business number** powered by the Meta Cloud API. Every user -- whether an owner, principal, or operator -- messages this same number. The system must reliably identify which user is sending each inbound message and route it to the correct agent context, workspace, and conversation state.

This is fundamentally different from the wacli-based connection (where Ecqqo reads a user's personal WhatsApp). Here, Ecqqo's own Business number **receives** messages from users. The identification challenge: given an inbound message from phone number `+971501234567`, determine which Ecqqo user account this belongs to, and which workspace/agent context to activate.

## Inbound Message Identification Flow

<ArchDiagram :config="identFlowConfig" />

## Registration and Phone Binding Flow

Before a user can interact with Ecqqo via WhatsApp, their phone number must be bound to their account. This happens during onboarding:

<ArchDiagram :config="registrationFlow" />

### Why OTP via WhatsApp?

The OTP is sent via Ecqqo's WhatsApp Business number to the user's phone. This serves dual purpose:

1. **Verifies phone ownership** -- only the person with the phone can read the OTP.
2. **Establishes the conversation** -- the user now has a chat thread with Ecqqo, making future interactions seamless.

## Complete Identification Pipeline

<ArchDiagram :config="identPipelineFlow" />

## Edge Cases

### Multiple Users from Same Phone Number

Not supported. Phone number binding is strictly **1:1**: one phone number maps to exactly one user account. If a phone number is already bound to an existing account, the new signup will be rejected with a prompt to contact support.

Database constraint: `waAccounts` table has a unique index on `phone`.

### User Changes Phone Number

1. User initiates phone change from the dashboard.
2. New phone number goes through the same OTP verification flow.
3. On successful verification:
   - Old `waAccount` record is marked `inactive`.
   - New `waAccount` record is created with `verified: true`.
   - Any pending approval requests on the old number are migrated.
4. Messages from the old number will no longer route to this user.

### Unregistered User Messages Ecqqo

When someone who hasn't signed up sends a message to Ecqqo's WhatsApp number:

- The phone lookup returns no match.
- Ecqqo responds with a friendly onboarding message (templated, pre-approved by Meta).
- The message is logged for analytics but no agent context is created.
- Rate limiting applies: max 3 onboarding messages per phone per 24h to prevent abuse.

### Phone Number Format Normalization

All phone numbers are stored and compared in **E.164 format** (`+` prefix, country code, no separators):

| Input | Normalized (E.164) | Notes |
|---|---|---|
| `+971501234567` | `+971501234567` | Already E.164 |
| `00971501234567` | `+971501234567` | International prefix |
| `0501234567` | `+971501234567` | Local, needs country code from context |
| `971-50-123-4567` | `+971501234567` | Strip separators, add `+` |
| `+1 (415) 555-0123` | `+14155550123` | US number |

The normalization function runs at two points:
1. **Registration** -- when the user provides their phone number during signup.
2. **Webhook ingestion** -- when processing the sender phone from Meta's webhook payload. (Meta typically provides E.164 already, but normalization is applied defensively.)

## Security Considerations

### Phone Number Spoofing Mitigations

The Meta Cloud API provides strong guarantees against phone number spoofing:

1. **Meta-verified sender identity** -- The `from` field in webhook payloads is the verified phone number of the WhatsApp account. Meta authenticates users via SIM/device binding. This is not a caller-ID-style header that can be forged.

2. **Webhook signature validation** -- Every webhook from Meta includes an HMAC-SHA256 signature computed with the app secret. Convex validates this signature before processing any message. This prevents forged webhook calls.

3. **No phone-number-only auth** -- Phone number identification is used for **routing**, not for authentication of sensitive operations. Any high-risk action (e.g., changing payment details, removing team members) still requires dashboard authentication via Clerk.

4. **Binding verification** -- The OTP flow during registration proves the user controls the phone number at binding time. Combined with Meta's ongoing device verification, this provides continuous assurance.

<script setup>
const registrationFlow = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "reg-signup", icon: "fa-user", title: "Sign Up", subtitle: "Clerk: email, phone, workspace", row: 0, col: 0, color: "teal" },
    { id: "reg-verify", icon: "fa-shield-halved", title: "Verify", subtitle: "OTP via WhatsApp", row: 0, col: 1, color: "warm" },
    { id: "reg-bind", icon: "fa-link", title: "Bind", subtitle: "waAccount created", row: 0, col: 2, color: "dark" },
  ],
  edges: [
    { from: "reg-signup", to: "reg-verify" },
    { from: "reg-verify", to: "reg-bind" },
  ],
}

const identPipelineFlow = {
  type: "flow",
  nodes: [
    { id: "ip-webhook", icon: "fa-bolt", title: "Meta Webhook", row: 0, col: 1 },
    { id: "ip-hmac", icon: "fa-lock", title: "Validate HMAC", row: 1, col: 1, shape: "diamond", color: "warm" },
    { id: "ip-reject", icon: "fa-circle-xmark", title: "Reject (401)", row: 1, col: 2, color: "red" },
    { id: "ip-phone", icon: "fa-phone", title: "Extract phone", row: 2, col: 1 },
    { id: "ip-norm", icon: "fa-filter", title: "Normalize E.164", row: 3, col: 1 },
    { id: "ip-query", icon: "fa-database", title: "Query waAccounts", row: 4, col: 1, shape: "diamond", color: "warm" },
    { id: "ip-onboard", icon: "fa-comments", title: "Send onboarding", subtitle: "sign up at ecqqo.com", row: 4, col: 2, color: "warm" },
    { id: "ip-context", icon: "fa-user", title: "Load user context", subtitle: "workspace, role, memory", row: 5, col: 1 },
    { id: "ip-approval", icon: "fa-question", title: "Approval response?", row: 6, col: 1, shape: "diamond", color: "warm" },
    { id: "ip-approve", icon: "fa-circle-check", title: "Approval handler", row: 6, col: 0, color: "teal" },
    { id: "ip-agent", icon: "fa-sitemap", title: "Agent orchestrator", row: 6, col: 2, color: "dark" },
  ],
  edges: [
    { from: "ip-webhook", to: "ip-hmac" },
    { from: "ip-hmac", to: "ip-reject", label: "Fail" },
    { from: "ip-hmac", to: "ip-phone", label: "Pass" },
    { from: "ip-phone", to: "ip-norm" },
    { from: "ip-norm", to: "ip-query" },
    { from: "ip-query", to: "ip-onboard", label: "Not found" },
    { from: "ip-query", to: "ip-context", label: "Found" },
    { from: "ip-context", to: "ip-approval" },
    { from: "ip-approval", to: "ip-approve", label: "Yes" },
    { from: "ip-approval", to: "ip-agent", label: "No" },
  ],
}

const securityLayersConfig = {
  layers: [
    {
      id: "l1",
      title: "L1: Meta Cloud API",
      subtitle: "SIM/Device-verified Sender Identity",
      icon: "si:meta",
      color: "red",
      nodes: [
        { id: "sl-meta", icon: "si:meta", title: "Meta Cloud API", subtitle: "SIM-verified sender" },
      ],
    },
    {
      id: "l2",
      title: "L2: Webhook HMAC",
      subtitle: "SHA-256 Signature on Every Webhook",
      icon: "fa-lock",
      color: "warm",
      nodes: [
        { id: "sl-hmac", icon: "fa-lock", title: "HMAC-SHA256", subtitle: "Webhook signature" },
      ],
    },
    {
      id: "l3",
      title: "L3: OTP Binding",
      subtitle: "Phone Ownership Verified at Signup",
      icon: "fa-key",
      color: "teal",
      nodes: [
        { id: "sl-otp", icon: "fa-key", title: "OTP Verification", subtitle: "Phone ownership proof" },
      ],
    },
    {
      id: "l4",
      title: "L4: Role-based Auth",
      subtitle: "Sensitive Ops Require Clerk Auth",
      icon: "fa-shield-halved",
      color: "dark",
      nodes: [
        { id: "sl-clerk", icon: "si:clerk", title: "Clerk Auth", subtitle: "Dashboard RBAC" },
      ],
    },
  ],
  connections: [
    { from: "sl-meta", to: "sl-hmac" },
    { from: "sl-hmac", to: "sl-otp" },
    { from: "sl-otp", to: "sl-clerk" },
  ],
}

const identFlowConfig = {
  type: "sequence",
  actors: [
    { id: "uid-user", icon: "si:whatsapp", title: "User's WhatsApp", color: "teal" },
    { id: "uid-meta", icon: "si:meta", title: "Meta Cloud API", color: "warm" },
    { id: "uid-convex", icon: "si:convex", title: "Convex", color: "teal" },
  ],
  steps: [
    { from: "uid-user", to: "uid-meta", label: "Sends msg to Ecqqo" },
    { from: "uid-meta", to: "uid-convex", label: "Webhook POST (phone, body, ts)" },
    { over: "uid-convex", note: "1. Validate HMAC signature\n2. Normalize phone to E.164\n3. Lookup in waAccounts" },
    { over: "uid-convex", note: "Phone found → Route to agent context\nNot found → Send onboarding message" },
  ],
}
</script>

<ArchDiagram :config="securityLayersConfig" />
