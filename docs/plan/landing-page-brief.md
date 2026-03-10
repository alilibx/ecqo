# Landing Page Update Brief

> Last updated: 2026-03-10
>
> This document specifies **what** and **how** to update the landing page (`app/routes/index.tsx`) when we rebuild it. It is a creative and copy brief, not a code spec.

---

## Strategic context

The landing page must reposition Ecqo against a market where OpenClaw has validated massive demand for chat-native AI assistants, but the premium managed tier for executives is completely empty.

**Core tension to resolve:** OpenClaw is free and powerful. Ecqo is $199-399/mo. The page must make the value gap viscerally clear — not by bashing OpenClaw, but by showing what managed + executive-grade means.

---

## Positioning statement (internal)

For high-net-worth operators in the Gulf who live in WhatsApp and need to delegate scheduling, communications, and admin tasks, Ecqo is the managed executive assistant that lives in WhatsApp with approval guardrails built in — unlike DIY alternatives that require self-hosting, expose credentials, and lack executive-grade workflows.

---

## Page structure & copy

### 1. Hero section

**Headline:** "Your executive assistant lives in WhatsApp. Finally."

**Subheadline:** "Delegate scheduling, email, and admin tasks through the app you already use — with guardrails that mean nothing happens without your say-so."

**Primary CTA:** "Start your free trial" (links to WhatsApp or waitlist)
**Secondary CTA:** "See how it works" (scrolls to demo section)

