# Deployment & Infrastructure

This document covers how Ecqo's components are deployed, why specific infrastructure choices were made, and how the monorepo is structured.

## Deployment Topology

```
+-----------------------------------------------------------------------------------+
|                              VERCEL                                               |
|                                                                                   |
|   +---------------------------+     +-------------------------------+             |
|   |  Edge Network (CDN)       |     |  Serverless Functions         |             |
|   |                           |     |                               |             |
|   |  - Static assets          |     |  - TanStack Start SSR         |             |
|   |  - CSS, JS bundles        |     |  - Server-side rendering      |             |
|   |  - Images, fonts          |     |  - API routes (if needed)     |             |
|   |  - Cache headers          |     |  - Clerk webhook handler      |             |
|   |                           |     |                               |             |
|   +---------------------------+     +---------------+---------------+             |
|                                                     |                             |
+-----------------------------------------------------|-----------------------------+
                                                      |
                            Convex client SDK         |  Clerk JWT
                            (queries, mutations,      |  verification
                             subscriptions)            |
                                                      |
+-----------------------------------------------------|-----------------------------+
|                         CONVEX CLOUD                 |                             |
|                                                      v                            |
|   +-----------------------------------------------------------+                  |
|   |                  Convex Deployment                         |                  |
|   |                                                            |                  |
|   |   +------------------+  +------------------+              |                  |
|   |   | Query Engine     |  | Mutation Engine  |              |                  |
|   |   | (real-time subs) |  | (transactional)  |              |                  |
|   |   +------------------+  +------------------+              |                  |
|   |                                                            |                  |
|   |   +------------------+  +------------------+              |                  |
|   |   | Action Runner    |  | Scheduler        |              |                  |
|   |   | (external calls) |  | (cron + delayed) |              |                  |
|   |   +------------------+  +------------------+              |                  |
|   |                                                            |                  |
|   |   +------------------+  +------------------+              |                  |
|   |   | Vector Index     |  | File Storage     |              |                  |
|   |   | (embeddings)     |  | (media, docs)    |              |                  |
|   |   +------------------+  +------------------+              |                  |
|   |                                                            |                  |
|   +-----------------------------------------------------------+                  |
|                         |              |            |                              |
|   Managed, auto-scaling |              |            |  No infrastructure           |
|   Zero-ops              |              |            |  to manage                   |
+-------------------------|--------------|------------|-----------------------------+
                          |              |            |
           AI provider    |   lifecycle  |            |  webhooks
           API calls      |   commands   |            |
                          |              |            |
          +---------------+    +---------+--------+   |
          |                    |                  |   |
          v                    v                  |   |
+-----------------+  +---------------------+     |   |
| AI PROVIDERS    |  | FLY.IO              |     |   |
|                 |  |                     |     |   |
| - OpenAI API   |  |  +--------------+   |     |   |
| - Anthropic    |  |  | Machine A    |   |     |   |
| - Groq         |  |  | (User 1)    |   |     |   |
| - OpenRouter   |  |  | wacli proc  |   |     |   |
| - Azure OpenAI |  |  +--------------+   |     |   |
|                 |  |                     |     |   |
|                 |  |  +--------------+   |     |   |
|                 |  |  | Machine B    |   |     |   |
|                 |  |  | (User 2)    |   |     |   |
|                 |  |  | wacli proc  |   |     |   |
|                 |  |  +--------------+   |     |   |
|                 |  |                     |     |   |
|                 |  |  +--------------+   |     |   |
|                 |  |  | Machine C    |   |     |   |
|                 |  |  | (stopped)   |   |     |   |
|                 |  |  | $0/mo       |   |     |   |
|                 |  |  +--------------+   |     |   |
|                 |  |                     |     |   |
+-----------------+  +---------------------+     |   |
                                                 |   |
                     +---------------------+     |   |
                     | META CLOUD API      |<----+   |
                     |                     |         |
                     | - WhatsApp Business |<--------+
                     |   API               |
                     | - Webhook delivery  |
                     | - Message sending   |
                     +---------------------+

                     +---------------------+
                     | EXTERNAL APIS       |<--- Convex Actions
                     |                     |
                     | - Google Calendar   |
                     | - Gmail API         |
                     | - Stripe API        |
                     +---------------------+
```

## Why Fly.io for Connector Workers

The connector worker runs a long-lived wacli process per user to maintain a WhatsApp Web session. This workload requires persistent processes, per-user isolation, and cost efficiency at low scale. Fly.io Machines are the best fit for a solo developer building toward an April 15 deadline.

### Fly.io Machines Advantages

