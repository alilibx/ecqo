# Memory Pipeline

## Overview

Ecqqo's memory system gives the agent persistent, contextual awareness across conversations. It is organized into four tiers, each serving a distinct role in how the agent remembers, retrieves, and reasons about user context.

<script setup>
// Flow 1: Memory Lifecycle
const memoryLifecycleConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "mp1-m", icon: "fa-message", title: "Inbound message", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "mp1-mi", icon: "fa-database", title: "Ingest + store raw", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "mp1-st", icon: "fa-clock", title: "Short-term (24h)", row: 0, col: 2, shape: "rect", color: "teal" },
    { id: "mp1-rc", icon: "fa-circle-check", title: "Run completes", row: 1, col: 0, shape: "rect", color: "warm" },
    { id: "mp1-sum", icon: "fa-brain", title: "Summarizer (LLM)", subtitle: "request, outcome, entities", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "mp1-ep", icon: "fa-box-archive", title: "Episodic (90d)", row: 1, col: 2, shape: "rect", color: "warm" },
    { id: "mp1-fe", icon: "fa-brain", title: "Fact extractor (LLM)", row: 2, col: 1, shape: "rect", color: "warm" },
    { id: "mp1-sm", icon: "fa-vector-square", title: "Semantic memory", subtitle: "new fact + embedding", row: 2, col: 0, shape: "rect", color: "warm" },
    { id: "mp1-uf", icon: "fa-arrows-rotate", title: "Update existing facts", subtitle: "merge / supersede", row: 2, col: 2, shape: "rect", color: "warm" },
    { id: "mp1-pin", icon: "fa-user", title: "User pins", subtitle: "dashboard or WhatsApp", row: 3, col: 0, shape: "rect", color: "blue" },
    { id: "mp1-pm", icon: "fa-thumbtack", title: "Pinned memory (no TTL)", row: 3, col: 1, shape: "rect", color: "blue" },
  ],
  edges: [
    { from: "mp1-m", to: "mp1-mi" },
    { from: "mp1-mi", to: "mp1-st" },
    { from: "mp1-rc", to: "mp1-sum" },
    { from: "mp1-sum", to: "mp1-ep" },
    { from: "mp1-ep", to: "mp1-fe", label: "async" },
    { from: "mp1-fe", to: "mp1-sm" },
    { from: "mp1-fe", to: "mp1-uf" },
    { from: "mp1-pin", to: "mp1-pm" },
  ],
  groups: [
    { label: "Inbound Message Path", color: "teal", nodes: ["mp1-m", "mp1-mi", "mp1-st"] },
    { label: "Agent Run Path", color: "warm", nodes: ["mp1-rc", "mp1-sum", "mp1-ep", "mp1-fe", "mp1-sm", "mp1-uf"] },
    { label: "User Pin Path", color: "blue", nodes: ["mp1-pin", "mp1-pm"] },
  ],
}

// Flow 2: Retrieval Composition
const retrievalCompositionConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "mp2-input", icon: "fa-message", title: "User msg + conv context", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "mp2-embed", icon: "fa-vector-square", title: "Generate query embedding", row: 1, col: 1, shape: "rect", color: "teal" },
    { id: "mp2-t4", icon: "fa-thumbtack", title: "PINNED", subtitle: "include all, no filter", row: 2, col: 0, shape: "rect", color: "blue" },
    { id: "mp2-t1", icon: "fa-clock", title: "SHORT-TERM", subtitle: "last N msgs (default 20)", row: 2, col: 1, shape: "rect", color: "teal" },
    { id: "mp2-t3", icon: "fa-vector-square", title: "SEMANTIC", subtitle: "vector top-k (k=10, >0.75)", row: 2, col: 2, shape: "rect", color: "dark" },
    { id: "mp2-t2", icon: "fa-box-archive", title: "EPISODIC", subtitle: "keyword + recency hybrid", row: 2, col: 3, shape: "rect", color: "warm" },
    { id: "mp2-asm", icon: "fa-code", title: "Context Assembler", subtitle: "~4k token budget, truncate: episodic first", row: 3, col: 1, shape: "rect", color: "dark" },
    { id: "mp2-bundle", icon: "fa-cube", title: "Assembled context bundle", row: 4, col: 1, shape: "rect", color: "teal" },
  ],
  edges: [
    { from: "mp2-input", to: "mp2-embed" },
    { from: "mp2-embed", to: "mp2-t4" },
    { from: "mp2-embed", to: "mp2-t1" },
    { from: "mp2-embed", to: "mp2-t3" },
    { from: "mp2-embed", to: "mp2-t2" },
    { from: "mp2-t4", to: "mp2-asm" },
    { from: "mp2-t1", to: "mp2-asm" },
    { from: "mp2-t3", to: "mp2-asm" },
    { from: "mp2-t2", to: "mp2-asm" },
    { from: "mp2-asm", to: "mp2-bundle" },
  ],
}

