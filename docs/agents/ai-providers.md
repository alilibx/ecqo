# AI Providers (Vercel AI SDK)

This document covers Ecqqo's AI provider strategy: why the Vercel AI SDK was chosen, how models are selected for different tasks, failover behavior, cost projections, and configuration.

## Why Vercel AI SDK

The Vercel AI SDK provides a unified TypeScript interface for interacting with language models across multiple providers. For Ecqqo, this is the foundation of the Intelligence Plane.

### Key Benefits

<div class="sdk-comparison">
<table>
  <thead>
    <tr>
      <th>Aspect</th>
      <th class="col-without">Without Vercel AI SDK</th>
      <th class="col-with">With Vercel AI SDK</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Interface</strong></td>
      <td>Separate SDK per provider — OpenAI SDK, Anthropic SDK, Groq SDK</td>
      <td>Single unified SDK — <code>generateText()</code>, <code>streamText()</code>, <code>generateObject()</code></td>
    </tr>
    <tr>
      <td><strong>Tool calling</strong></td>
      <td>Different format per provider, custom adapters needed</td>
      <td>Unified tool definitions, one format everywhere</td>
    </tr>
    <tr>
      <td><strong>Streaming</strong></td>
      <td>Different protocols (SSE vs chunks vs websockets)</td>
      <td>Unified streaming interface across all providers</td>
    </tr>
    <tr>
      <td><strong>Error handling</strong></td>
      <td>Different error shapes, status codes, retry logic per provider</td>
      <td>Unified error handling and retry semantics</td>
    </tr>
    <tr>
      <td><strong>Switch provider</strong></td>
      <td>Rewrite integration code for new SDK</td>
      <td>Change <strong>one line</strong> — no code rewrite</td>
    </tr>
    <tr class="result-row">
      <td><strong>Result</strong></td>
      <td class="result-bad">3x code, 3x bugs</td>
      <td class="result-good">1x code, easy swap</td>
    </tr>
  </tbody>
</table>
</div>

