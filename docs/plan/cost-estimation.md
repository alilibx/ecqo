# Cost Estimation

Monthly infrastructure, AI, and transaction costs for Ecqqo — from pilot through scale.

## TL;DR — Total Cost & Unit Economics

### All-In Monthly Cost

| Stage | Users | Total Cost | Cost/User | Revenue/User | Margin |
|-------|------:|-----------:|----------:|-------------:|-------:|
| Pilot | 5 | **$174** | **$34.80** | $199 | **83%** |
| Growth | 20 | **$404** | **$20.20** | $199 | **90%** |
| Scale | 50 | **$897** | **$17.94** | $199 | **91%** |
| Blended 100 | 100 | ~$1,600 | **~$16.00** | $289* | **94%** |

> *Blended revenue assumes 60% Founder ($199) + 30% Dreamer ($399) + 10% Custom (~$500) = $289 avg.*

**Key assumption:** 50–100 agent runs per user per month. Each run = one orchestrator → specialist → extraction → embedding pipeline.

### Cost Per User Breakdown (at Pilot)

| Category | $/user/mo | % of total |
|----------|----------:|-----------:|
| Infrastructure | $24.00 | 69% |
| AI API calls | $2.65 | 8% |
| Stripe fees | $6.08 | 17% |
| WhatsApp outbound | $2.00 | 6% |
| Google APIs | $0.00 | 0% |
| **Total** | **$34.73** | 100% |

> Infrastructure cost per user drops significantly at scale (shared base costs like Vercel, Convex, domain are amortized). AI and Stripe scale linearly.

---

## Revenue Projections

| Milestone | Users | MRR | Total Cost | Net Profit | Margin |
|-----------|------:|----:|-----------:|-----------:|-------:|
| Pilot | 5 | $995 | $174 | $821 | 83% |
| Growth | 20 | $3,980 | $404 | $3,576 | 90% |
| Scale | 50 | $9,950 | $897 | $9,053 | 91% |
| Blended 100 | 100 | $28,910 | ~$1,600 | ~$27,310 | 94% |

> Blended 100: (60 × $199) + (30 × $399) + (10 × $500) = $28,910 MRR.

---

## Cost Breakdown by Category

### 1. AI API Costs — $1.33–$2.65/user/mo

The largest variable cost. Each "agent run" passes through 4 steps:

| Step | Model | Input | Output | Cost/run |
|------|-------|------:|-------:|---------:|
| 1. Orchestrator (planning) | Claude Sonnet 4 | ~2,000 tok | ~500 tok | $0.009 |
| 2. Specialist (action) | Claude Sonnet 4 | ~3,000 tok | ~1,000 tok | $0.016 |
| 3. Extraction (memory) | Claude Haiku 3.5 | ~2,000 tok | ~500 tok | $0.0015 |
| 4. Embedding (indexing) | text-embedding-3-small | ~500 tok | — | $0.00001 |
| **Total per run** | | | | **$0.0265** |

| Usage level | Runs/user/mo | AI cost/user/mo |
|-------------|-------------:|----------------:|
| Light | 50 | $1.33 |
| Average | 75 | $1.99 |
| Heavy | 100 | $2.65 |

**At scale (per 1,000 runs):**

| Model | Role | Cost/1K runs |
|-------|------|-------------:|
| Claude Sonnet 4 | Orchestrator | $9.00 |
| Claude Sonnet 4 | Specialist | $16.00 |
| Claude Haiku 3.5 | Extraction | $1.50 |
| text-embedding-3-small | Embeddings | $0.01 |
| **Total** | | **$26.50** |

### 2. Infrastructure — $60–$120/mo base

| Service | Tier | Cost/mo | Notes |
|---------|------|--------:|-------|
| Vercel | Pro | $20 | SSR hosting, edge functions, TanStack Start |
| Convex | Pro | $25 | Reactive backend, 1M function calls/mo, vector search |
| Fly.io | Pay-as-you-go | $15–$50 | 1 machine per user (shared-cpu-1x, 256MB) |
| Clerk | Free → Pro | $0–$25 | Free: 10K MAU. Pro: custom domain + RBAC |
| Resend | Free | $0 | 3,000 emails/mo free tier |
| Domain + DNS | — | ~$1.25 | ~$15/yr via Cloudflare |
| **Subtotal** | | **$60–$120** | Before AI/transaction costs |

#### Fly.io Detail — Scales with Users

Each WhatsApp connector runs as a dedicated Fly Machine (`shared-cpu-1x`, 256MB RAM) at ~$0.0000022/s.

| Stage | Machines | Uptime/mo | Cost/mo |
|-------|----------:|----------:|--------:|
| Pilot (5) | 5 | ~720 hrs | ~$15 |
| Growth (20) | 20 | ~720 hrs | ~$35 |
| Scale (50) | 50 | ~720 hrs | $50–$80 |

> Worst-case (always-on). Machines auto-stop on disconnect/idle, reducing real cost by 40–60%.

### 3. Stripe Transaction Fees — 2.9% + $0.30/txn

| Users | MRR | Stripe Fee | Net after Stripe |
|------:|----:|-----------:|-----------------:|
| 5 | $995 | $30.50 | $964.50 |
| 20 | $3,980 | $121.40 | $3,858.60 |
| 50 | $9,950 | $303.55 | $9,646.45 |

> Fee = (2.9% × MRR) + ($0.30 × users).

### 4. WhatsApp (Meta Cloud API) — $5–$20/mo

| Feature | Pricing | Usage estimate |
|---------|---------|----------------|
| Receiving messages | Free | All inbound via webhook |
| Business-initiated msgs | $0.005–$0.08/conversation | Approvals, reminders, digests |
| **Pilot estimate** | **$5–$20/mo** | ~100–400 outbound conversations/mo |

### 5. Google Workspace APIs — $0/mo

| API | Free Quota | Ecqqo Usage |
|-----|-----------|-------------|
| Google Calendar | 1M queries/day | ~500/user/day |
| Gmail | 1B quota units/day | ~200/user/day |

> Comfortably within free tier at all projected stages.

---

## Cost Optimization Strategies

1. **Fly.io auto-stop** — Stop connector machines when user disconnects or idles >1 hr. Reduces Fly costs 40–60%.

2. **Model routing** — Haiku for extraction/classification, Sonnet for reasoning. Already reflected above.

3. **Prompt caching** — Anthropic prompt caching on stable system prompts could cut orchestrator input costs ~80%.

4. **Batch embeddings** — Group memory updates into batches to reduce API call overhead.

5. **Convex function optimization** — Monitor hot paths (sync polling, dashboard queries) to stay within 1M calls/mo included in Pro.

6. **Defer expensive features** — Without meeting briefs (G8) and email digests (G6), per-user AI cost drops to ~$0.80–$1.60/mo.