**Design notes:**
- Keep the typing animation from the previous version — it was effective
- Consider a WhatsApp chat mockup showing a real delegation flow (e.g., "Schedule a meeting with Sarah tomorrow at 3pm" → approval preview → confirmed)
- Warm background (#faf7f0), Archivo Black headline, DM Sans body

### 2. Problem section

**Heading:** "Your time is worth more than admin work"

**Copy (3 pain points):**
1. "You're copying calendar links between WhatsApp and Google Calendar. Again."
2. "Your PA missed an email thread and double-booked your afternoon."
3. "You tried an AI assistant. It sent an email to the wrong person. Without asking."

**Design notes:**
- Short, punchy, relatable. No jargon.
- Each pain point could have a subtle icon or illustration

### 3. Solution section — "How Ecqo works"

**Three steps, each with WhatsApp chat mockup:**

**Step 1: "Message our number"**
- Copy: "Save the Ecqo number. Send a message. That's the entire setup."
- Mockup: User sending first message, Ecqo responding with welcome
- Contrast point: "No apps to install. No API keys. No server to maintain."

**Step 2: "Tell it what you need"**
- Copy: "Schedule meetings. Draft emails. Get morning briefs. Set reminders. In your own words, in English or Arabic."
- Mockup: User delegating a scheduling task naturally
- Contrast point: "Not a chatbot with rigid commands. A real assistant that understands context."

**Step 3: "Approve before it acts"**
- Copy: "Every action gets a preview. You approve or reject in WhatsApp. Nothing fires without your say-so."
- Mockup: Approval message with dry-run preview, approve/reject buttons
- Contrast point: "Unlike DIY tools, Ecqo never acts without permission."

### 4. Trust section — "Not another DIY agent"

**This is the key differentiator section. Must be prominent.**

**Heading:** "Not another DIY agent"

**Copy:** "Self-hosted AI agents expose your credentials, break your WhatsApp, and need a developer on call. Ecqo is a managed service — we handle the infrastructure, security, and uptime. You handle your business."

**Comparison grid (visual, not a boring table):**

| | DIY agents | Ecqo |
|---|---|---|
| Setup | Install Node, configure API keys, debug | Message our number |
| WhatsApp | Unofficial library, ban risk | Official Meta API, verified business |
| Security | Plaintext keys, exposed ports | Managed infra, encrypted, audited |
| Approvals | CLI commands and tokens | Tap to approve in WhatsApp |
| When it breaks | You fix it | We fix it |

**Stats callout (optional, high impact):**
- "42,665 self-hosted AI agents found exposed online"
- "93% had no authentication"
- "Account bans reported within 48 hours"
- Sources: Oasis Security, Cisco, CNCERT/CC

**Design notes:**
- This section should feel like a "wake-up call" — warm but authoritative
- Don't name OpenClaw directly on the landing page (avoid looking petty). Say "DIY agents" or "self-hosted alternatives"
- The stats are powerful — use them as a visual callout, not buried in text

### 5. Features section

**Heading:** "What Ecqo handles for you"

**Six feature cards:**

1. **Scheduling & Calendar**
   - "Schedule, reschedule, or cancel meetings. Ecqo checks your availability and handles the back-and-forth."
   - Icon: calendar

2. **Email Digest & Drafts**
   - "Morning inbox summary. Flagged items. Draft replies. All in WhatsApp."
   - Icon: envelope

3. **Meeting Briefs**
   - "Context on who you're meeting, what was discussed last, and what to prepare — delivered before the meeting."
   - Icon: clipboard

4. **Reminders & Follow-ups**
   - "Set reminders in natural language. Ecqo delivers them in WhatsApp at the right time."
   - Icon: bell

5. **Memory & Preferences**
   - "Remembers your contacts, preferences, and patterns. Gets smarter the longer you use it."
   - Icon: brain

6. **Approval Workflow**
   - "Every action previewed. Every action approved. Full audit trail for compliance."
   - Icon: shield-check

### 6. Built for the Gulf section

**Heading:** "Built for the Gulf"

**Copy:** "AED pricing. Arabic and English. Sunday-Thursday work week. Your assistant understands your world."

**Key points:**
- Bilingual: responds in the language you message in
- AED/USD currency toggle (carry over from previous version)
- Gulf work week awareness (Sun-Thu)
- MENA-first design decisions

**Design notes:**
- This section can be lighter/shorter than others
- The currency toggle from the previous landing page was a good touch — keep it

### 7. Pricing section

**Plans (carry over structure, update copy):**

**Founder — $199/mo (749 AED/mo)**
- 1 principal
- Unlimited scheduling & calendar
- Approval workflow
- WhatsApp sync + memory
- Email support
- 14-day free trial

**Dreamer — $399/mo (1,499 AED/mo)**
- Up to 5 principals
- Everything in Founder
- Priority rules
- Shared operator view
- Email digest + meeting briefs
- Priority support
- 14-day free trial

**Custom — Contact us**
- Everything in Dreamer
- Dedicated onboarding
- Custom agent configuration
- SLA guarantee
- Direct support channel

**Reframe line:** "Less than 1 hour of executive time per month."

**Comparison note (subtle):** "vs. DIY alternatives: free software + API costs + your time debugging + ban risk + security exposure"

### 8. FAQ section

**Must-include questions:**

**Q: How is this different from ChatGPT / other AI assistants?**
A: ChatGPT is a conversation tool. Ecqo is an execution tool. It doesn't just answer questions — it takes actions on your behalf (scheduling, email, reminders) with your approval.

**Q: How is this different from self-hosted AI agents like OpenClaw?**
A: OpenClaw is a powerful tool for developers. Ecqo is a managed service for executives. No setup, no self-hosting, no security risks — and an approval workflow that ensures nothing fires without your permission. We use the official Meta WhatsApp API, so your personal account is never at risk.

**Q: Will my WhatsApp get banned?**
A: No. We use the official Meta Business API with a verified Ecqo number. We never log into or simulate your personal WhatsApp account.

**Q: Is my data safe?**
A: Your data is stored on managed infrastructure (Convex), encrypted at rest, with role-based access controls and an immutable audit trail. Nothing is stored on your personal device. You can request full data export or deletion at any time.

**Q: Do you support Arabic?**
A: Yes. Ecqo responds in the language you message in — English or Arabic (Gulf dialect).

**Q: What happens during the free trial?**
A: Full access to all features for 14 days. No credit card required to start. Cancel anytime.

### 9. Final CTA section

**Heading:** "Ready to stop being your own assistant?"

**CTA:** "Start your free trial" (primary button, --signal color)

**Subtext:** "14 days free. No credit card. No setup."

---

## Copy tone guidelines

- **Confident, not aggressive.** We know we're better for this audience — we don't need to trash anyone.
- **Direct, not salesy.** Short sentences. Active voice. No "revolutionize" or "cutting-edge."
- **Executive-appropriate.** These are busy, successful people. Respect their time and intelligence.
- **Specific, not vague.** "Tap to approve in WhatsApp" not "seamless approval experience."
- **Bilingual awareness.** Consider that some visitors may be Arabic-first. Keep English copy simple and translatable.

---

## Design direction

- **Carry over from previous version:** Warm palette (#faf7f0), typing animation, WhatsApp chat mockups, currency toggle, scroll reveal, burger menu
- **New elements:** Comparison grid (trust section), stats callout, feature cards, WhatsApp approval mockup
- **Fonts:** Archivo Black (headings), DM Sans (body), JetBrains Mono (labels/nav)
- **Colors:** --signal (#e04b2c) for primary CTA, --accent (#0d7a6a) for teal accents
- **Mobile-first:** Many Gulf executives browse on phone. Ensure all sections work at 375px width.

---

## Implementation notes

- **File:** `app/routes/index.tsx`
- **Current state:** Dashboard placeholder (hero + sections were removed during refactor)
- **Approach:** Rebuild as a single-page marketing site with all sections above
- **Translations:** The previous version used a translation object for EN/AR. Carry this pattern forward.
- **Convex integration:** Waitlist form wired to `convex/waitlist.ts` (join mutation, confirmation email via Resend)
- **Previous features to restore:** Currency toggle (AED/USD), savings calculator, typing headline animation, WhatsApp chat message sequencer, scroll reveal, burger menu
- **New features to add:** Comparison grid, stats callout, FAQ accordion, approval flow mockup
- **SEO:** JSON-LD structured data in root layout, meta description matching new positioning

---

## Success metrics

When the landing page is rebuilt, measure:
- **Waitlist conversion rate** (visitor → email submitted)
- **Time on page** (target: >90 seconds)
- **Scroll depth** (target: >60% reach pricing section)
- **FAQ engagement** (which questions get opened most)
- **Currency toggle usage** (AED vs USD preference)

---

## Cross-references

- [Competitive Positioning](/plan/positioning) — Full competitive analysis and USPs
- [Security: Ecqo vs Self-Hosted](/security/vs-self-hosted) — Technical security comparison
- [Billing (Stripe)](/plan/billing) — Plan details and enforcement logic
- [Cost Estimation](/plan/cost-estimation) — Unit economics backing the pricing