// Flow 3: Query Flow
const queryFlowConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "mp3-q", icon: "fa-magnifying-glass", title: "User query", subtitle: "Next meeting with Khalid?", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "mp3-e", icon: "fa-vector-square", title: "Embed via ada-002", subtitle: "1536-dim vector", row: 1, col: 1, shape: "rect", color: "dark" },
    { id: "mp3-db", icon: "fa-database", title: "Convex vector search", subtitle: "top 10, confidence > 0.5", row: 2, col: 1, shape: "rect", color: "dark" },
    { id: "mp3-r", icon: "fa-circle-check", title: "Results by cosine sim", subtitle: "morning 0.92, sync 0.89, DIFC 0.81", row: 3, col: 1, shape: "rect", color: "teal" },
  ],
  edges: [
    { from: "mp3-q", to: "mp3-e" },
    { from: "mp3-e", to: "mp3-db" },
    { from: "mp3-db", to: "mp3-r" },
  ],
}

// Flow 4: Language Pipeline
const languagePipelineConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "mp4-a", icon: "fa-message", title: "Input text", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "mp4-b", icon: "fa-language", title: "Lang detect", subtitle: "char-range + fasttext", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "mp4-n", icon: "fa-filter", title: "Normalize", subtitle: "lowercase, trim", row: 2, col: 1, shape: "rect", color: "dark" },
    { id: "mp4-s", icon: "fa-database", title: "Store", subtitle: "content + contentAr, embed from EN, lang tag", row: 3, col: 1, shape: "rect", color: "teal" },
  ],
  edges: [
    { from: "mp4-a", to: "mp4-b" },
    { from: "mp4-b", to: "mp4-n", label: "en" },
    { from: "mp4-b", to: "mp4-n", label: "ar" },
    { from: "mp4-b", to: "mp4-n", label: "mixed" },
    { from: "mp4-n", to: "mp4-s" },
  ],
}

// Flow 5: Cross-Language Retrieval
const crossLangRetrievalConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "mp5-q", icon: "fa-message", title: "Arabic query", subtitle: "متى اجتماعي القادم مع خالد؟", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "mp5-t", icon: "fa-language", title: "Translate to EN", subtitle: "for embedding", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "mp5-e", icon: "fa-vector-square", title: "Embed EN version", subtitle: "vector search on EN space", row: 2, col: 1, shape: "rect", color: "dark" },
    { id: "mp5-r", icon: "fa-magnifying-glass", title: "Retrieve by similarity", subtitle: "results may be EN or AR", row: 3, col: 1, shape: "rect", color: "dark" },
    { id: "mp5-l", icon: "fa-language", title: "Return in user's lang", subtitle: "contentAr or translate", row: 4, col: 1, shape: "rect", color: "teal" },
  ],
  edges: [
    { from: "mp5-q", to: "mp5-t" },
    { from: "mp5-t", to: "mp5-e" },
    { from: "mp5-e", to: "mp5-r" },
    { from: "mp5-r", to: "mp5-l" },
  ],
}

// Flow 6: TTL Extension Logic
const ttlExtensionConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "mp6-a", icon: "fa-question", title: "Fact referenced?", subtitle: "in new agent run", row: 0, col: 1, shape: "diamond", color: "warm" },
    { id: "mp6-b", icon: "fa-arrows-rotate", title: "Reset TTL to full", subtitle: "relevance += 0.1 (cap 1.0)", row: 1, col: 0, shape: "rect", color: "teal" },
    { id: "mp6-c", icon: "fa-clock", title: "TTL keeps counting", subtitle: "relevance unchanged", row: 1, col: 2, shape: "rect", color: "dark" },
  ],
  edges: [
    { from: "mp6-a", to: "mp6-b", label: "YES" },
    { from: "mp6-a", to: "mp6-c", label: "NO" },
  ],
}

// Flow 7: Fact Supersession
const factSupersessionConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "mp7-old", icon: "fa-circle-xmark", title: "Old fact", subtitle: "assistant is Sara · conf 0.7", row: 0, col: 0, shape: "rect", color: "red" },
    { id: "mp7-new", icon: "fa-circle-check", title: "New fact", subtitle: "assistant is Noor · conf 0.9", row: 0, col: 2, shape: "rect", color: "teal" },
    { id: "mp7-r1", icon: "fa-circle-xmark", title: "Old superseded", subtitle: "excluded from retrieval", row: 1, col: 0, shape: "rect", color: "red" },
    { id: "mp7-r2", icon: "fa-circle-check", title: "New active", subtitle: "returned in results", row: 1, col: 2, shape: "rect", color: "teal" },
  ],
  edges: [
    { from: "mp7-old", to: "mp7-new" },
    { from: "mp7-new", to: "mp7-r1" },
    { from: "mp7-new", to: "mp7-r2" },
  ],
}

