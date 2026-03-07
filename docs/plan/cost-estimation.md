# Cost Estimation

Monthly infrastructure costs, AI API costs per user, and revenue projections for Ecqqo from pilot through scale.

## Monthly Infrastructure Costs

| Service | Tier | Cost/mo | Notes |
|---------|------|---------|-------|
| Vercel | Pro | $20 | SSR hosting, edge functions, TanStack Start deployment |
| Convex | Pro | $25 | Reactive backend, 1M function calls/mo, vector search, scheduled functions |
| Fly.io | Pay-as-you-go | $15 - $50 | 5-15 active wacli machines, shared-cpu-1x 256MB each. ~$0.0000022/s per machine. Stopped machines cost $0. |
| Clerk | Free -> Pro | $0 - $25 | Free tier: 10K MAU. Pro at $25/mo adds custom domain + advanced RBAC. |
| Stripe | Standard | 2.9% + 30c | Per-transaction fee. No monthly base. |
| Resend | Free | $0 | 3,000 emails/mo on free tier. More than enough for pilot. |
| Domain + DNS | -- | ~$1.25 | ~$15/yr via Cloudflare or Namecheap. |
| **SUBTOTAL** | | **$60 - $120** | Before AI API costs. |

### Fly.io Cost Breakdown

Each wacli connector machine runs as a `shared-cpu-1x` with 256MB RAM.

| Scenario | Machines | Uptime/mo | Cost/mo |
|----------|----------|-----------|---------|
| Pilot (5 users) | 5 | ~720 hrs | ~$15 |
| Growth (20) | 20 | ~720 hrs | ~$35 |
| Scale (50) | 50 | ~720 hrs | ~$50 - $80 |

> Machines auto-stop when user disconnects WhatsApp. Average uptime is lower than 720 hrs; cost estimates are worst-case (always-on).

## AI API Costs per 1,000 Agent Runs

| Model | Role | Input tokens | Output tokens | Cost/1K runs |
|-------|------|-------------|---------------|-------------|
| Claude Sonnet 4 | Orchestrator | ~2,000 | ~500 | ~$9.00 |
| Claude Sonnet 4 | Specialist | ~3,000 | ~1,000 | ~$16.00 |
| Claude Haiku 3.5 | Extraction | ~2,000 | ~500 | ~$1.50 |
| text-embedding-3-small | Embeddings | ~500 | -- | ~$0.01 |
| **TOTAL per 1K runs** | | | | **~$26.50** |

### Per-User AI Cost Estimate

```
  Estimated runs per user per month:  50 - 100
  Cost per run:                       ~$0.0265
  AI cost per user per month:         $1.33 - $2.65

  Breakdown of a typical run:
  +------------------------------------------------------+
  |  1. Orchestrator call (planning)         ~$0.009      |
  |  2. Specialist call (action proposal)   ~$0.016      |
  |  3. Extraction call (memory update)     ~$0.0015     |
  |  4. Embedding call (vector indexing)    ~$0.00001    |
  |                                         ----------   |
  |  Total per run                          ~$0.0265     |
  +------------------------------------------------------+
```

## Revenue Projections

All revenue assumes average plan price of $199/user/mo (Founder tier).

| Milestone | Users | MRR | Infra | AI Cost | Margin |
|-----------|------:|----:|------:|--------:|-------:|
| Pilot | 5 | $995 | $120 | $13 | 87% |
| Growth | 20 | $3,980 | $200 | $53 | 94% |
| Scale | 50 | $9,950 | $400 | $133 | 95% |
| Blended 100 | 100 | $24,900* | $700 | $265 | 96% |

> *Blended assumes 60% Founder ($199), 30% Dreamer ($399), 10% Custom (~$500 avg) = (60 x $199) + (30 x $399) + (10 x $500) = $11,940 + $11,970 + $5,000 = $28,910. Adjusted MRR at 100 users: ~$28,910.*

### Stripe Transaction Fees

| Users | MRR | Stripe fee | Net after Stripe |
|------:|----:|-----------|-----------------|
| 5 | $995 | $29 + $1.50 | $965 |
| 20 | $3,980 | $115 + $6.00 | $3,859 |
| 50 | $9,950 | $289 + $15.00 | $9,646 |

> Fee = (2.9% x MRR) + ($0.30 x users)

## Third-Party API Costs

### Google Workspace APIs

| API | Free quota | Ecqqo usage estimate |
|-----|-----------|-------------------|
| Google Calendar API | 1M queries/day | ~500/user/day = well within |
| Gmail API | 1B quota units/day | ~200/user/day = well within |
| **Estimated cost** | **$0/mo** | Google APIs are free at this scale. Paid tier starts at enterprise volumes. |

### Meta Cloud API (WhatsApp Business)

| Feature | Pricing | Ecqqo usage |
|---------|---------|-----------|
| Receiving messages | Free | All inbound via webhook |
| Business-initiated msgs | $0.005 - $0.08 per conversation | Approval notifications, reminders, digests |
| **Estimated cost at pilot** | **$5 - $20/mo** | ~100-400 outbound conversations/mo |

## Total Cost Summary by Stage

| Stage | Infra | AI | Stripe | Meta WA | Google | TOTAL |
|-------|------:|---:|-------:|--------:|-------:|------:|
| Pilot (5) | $120 | $13 | $31 | $10 | $0 | **$174** |
| Growth (20) | $200 | $53 | $121 | $30 | $0 | **$404** |
| Scale (50) | $400 | $133 | $304 | $60 | $0 | **$897** |

## Cost Optimization Strategies

1. **Fly.io machine auto-stop.** Connector machines should stop when the user disconnects WhatsApp or goes idle for >1 hour. This can reduce Fly.io costs by 40-60%.

2. **Model routing by task complexity.** Use Haiku for simple extraction/classification tasks and reserve Sonnet for orchestration and specialist reasoning. This is already reflected in the cost model above.

3. **Prompt caching.** Anthropic's prompt caching reduces cost for repeated system prompts. With a stable orchestrator prompt, caching could cut orchestrator input costs by ~80%.

4. **Batch embeddings.** Group memory embedding updates into batches rather than running one embedding call per fact. Marginal savings but reduces API call overhead.

5. **Convex function call optimization.** Convex Pro includes 1M function calls/mo. Monitor usage and optimize hot paths (sync polling, dashboard queries) to stay within the included allocation.

6. **Deferred capabilities reduce AI cost.** If meeting briefs (G8) and email digests (G6) are deferred post-pilot, per-user AI cost drops to ~$0.80-1.60/mo (orchestrator + calendar only).