<style>
.sdk-comparison { margin: 20px 0; overflow-x: auto; }
.sdk-comparison table { width: 100%; border-collapse: collapse; font-size: 14px; }
.sdk-comparison th, .sdk-comparison td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e8e0d0; }
.sdk-comparison thead th { font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
.sdk-comparison .col-without { background: #fff0ec; color: #b33a1f; }
.sdk-comparison .col-with { background: #e8f5f2; color: #094f44; }
.sdk-comparison tbody td:first-child { font-weight: 600; white-space: nowrap; color: #3d362d; }
.sdk-comparison .result-row td { border-bottom: none; font-weight: 700; font-size: 15px; }
.sdk-comparison .result-bad { color: #e04b2c; }
.sdk-comparison .result-good { color: #0d7a6a; }
.dark .sdk-comparison th, .dark .sdk-comparison td { border-color: #3a342a; }
.dark .sdk-comparison .col-without { background: rgba(224,75,44,0.1); color: #ff8a65; }
.dark .sdk-comparison .col-with { background: rgba(13,122,106,0.1); color: #1aad96; }
.dark .sdk-comparison tbody td:first-child { color: #e8e2d8; }
.dark .sdk-comparison .result-bad { color: #ff8a65; }
.dark .sdk-comparison .result-good { color: #1aad96; }
</style>

### Capabilities Used

| Capability | SDK Function | Use Case |
|---|---|---|
| Text generation | `generateText()` | Orchestrator reasoning, specialist responses |
| Streaming | `streamText()` | Real-time response generation (future dashboard feature) |
| Structured output | `generateObject()` | Intent classification, entity extraction, tool parameters |
| Tool calling | Built-in tool definitions | Calendar, email, reminder, memory operations |
| Embeddings | `embed()` | Memory vector generation for semantic search |
| Token counting | `usage` in response | Cost tracking per agent run |

### Supported Providers

<script setup>
const failoverConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ap-req", icon: "fa-message", title: "Incoming request", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "ap-primary", icon: "fa-cloud", title: "PRIMARY", subtitle: "Anthropic Sonnet", row: 1, col: 1, shape: "rect", color: "teal" },
    { id: "ap-r1", icon: "fa-circle-check", title: "Return result", row: 2, col: 0, shape: "rect", color: "green" },
    { id: "ap-fallback", icon: "fa-rotate", title: "FALLBACK", subtitle: "OpenAI GPT-4o", row: 2, col: 2, shape: "rect", color: "warm" },
    { id: "ap-r2", icon: "fa-circle-check", title: "Return result", row: 3, col: 1, shape: "rect", color: "green" },
    { id: "ap-budget", icon: "fa-rotate", title: "BUDGET", subtitle: "Groq Llama 3.3", row: 3, col: 3, shape: "rect", color: "warm" },
    { id: "ap-r3", icon: "fa-triangle-exclamation", title: "Return (degraded)", row: 4, col: 2, shape: "rect", color: "yellow" },
    { id: "ap-circuit", icon: "fa-circle-xmark", title: "CIRCUIT OPEN", subtitle: "Queue, retry 5m, notify operator", row: 4, col: 4, shape: "rect", color: "red" },
  ],
  edges: [
    { from: "ap-req", to: "ap-primary" },
    { from: "ap-primary", to: "ap-r1", label: "Success" },
    { from: "ap-primary", to: "ap-fallback", label: "Fail (timeout/5xx)", dashed: true },
    { from: "ap-fallback", to: "ap-r2", label: "Success" },
    { from: "ap-fallback", to: "ap-budget", label: "Failure", dashed: true },
    { from: "ap-budget", to: "ap-r3", label: "Success" },
    { from: "ap-budget", to: "ap-circuit", label: "Failure", dashed: true },
  ],
  groups: [],
}

const providersConfig = {
  layers: [
    {
      id: "prov-sdk",
      title: "Vercel AI SDK",
      subtitle: "Unified Interface",
      icon: "fa-code",
      color: "teal",
      nodes: [
        { id: "pr-sdk", icon: "fa-code", title: "Vercel AI SDK", subtitle: "generateText · streamText" },
      ],
    },
    {
      id: "prov-primary",
      title: "Primary Providers",
      subtitle: "@ai-sdk/* Packages",
      icon: "fa-brain",
      color: "warm",
      nodes: [
        { id: "pr-oai", icon: "si:openai", title: "OpenAI", subtitle: "GPT-4o · 4o-mini · o1" },
        { id: "pr-ant", icon: "si:anthropic", title: "Anthropic", subtitle: "Opus 4 · Sonnet · Haiku" },
        { id: "pr-goo", icon: "si:google", title: "Google", subtitle: "Gemini 2.5 · Flash" },
      ],
    },
    {
      id: "prov-extended",
      title: "Extended Providers",
      subtitle: "Fast Inference · Multi-model",
      icon: "fa-bolt",
      color: "dark",
      nodes: [
        { id: "pr-groq", icon: "fa-bolt", title: "Groq", subtitle: "Llama 3.3 · Mixtral" },
        { id: "pr-azure", icon: "fa-cloud", title: "Azure OpenAI", subtitle: "GPT-4o (Azure-hosted)" },
        { id: "pr-or", icon: "fa-plug", title: "OpenRouter", subtitle: "Any Model · Single Key" },
      ],
    },
  ],
  connections: [
    { from: "pr-sdk", to: "pr-oai" },
    { from: "pr-sdk", to: "pr-ant" },
    { from: "pr-sdk", to: "pr-goo" },
    { from: "pr-sdk", to: "pr-groq" },
    { from: "pr-sdk", to: "pr-azure" },
    { from: "pr-sdk", to: "pr-or" },
  ],
}
</script>

<ArchDiagram :config="providersConfig" />

### Works in Convex Actions

The Vercel AI SDK is TypeScript-native and runs in Convex actions (serverless functions with external network access). No special adapters or wrappers are needed:

```typescript
import { action } from "./_generated/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const runOrchestrator = action({
  args: { messageId: v.id("inboundMessages") },
  handler: async (ctx, args) => {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: "You are Ecqqo, a WhatsApp-native executive assistant...",
      messages: [...assembledContext],
      tools: { calendar_read, calendar_write, memory_query },
    });
    // Process result, create agentRun, execute tool calls...
  },
});
```

---

## Recommended Model Strategy

Different components of the agent runtime have different requirements for quality, speed, and cost. The strategy assigns the best model for each task.

### Model Assignment

| Task | Model | Priority | Notes |
|---|---|---|---|
| **Orchestrator** (intent detection, routing, planning) | Claude Sonnet 4 or GPT-4o | Quality + Tools | Best reasoning for complex multi-step routing decisions |
| **Specialist Agents** (scheduler, calendar, email, reminder, travel, brief) | Claude Sonnet 4 | Balance quality/cost/speed | Strong tool calling, good at structured output, bilingual |
| **Extraction / Summarization** (language detection, entity extraction, email summaries, memory extraction) | Claude Haiku or GPT-4o-mini | Speed + Cost | Fast, cheap, good enough for structured extraction tasks |
| **Embeddings** (memory vectors) | text-embedding-3-small (OpenAI) or Cohere embed-v3 | Cost | 1536 dimensions |

### Why These Models

**Claude Sonnet 4 for orchestration and specialists:**
- Best-in-class tool calling accuracy
- Strong multi-step reasoning for complex scheduling requests
- Excellent bilingual performance (English and Arabic)
- Good balance of quality and cost ($3/$15 per 1M input/output tokens)

**Claude Haiku / GPT-4o-mini for extraction:**
- 10-20x cheaper than Sonnet/GPT-4o
- Sufficient quality for structured extraction (language detection, entity parsing)
- Sub-second response times for lightweight tasks
- High throughput for batch processing

**text-embedding-3-small for embeddings:**
- Industry standard for vector search
- 1536 dimensions (good balance of quality and storage)
- $0.02 per 1M tokens (negligible cost)
- Native Convex vector search support

---

## Provider Failover Strategy

The system implements a tiered failover strategy to maintain availability when a provider is down or degraded.

<ArchDiagram :config="failoverConfig" />

### Failover Rules

| Condition | Action |
|---|---|
| Provider returns 5xx | Retry once, then failover to next provider |
| Request timeout (>30s) | Failover immediately |
| Provider rate limited (429) | Failover immediately, backoff primary for 60s |
| All providers down | Queue the message, schedule retry in 5 minutes, notify operator |
| Degraded mode (Groq) | Add disclaimer to response: "Using simplified processing" |

### Implementation

```typescript
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOpenAI } from "@ai-sdk/openai";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const providers = [
  { model: anthropic("claude-sonnet-4-20250514"), name: "anthropic" },
  { model: openai("gpt-4o"),                      name: "openai"    },
  { model: groq("llama-3.3-70b-versatile"),        name: "groq"      },
];

async function generateWithFailover(params: GenerateParams) {
  for (const provider of providers) {
    try {
      const result = await generateText({
        model: provider.model,
        ...params,
      });
      return { result, provider: provider.name };
    } catch (error) {
      console.error(`${provider.name} failed:`, error);
      continue;
    }
  }
  throw new Error("All providers failed");
}
```

---

## Cost Estimation

### Per-Agent-Run Token Usage (Average)

| Component | Input Tokens | Output Tokens |
|-----------|-------------|---------------|
| System prompt | ~800 | - |
| Context window | ~2,500 | - |
| User message | ~50 | - |
| Orchestrator response | - | ~300 |
| Specialist call | ~1,500 (ctx) | ~400 |
| Tool calls (avg 2) | ~200 | ~200 |
| Memory extraction | ~500 | ~100 |
| **TOTAL PER RUN** | **~5,550** | **~1,000** |

### Cost Per 1,000 Agent Runs

| Model | Input Cost | Output Cost | Total per 1K Runs |
|---|---|---|---|
| **Claude Sonnet 4** (primary) | 5.55M tokens x $3/1M = $16.65 | 1M tokens x $15/1M = $15.00 | **$31.65** |
| **GPT-4o** (fallback) | 5.55M tokens x $2.50/1M = $13.88 | 1M tokens x $10/1M = $10.00 | **$23.88** |
| **GPT-4o-mini** (extraction) | 0.5M tokens x $0.15/1M = $0.08 | 0.1M tokens x $0.60/1M = $0.06 | **$0.14** |
| **Claude Haiku** (extraction) | 0.5M tokens x $0.25/1M = $0.13 | 0.1M tokens x $1.25/1M = $0.13 | **$0.25** |
| **Embeddings** (text-embedding-3-small) | 1M tokens x $0.02/1M = $0.02 | - | **$0.02** |

### Monthly Cost Projection (Pilot Phase)

**Assumptions:** 5 pilot users, ~20 agent runs per user per day, 30 days per month = 3,000 total runs/month.

> [!tip] Monthly AI Cost Estimate (Pilot)
>
> | Component | Calculation | Cost |
> |---|---|---|
> | Primary (Sonnet) | 3K runs x $31.65/1K | $94.95 |
> | Extraction (Haiku) | 3K runs x $0.25/1K | $0.75 |
> | Embeddings | 3K runs x $0.02/1K | $0.06 |
> | **TOTAL** | | **~$96/month** |
>
> With 10% failover to GPT-4o: **~$94/month** (GPT-4o is cheaper per run).

---

## Environment Variables

Each AI provider requires its own API key, stored as Convex environment variables.

| Variable | Provider | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic (Claude Sonnet, Haiku) | Yes (primary) |
| `OPENAI_API_KEY` | OpenAI (GPT-4o, GPT-4o-mini, embeddings) | Yes (fallback + embeddings) |
| `GROQ_API_KEY` | Groq (Llama 3.3) | Optional (budget fallback) |
| `OPENROUTER_API_KEY` | OpenRouter (multi-provider proxy) | Optional (alternative routing) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI | Optional (enterprise compliance) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI | Required if using Azure |
| `AZURE_OPENAI_DEPLOYMENT` | Azure OpenAI | Required if using Azure |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google (Gemini) | Optional |

### Provider Setup

```typescript
// anthropic (primary)
import { anthropic } from "@ai-sdk/anthropic";
// Uses ANTHROPIC_API_KEY env var automatically

// openai (fallback + embeddings)
import { openai } from "@ai-sdk/openai";
// Uses OPENAI_API_KEY env var automatically

// groq (budget fallback)
import { createOpenAI } from "@ai-sdk/openai";
const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

// openrouter (alternative)
import { createOpenAI } from "@ai-sdk/openai";
const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
// Usage: openrouter("anthropic/claude-sonnet-4-20250514")

// azure openai (enterprise)
import { createAzure } from "@ai-sdk/azure";
const azure = createAzure({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  resourceName: process.env.AZURE_OPENAI_ENDPOINT,
});
// Usage: azure("my-gpt4o-deployment")
```

---

## Rate Limiting Considerations

AI provider rate limits affect agent throughput. The system must respect these limits to avoid 429 errors and maintain failover readiness.

### Provider Rate Limits (Typical Tier 2+)

| Provider | RPM | TPM | Daily Limit |
|----------|-----|-----|-------------|
| Anthropic (Tier 2) | 1,000 | 400K tokens | No hard limit |
| OpenAI (Tier 2) | 5,000 | 800K tokens | No hard limit |
| Groq (Free) | 30 | 15K tokens | 14.4K req/day |
| Groq (Paid) | 100 | 60K tokens | No hard limit |

RPM = Requests Per Minute, TPM = Tokens Per Minute

### Ecqqo Rate Limiting Strategy

| Strategy | Implementation |
|---|---|
| **Request queuing** | Agent runs are queued in Convex and processed sequentially per principal. No concurrent runs for the same user. |
| **Token budgeting** | Each agent run has a max token budget (8K input, 2K output). Requests exceeding the budget are truncated. |
| **Provider monitoring** | Track `remaining` headers from provider responses. Proactively failover when approaching limits. |
| **Backoff** | Exponential backoff with jitter on 429 responses. Initial delay 1s, max delay 60s. |
| **Groq conservation** | Groq is only used as a last-resort fallback. Never used for primary processing due to low rate limits on free tier. |
| **Batch embedding** | Memory embeddings are batched (up to 100 texts per API call) to minimize request count. |

### Monitoring

Agent run records track which provider was used and token consumption:

```typescript
// Stored on each agentRun
{
  provider: "anthropic",          // which provider handled this run
  model: "claude-sonnet-4-20250514",  // specific model
  inputTokens: 5420,             // tokens consumed
  outputTokens: 890,
  latencyMs: 2340,               // end-to-end LLM call time
  failoverUsed: false            // whether primary failed
}
```

This data powers the cost dashboard and helps identify when provider upgrades or plan changes are needed.