const memoryTiersConfig = {
  layers: [
    {
      id: "tier1",
      title: "Tier 1: Short-term",
      subtitle: "TTL 24h · Recency-based Retrieval",
      icon: "fa-clock",
      color: "teal",
      nodes: [
        { id: "mt-t1", icon: "fa-clock", title: "Recent Context", subtitle: "Messages · In-flight Data" },
      ],
    },
    {
      id: "tier2",
      title: "Tier 2: Episodic",
      subtitle: "TTL 90d · Relevance + Recency",
      icon: "fa-box-archive",
      color: "warm",
      nodes: [
        { id: "mt-t2", icon: "fa-box-archive", title: "Run Outcomes", subtitle: "Summarized Decisions" },
      ],
    },
    {
      id: "tier3",
      title: "Tier 3: Semantic",
      subtitle: "TTL 180d · Vector Similarity",
      icon: "fa-brain",
      color: "dark",
      nodes: [
        { id: "mt-t3", icon: "fa-magnifying-glass", title: "Facts & Relations", subtitle: "Embeddings · Preferences" },
      ],
    },
    {
      id: "tier4",
      title: "Tier 4: Pinned",
      subtitle: "No TTL · Always Included",
      icon: "fa-thumbtack",
      color: "blue",
      nodes: [
        { id: "mt-t4", icon: "fa-thumbtack", title: "Pinned Facts", subtitle: "User-managed · Permanent" },
      ],
    },
  ],
  connections: [
    { from: "mt-t1", to: "mt-t2", label: "promote" },
    { from: "mt-t2", to: "mt-t3", label: "extract" },
  ],
}
</script>

<ArchDiagram :config="memoryTiersConfig" />

## Memory Lifecycle

Memory flows through the system in a pipeline, with each tier fed by specific triggers:

<ArchDiagram :config="memoryLifecycleConfig" />

## Retrieval Composition

When the agent needs context for a new run, it assembles a memory bundle from all four tiers:

<ArchDiagram :config="retrievalCompositionConfig" />

## Convex Vector Search Setup

Semantic memory uses Convex's built-in vector search for similarity-based retrieval.

### Schema

**`memoryFacts` table:**

| Field | Type | Description |
|---|---|---|
| `_id` | `Id` | Convex document ID |
| `userId` | `Id<"users">` | Owner of the fact |
| `workspaceId` | `Id<"workspaces">` | Workspace scope |
| `content` | `string` | Fact text (normalized) |
| `contentAr` | `string?` | Arabic translation |
| `embedding` | `float64[1536]` | OpenAI ada-002 vector |
| `source` | `string` | `"episodic"` \| `"message"` \| `"user_input"` |
| `confidence` | `float64` | 0.0 - 1.0 |
| `language` | `string` | `"en"` \| `"ar"` \| `"mixed"` |
| `entityRefs` | `string[]` | Referenced entity IDs |
| `createdAt` | `number` | Timestamp |
| `expiresAt` | `number` | TTL expiry timestamp |
| `supersededBy` | `Id?` | Newer fact that replaces this one |

**Indexes:**
- `by_user_workspace`: `[userId, workspaceId]`
- `by_expiry`: `[expiresAt]`
- `vector_index`: `embedding` (dimensions: 1536, filter: `userId`)

### Query Flow

<ArchDiagram :config="queryFlowConfig" />

## EN/AR Bilingual Handling

Ecqqo serves a bilingual user base (English and Arabic). The memory system handles this through language detection, dual storage, and cross-language retrieval.

### Language Pipeline

<ArchDiagram :config="languagePipelineConfig" />

### Cross-Language Retrieval

When a user queries in Arabic but relevant facts were stored in English (or vice versa):

<ArchDiagram :config="crossLangRetrievalConfig" />

## TTL Policies Per Tier

| Tier | TTL | Cleanup Strategy | Can Extend? |
|---|---|---|---|
| **Short-term** | 24 hours | Convex scheduled job runs hourly, deletes expired entries | No (auto-expire only) |
| **Episodic** | 90 days | Convex scheduled job runs daily; entries with low relevance score may expire sooner (30 days if relevance < 0.3) | Yes (if re-referenced in a new run, TTL resets) |
| **Semantic** | 180 days | Convex scheduled job runs daily; only deletes if `supersededBy != null` OR `confidence < 0.3` AND expired | Yes (if re-confirmed by new evidence, TTL resets) |
| **Pinned** | Never | Only removed by explicit user action (unpin from dashboard or WhatsApp command) | N/A (permanent until unpinned) |