| Factor | Fly.io Machines | AWS ECS/Fargate |
|---|---|---|
| **Cost when stopped** | $0 (machines can be fully stopped) | Fargate tasks must be running or removed; no "paused" billing |
| **Per-user cost (active)** | ~$3-5/mo (shared-cpu-1x, 256MB RAM) | ~$10-15/mo (minimum Fargate pricing) |
| **Deployment** | `flyctl deploy` (single command) | ECR push + task definition update + service update |
| **Setup complexity** | Dockerfile + `fly.toml` | VPC, subnets, security groups, IAM roles, task definitions, service configs |
| **Process isolation** | Each Machine is a full microVM | Each task is an isolated container (comparable) |
| **Private networking** | Built-in (`.internal` DNS) | Requires VPC configuration |
| **Start/stop latency** | ~300ms to boot a stopped Machine | 30-60s for Fargate task startup |
| **Ops overhead for solo dev** | Minimal -- Fly handles orchestration | Significant -- CloudWatch, IAM, networking, service discovery |
| **Scale model** | Explicitly start/stop Machines via API | Auto-scaling groups, desired count management |

### Cost Projection

| Users | Fly.io (active machines) | AWS Fargate (equivalent) |
|-------|--------------------------|--------------------------|
| 10 | ~$30-50/mo | ~$100-150/mo |
| 50 | ~$150-250/mo | ~$500-750/mo |
| 100 | ~$300-500/mo | ~$1000-1500/mo |

- Stopped machines cost $0 on Fly.io
- Many users may be inactive (stopped) at any given time

At MVP scale (under 100 users), Fly.io is roughly 3x cheaper and requires a fraction of the operational setup. If the workload grows past 500+ users, evaluating ECS or a custom orchestration layer would make sense -- but that is not an April 15 concern.

## Monorepo Structure

```
ecqo/
  app/                          # TanStack Start frontend (deploys to Vercel)
    client.tsx                  #   Client hydration entry
    ssr.tsx                     #   SSR entry (createStartHandler)
    router.tsx                  #   Router setup with Convex + Clerk providers
    routes/                     #   File-based routes
      __root.tsx                #     Root layout (HTML shell, meta, fonts)
      index.tsx                 #     Landing page (waitlist, hero, features)
      dashboard.tsx             #     Authenticated dashboard shell
      dashboard/                #     Dashboard sub-routes
        conversations.tsx       #       Message history view
        approvals.tsx           #       Pending approvals
        settings.tsx            #       User preferences & policies
    styles.css                  #   Design tokens + component styles
    components/                 #   Shared React components
    hooks/                      #   Custom hooks (useConvex, useAuth, etc.)
    lib/                        #   Utilities (formatting, constants)

  convex/                       # Convex backend (deploys to Convex Cloud)
    schema.ts                   #   Database schema (all tables + indexes)
    auth.config.ts              #   Clerk integration config
    convex.config.ts            #   Component registration (Resend, etc.)
    functions/                  #   Organized by domain
      users.ts                  #     User CRUD, phone-number lookup
      messages.ts               #     Message ingestion, queries
      agents.ts                 #     Agent run lifecycle
      memory.ts                 #     Vector store, embedding, retrieval
      approvals.ts              #     Approval CRUD, notification triggers
      billing.ts                #     Stripe webhook handler, subscription state
      connectors.ts             #     Fly.io machine lifecycle management
    emails.ts                   #   Email templates (Resend)
    crons.ts                    #   Scheduled jobs (sync checks, cleanup)

  services/
    connector/                  # Fly.io wacli worker (deploys to Fly.io)
      Dockerfile                #   Container image definition
      fly.toml                  #   Fly.io app config (region, size, etc.)
      src/
        index.ts                #     Entry point -- starts wacli, connects to Convex
        sync.ts                 #     Message sync logic, cursor management
        auth.ts                 #     Service token validation, event signing
        health.ts               #     Health check endpoint for Fly.io

  shared/                       # Shared code (imported by app/, convex/, services/)
    types.ts                    #   Shared TypeScript types
    constants.ts                #   Shared constants (status enums, limits)
    validation.ts               #   Shared validation schemas (zod)

  docs/                         # VitePress documentation (this site)
    .vitepress/
      config.ts                 #   VitePress config (sidebar, nav, theme)
    architecture/               #   Architecture docs
    guides/                     #   Developer guides
    api/                        #   API reference

  vite.config.ts                # Vite config (tanstackStart plugin)
  tsr.config.json               # TanStack Router config
  package.json                  # Root package.json (workspaces)
  bun.lockb                     # Bun lockfile
  .env.local                    # Local env vars (VITE_CONVEX_URL, etc.)
```

## Environment Variables

