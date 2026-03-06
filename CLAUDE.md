# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun run dev` — Start the Vite dev server (TanStack Start SSR)
- `bun run dev:backend` — Start the Convex dev server (run in a separate terminal)
- `bun run build` — Production build
- `bun run start` — Start the production server

Use bun as the package manager and script runner.

## Architecture

**Ecqqo** is a WhatsApp-native executive assistant MVP built with:

### Frontend — TanStack Start + React (`app/`)
- `app/router.tsx` — Router setup with Convex + TanStack Query providers
- `app/routes/__root.tsx` — Root layout with HTML shell, meta tags, fonts, JSON-LD
- `app/routes/index.tsx` — Landing page (single-page, all sections). Conversion-focused SaaS page targeting high-net-worth operators. Contains: currency toggle (AED/USD), savings calculator, typing headline animation, WhatsApp chat message sequencer, scroll reveal, burger menu, and waitlist form wired to Convex.
- `app/styles.css` — Custom CSS with design tokens in `:root`, responsive breakpoints at 1024px and 640px
- `app/client.tsx` / `app/ssr.tsx` — Client hydration and SSR entry points

### Backend — Convex (`convex/`)
- `convex/schema.ts` — Database schema. Tables: `waitlist` (email, position, joinedAt) with indexes by_email and by_position
- `convex/waitlist.ts` — `join` mutation (add to waitlist, send confirmation email via Resend) and `getCount` query
- `convex/emails.ts` — Resend component instance and branded HTML email template for waitlist confirmation
- `convex/convex.config.ts` — App config with `@convex-dev/resend` component

### Config
- `vite.config.ts` — Vite config with `tanstackStart({ srcDirectory: "app" })` plugin
- `tsr.config.json` — TanStack Router config (routes in `app/routes/`, generated tree in `app/routeTree.gen.ts`)

### Key integrations
- **Convex** — Reactive backend (queries, mutations, actions). Connected via `@convex-dev/react-query` + `ConvexProvider` in `app/router.tsx`
- **Resend** — Transactional email via `@convex-dev/resend` component. Requires `RESEND_API_KEY` env var in Convex dashboard.
- **TanStack Start** — SSR React framework with file-based routing

### Environment variables
- `VITE_CONVEX_URL` — Convex deployment URL (in `.env.local`)
- `RESEND_API_KEY` — Set in Convex dashboard (not in local env)

## Design system

Fonts: Archivo Black (headings), DM Sans (body), JetBrains Mono (labels/nav). Colors: `--signal` (#e04b2c) for primary CTA, `--accent` (#0d7a6a) for teal accents. Light warm palette (`--bg: #faf7f0`).