### TTL Extension Logic

<ArchDiagram :config="ttlExtensionConfig" />

## Memory Quality and Confidence Scoring

Every fact in semantic memory carries a **confidence score** (0.0 to 1.0) that reflects the system's certainty about the fact's accuracy and relevance.

### Confidence Assignment

| Source | Initial Confidence | Rationale |
|---|---|---|
| User-pinned fact | **1.0** | Explicit user intent, highest trust |
| Extracted from user's own message (e.g., "I prefer morning meetings") | **0.9** | Direct user statement |
| Extracted from contact's message (e.g., "Khalid said he's available Sundays") | **0.7** | Second-hand information |
| Inferred from pattern (e.g., "User typically responds within 5 minutes") | **0.5** | Statistical inference, may not hold |
| Extracted from group chat context | **0.4** | Noisy source, lower signal |

### Confidence Decay and Reinforcement

<div class="confidence-chart-wrap">
<div class="confidence-chart">
  <div class="cc-y-axis">
    <span>1.0</span><span>0.9</span><span>0.7</span><span>0.5</span><span>0.3</span><span>0.0</span>
  </div>
  <div class="cc-plot">
    <div class="cc-threshold"><span>threshold (0.5)</span></div>
    <svg viewBox="0 0 600 300" preserveAspectRatio="none" class="cc-svg">
      <!-- Main decay line -->
      <polyline points="0,0 20,0 40,30 60,60 80,90 100,90 120,120 140,150 160,150 180,120 200,90 220,60 240,30 260,60 280,90 300,60 320,90 340,120 360,150 380,180 400,210 420,240 440,240 460,270 480,300 520,300 560,300 600,300" fill="none" stroke="#0d7a6a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="cc-line"/>
      <!-- Reinforcement spike annotation -->
      <circle cx="220" cy="60" r="5" fill="#0d7a6a" class="cc-dot"/>
      <text x="228" y="46" class="cc-annotation">re-confirmed</text>
      <!-- Decay below threshold -->
      <circle cx="460" cy="270" r="5" fill="#e04b2c" class="cc-dot-warn"/>
      <text x="468" y="264" class="cc-annotation cc-annotation-warn">decay below threshold</text>
    </svg>
    <div class="cc-x-axis">
      <span>0</span><span>30</span><span>60</span><span>90</span><span>120</span><span>150</span><span>180 days</span>
    </div>
  </div>
</div>
</div>

<style>
.confidence-chart-wrap { margin: 24px 0; }
.confidence-chart {
  display: flex;
  gap: 8px;
  font-family: 'DM Sans', 'Inter', sans-serif;
  font-size: 12px;
  color: #3d362d;
}
.cc-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 4px 0 28px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 11px;
  color: #8a7e6d;
  min-width: 28px;
  text-align: right;
}
.cc-plot {
  flex: 1;
  position: relative;
  border-left: 2px solid #e8e0d0;
  border-bottom: 2px solid #e8e0d0;
  padding: 4px 0 0;
  min-height: 200px;
}
.cc-svg {
  width: 100%;
  height: 200px;
  display: block;
}
.cc-line { vector-effect: non-scaling-stroke; }
.cc-dot { vector-effect: non-scaling-stroke; }
.cc-dot-warn { vector-effect: non-scaling-stroke; }
.cc-annotation {
  font-size: 11px;
  fill: #094f44;
  font-family: 'DM Sans', sans-serif;
  font-weight: 500;
}
.cc-annotation-warn { fill: #e04b2c; }
.cc-threshold {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  border-top: 2px dashed #d4a017;
  opacity: 0.6;
}
.cc-threshold span {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 10px;
  color: #d4a017;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.cc-x-axis {
  display: flex;
  justify-content: space-between;
  padding-top: 6px;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: #8a7e6d;
  font-weight: 500;
}
.dark .confidence-chart { color: #c5bdb0; }
.dark .cc-y-axis { color: #9a9189; }
.dark .cc-plot { border-color: #3a342a; }
.dark .cc-line { stroke: #1aad96; }
.dark .cc-dot { fill: #1aad96; }
.dark .cc-dot-warn { fill: #e04b2c; }
.dark .cc-annotation { fill: #a8e6cf; }
.dark .cc-annotation-warn { fill: #ff8a65; }
.dark .cc-threshold { border-color: #d4a017; }
.dark .cc-threshold span { color: #d4a017; }
.dark .cc-x-axis { color: #9a9189; }
</style>

Facts below the threshold (0.5):
- Excluded from retrieval results
- Eligible for early TTL expiry
- May be superseded by higher-confidence facts

### Fact Supersession

When a new fact contradicts an existing one, the older fact is superseded:

<ArchDiagram :config="factSupersessionConfig" />