### Vercel (Dashboard)

| Variable | Description | Set In |
|---|---|---|
| `VITE_CONVEX_URL` | Convex deployment URL | Vercel dashboard + `.env.local` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend key | Vercel dashboard + `.env.local` |
| `CLERK_SECRET_KEY` | Clerk backend key (SSR) | Vercel dashboard |
| `VERCEL_URL` | Auto-set by Vercel | Automatic |

### Convex Cloud (Backend)

| Variable | Description | Set In |
|---|---|---|
| `CLERK_ISSUER_URL` | Clerk JWT issuer for validation | Convex dashboard |
| `RESEND_API_KEY` | Resend transactional email key | Convex dashboard |
| `OPENAI_API_KEY` | OpenAI API key (primary provider) | Convex dashboard |
| `ANTHROPIC_API_KEY` | Anthropic API key (specialist tasks) | Convex dashboard |
| `GROQ_API_KEY` | Groq API key (fast inference) | Convex dashboard |
| `STRIPE_SECRET_KEY` | Stripe API key | Convex dashboard |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Convex dashboard |
| `META_WHATSAPP_TOKEN` | Meta Cloud API access token | Convex dashboard |
| `META_WHATSAPP_VERIFY_TOKEN` | Webhook verification token | Convex dashboard |
| `META_APP_SECRET` | Meta app secret (signature verification) | Convex dashboard |
| `FLY_API_TOKEN` | Fly.io API token (machine management) | Convex dashboard |
| `CONNECTOR_SIGNING_KEY` | Shared secret for event signing | Convex dashboard |

### Fly.io (Connector Workers)

| Variable | Description | Set In |
|---|---|---|
| `CONVEX_URL` | Convex deployment URL | `fly secrets set` |
| `CONVEX_SERVICE_TOKEN` | Scoped Convex auth token | `fly secrets set` (per machine) |
| `CONNECTOR_SIGNING_KEY` | Shared secret for event signing | `fly secrets set` |
| `USER_ID` | Convex user ID this machine serves | `fly secrets set` (per machine) |

## CI/CD Pipeline

```
  +------------------+
  |  git push        |
  |  (main branch)   |
  +--------+---------+
           |
           v
  +--------+---------+     +-------------------+     +-------------------+
  |  GitHub Actions   |     |                   |     |                   |
  |                   |---->|  Lint + Type Check|---->|  Unit Tests       |
  |  Triggered on:    |     |  (bun run check)  |     |  (bun run test)   |
  |  - push to main   |     |                   |     |                   |
  |  - PR to main     |     +-------------------+     +--------+----------+
  |                   |                                        |
  +-------------------+                                        |
                                                               | all pass
                                                               v
                         +-------------------------------------+-----+
                         |                                           |
                         v                                           v
               +---------+----------+                   +------------+---------+
               |  Vercel Auto       |                   |  Convex Auto         |
               |  Deploy            |                   |  Deploy              |
               |                    |                   |                      |
               |  - Builds app/     |                   |  - Pushes convex/    |
               |  - SSR functions   |                   |  - Runs migrations   |
               |  - Edge assets     |                   |  - Updates functions |
               |                    |                   |                      |
               |  (via Vercel Git   |                   |  (via npx convex     |
               |   integration)     |                   |   deploy)            |
               +--------------------+                   +----------------------+

               +--------------------+
               |  Fly.io Deploy     |
               |  (Manual or CI)    |
               |                    |
               |  - flyctl deploy   |
               |    services/       |
               |    connector/      |
               |                    |
               |  Triggered:        |
               |  - When services/  |
               |    connector/      |
               |    changes         |
               +--------------------+
```

### Deployment Notes

- **Vercel** deploys automatically on every push to `main` via its Git integration. Preview deployments are created for pull requests.
- **Convex** deploys automatically via `npx convex deploy` in the CI pipeline. Schema migrations run automatically. Development uses `npx convex dev` for hot-reloading.
- **Fly.io** connector deploys are triggered manually or via a CI step that detects changes in `services/connector/`. Machine images are built and deployed with `flyctl deploy`. Individual user machines are started/stopped via the Fly.io Machines API from Convex actions.
- **Docs** (VitePress) can be deployed to Vercel as a separate project or as a path under the main domain if needed.

### Pre-deployment Checklist

1. All environment variables set in respective dashboards (Vercel, Convex, Fly.io)
2. Clerk application configured with correct redirect URLs
3. Meta WhatsApp Business account verified and webhook URL configured
4. Stripe products and prices created, webhook endpoint registered
5. Fly.io app created with `flyctl apps create ecqo-connector`
6. Convex project linked with `npx convex init` or `npx convex link`
