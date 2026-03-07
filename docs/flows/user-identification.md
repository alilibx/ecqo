# User Identification (Single Number)

## Problem Statement

Ecqo operates through a **single WhatsApp Business number** powered by the Meta Cloud API. Every user -- whether an owner, principal, or operator -- messages this same number. The system must reliably identify which user is sending each inbound message and route it to the correct agent context, workspace, and conversation state.

This is fundamentally different from the wacli-based connection (where Ecqo reads a user's personal WhatsApp). Here, Ecqo's own Business number **receives** messages from users. The identification challenge: given an inbound message from phone number `+971501234567`, determine which Ecqo user account this belongs to, and which workspace/agent context to activate.

## Inbound Message Identification Flow

```
    User's WhatsApp                Meta Cloud API              Convex
    ──────────────                 ──────────────              ──────
         │                              │                        │
         │  1. User sends message       │                        │
         │     to Ecqo's number         │                        │
         │─────────────────────────────>│                        │
         │                              │                        │
         │                              │  2. Webhook fires      │
         │                              │     POST /webhook      │
         │                              │     payload includes:  │
         │                              │     - sender phone     │
         │                              │     - message body     │
         │                              │     - timestamp        │
         │                              │─────────────────────────>│
         │                              │                        │
         │                              │                        │  3. Validate webhook
         │                              │                        │     signature (HMAC)
         │                              │                        │
         │                              │                        │  4. Normalize phone
         │                              │                        │     to E.164 format
         │                              │                        │
         │                              │                        │  5. Lookup phone in
         │                              │                        │     waAccounts table
         │                              │                        │
         │                              │                        │     ┌──────────────┐
         │                              │                        │     │ Phone found? │
         │                              │                        │     └──────┬───────┘
         │                              │                        │            │
         │                              │                        │     YES    │    NO
         │                              │                        │     ┌──────┴──────┐
         │                              │                        │     v             v
         │                              │                        │  Route to      Send
         │                              │                        │  user's        onboarding
         │                              │                        │  agent         message
         │                              │                        │  context
         │                              │                        │
```

## Registration and Phone Binding Flow

Before a user can interact with Ecqo via WhatsApp, their phone number must be bound to their account. This happens during onboarding:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                        Phone Number Binding Flow                           │
 └─────────────────────────────────────────────────────────────────────────────┘

  Step 1: Sign Up                Step 2: Verify               Step 3: Bind
  ─────────────                  ──────────────                ──────────────

  ┌──────────────┐          ┌───────────────────┐        ┌──────────────────┐
  │   User signs │          │  Ecqo sends OTP   │        │  waAccount       │
  │   up via     │          │  via WhatsApp to  │        │  record created  │
  │   Dashboard  │────────> │  provided number  │──────> │  with verified   │
  │   (Clerk)    │          │                   │        │  phone number    │
  │              │          │  User enters OTP  │        │                  │
  │  Provides:   │          │  in dashboard     │        │  Phone is now    │
  │  - email     │          │                   │        │  bound to user   │
  │  - phone     │          │  Convex validates │        │  and workspace   │
  │  - workspace │          │  OTP + marks      │        │                  │
  │    name      │          │  phone verified   │        │  Inbound msgs    │
  └──────────────┘          └───────────────────┘        │  will route here │
                                                         └──────────────────┘
```

### Why OTP via WhatsApp?

The OTP is sent via Ecqo's WhatsApp Business number to the user's phone. This serves dual purpose:

1. **Verifies phone ownership** -- only the person with the phone can read the OTP.
2. **Establishes the conversation** -- the user now has a chat thread with Ecqo, making future interactions seamless.

## Complete Identification Pipeline

```
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                     Inbound Message Identification Pipeline                     │
  └─────────────────────────────────────────────────────────────────────────────────┘

  Meta Cloud API Webhook
         │
         v
  ┌──────────────────┐
  │ Validate webhook │──── FAIL ──> Reject (401)
  │ HMAC signature   │
  └────────┬─────────┘
           │ PASS
           v
  ┌──────────────────┐
  │ Extract sender   │
  │ phone number     │
  │ from payload     │
  └────────┬─────────┘
           │
           v
  ┌──────────────────┐
  │ Normalize to     │     +971-50-123-4567  -->  +971501234567
  │ E.164 format     │     00971501234567    -->  +971501234567
  │                  │     0501234567 (AE)   -->  +971501234567
  └────────┬─────────┘
           │
           v
  ┌──────────────────┐     ┌────────────────────────────────────┐
  │ Query waAccounts │     │  waAccounts table                  │
  │ by phone number  │────>│  index: by_phone (E.164)           │
  │                  │     │  fields: userId, workspaceId,      │
  │                  │     │          phone, verified, role      │
  └────────┬─────────┘     └────────────────────────────────────┘
           │
           ├─── FOUND ──────────────────────────┐
           │                                    v
           │                          ┌───────────────────┐
           │                          │ Load user context  │
           │                          │ - workspace        │
           │                          │ - role (owner /    │
           │                          │   principal /      │
           │                          │   operator)        │
           │                          │ - agent state      │
           │                          │ - memory context   │
           │                          └─────────┬─────────┘
           │                                    │
           │                                    v
           │                          ┌───────────────────┐
           │                          │ Check if message  │
           │                          │ is an approval    │──── YES ──> Route to
           │                          │ response          │            approval
           │                          └─────────┬─────────┘            handler
           │                                    │ NO
           │                                    v
           │                          ┌───────────────────┐
           │                          │ Dispatch to agent │
           │                          │ orchestrator for  │
           │                          │ this user         │
           │                          └───────────────────┘
           │
           └─── NOT FOUND ──────────────────────┐
                                                v
                                      ┌───────────────────┐
                                      │ Send onboarding   │
                                      │ message:          │
                                      │ "Welcome to Ecqo! │
                                      │  Sign up at       │
                                      │  ecqo.com to get  │
                                      │  started."        │
                                      └───────────────────┘
```

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

### Unregistered User Messages Ecqo

When someone who hasn't signed up sends a message to Ecqo's WhatsApp number:

- The phone lookup returns no match.
- Ecqo responds with a friendly onboarding message (templated, pre-approved by Meta).
- The message is logged for analytics but no agent context is created.
- Rate limiting applies: max 3 onboarding messages per phone per 24h to prevent abuse.

### Phone Number Format Normalization

All phone numbers are stored and compared in **E.164 format** (`+` prefix, country code, no separators):

```
  Input                    Normalized (E.164)
  ─────                    ──────────────────
  +971501234567            +971501234567       (already E.164)
  00971501234567           +971501234567       (international prefix)
  0501234567               +971501234567       (local, needs country code from context)
  971-50-123-4567          +971501234567       (strip separators, add +)
  +1 (415) 555-0123       +14155550123        (US number)
```

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

```
  Security Layers
  ───────────────

  Layer 1: Meta Cloud API
  ┌─────────────────────────────────────────────┐
  │ Meta verifies sender identity via           │
  │ SIM/device binding. Cannot be spoofed       │
  │ at the WhatsApp protocol level.             │
  └──────────────────────┬──────────────────────┘
                         │
  Layer 2: Webhook HMAC  │
  ┌──────────────────────┴──────────────────────┐
  │ HMAC-SHA256 signature on every webhook.     │
  │ Prevents forged HTTP calls to our endpoint. │
  └──────────────────────┬──────────────────────┘
                         │
  Layer 3: OTP Binding   │
  ┌──────────────────────┴──────────────────────┐
  │ Phone ownership verified during signup.     │
  │ Only verified phones are bound to accounts. │
  └──────────────────────┬──────────────────────┘
                         │
  Layer 4: Role-based    │
  ┌──────────────────────┴──────────────────────┐
  │ Sensitive operations require Clerk auth     │
  │ via dashboard. WhatsApp used for routing    │
  │ and approvals only.                         │
  └─────────────────────────────────────────────┘
```
