# Ecqqo

**WhatsApp-native executive assistant that replaces manual coordination overhead.**

Ecqqo watches your WhatsApp chats for scheduling, calendar checks, email summaries, reminders, and travel coordination — then acts on your behalf. No extra apps. No handoffs. No follow-up leaks.

Built for high-net-worth operators, founders, and family-office teams who already run their day through WhatsApp.

## What It Does

- **Smart Scheduling** — Detects meeting intent in WhatsApp threads, proposes times, and creates calendar events after your approval.
- **Calendar Check** — Ask "What's on my calendar today?" and get an instant summary right in chat.
- **Email Digest** — Summarizes unread emails, flagged threads, or messages from key contacts (Gmail & Outlook).
- **Reminders & Follow-ups** — "Remind me to call Sarah at 5pm" — Ecqqo nudges you at the right time via WhatsApp.
- **Travel Coordination** — Share flight details or hotel confirmations and Ecqqo adds them to your calendar automatically.
- **Meeting Briefs** — Get pre-meeting briefs with attendee context, agenda, and relevant notes before any call.

## How It Works

1. **Capture** — Ecqqo reads approved WhatsApp threads and detects scheduling intent in real time.
2. **Propose** — It drafts an action-ready proposal with participants, timing, and context.
3. **Execute** — Once approved, Ecqqo finalizes the event flow and keeps records synchronized.

Everything happens inside WhatsApp via the Meta Cloud API. No new apps to install.

## Pricing

| Plan | AED/mo | USD/mo | Includes |
|------|--------|--------|----------|
| **Founder** | 749 | 199 | 1 principal line, unlimited scheduling, proposal + approval flow |
| **Dreamer** | 1,499 | 399 | Up to 5 principals, priority rule logic, shared operations view |
| **Custom** | TBD | TBD | Custom team config, dedicated onboarding & support |

Compare that to a remote VA midpoint (~$2,400/mo) or an executive assistant average (~$5,945/mo).

## Tech Stack

- **Frontend**: [TanStack Start](https://tanstack.com/start) + React 19 (SSR, file-based routing)
- **Backend**: [Convex](https://convex.dev) (reactive database, mutations, queries)
- **Email**: [@convex-dev/resend](https://www.convex.dev/components/resend) (transactional emails)
- **Styling**: Custom CSS with design tokens (no Tailwind)
- **Build**: Vite 7 + Nitro
- **Deployment**: Vercel

## Development

```bash
# Install dependencies
bun install

# Start the frontend dev server
bun run dev

# Start the Convex backend (separate terminal)
bun run dev:backend

# Production build
bun run build
```

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_CONVEX_URL` | `.env.local` | Convex deployment URL |
| `RESEND_API_KEY` | Convex dashboard | Transactional email via Resend |

## License

Copyright 2026 Ecqqo. All rights reserved.
