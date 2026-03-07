# Memory Pipeline

## Overview

Ecqqo's memory system gives the agent persistent, contextual awareness across conversations. It is organized into four tiers, each serving a distinct role in how the agent remembers, retrieves, and reasons about user context.

```mermaid
flowchart LR
    subgraph T1["Tier 1: SHORT-TERM"]
        T1D["Recent conversation<br/>messages and context<br/><br/>TTL: 24 hours<br/>Storage: Convex docs<br/>Retrieval: recency"]
    end

    subgraph T2["Tier 2: EPISODIC"]
        T2D["Summarized outcomes<br/>of past agent runs<br/><br/>TTL: 90 days<br/>Storage: Convex docs<br/>Retrieval: relevance + recency"]
    end

    subgraph T3["Tier 3: SEMANTIC"]
        T3D["Extracted facts,<br/>preferences, relationships<br/><br/>TTL: 180 days<br/>Storage: Convex + vector index<br/>Retrieval: vector similarity"]
    end

    subgraph T4["Tier 4: PINNED"]
        T4D["User-pinned durable<br/>facts and instructions<br/><br/>TTL: never expires<br/>Storage: Convex docs<br/>Retrieval: always included"]
    end
```

## Memory Lifecycle

Memory flows through the system in a pipeline, with each tier fed by specific triggers:

```mermaid
flowchart TD
    subgraph Path1["Inbound Message Path"]
        M["Inbound message<br/>(user or contact)"] --> MI["Message ingested<br/>(store raw with timestamp)"]
        MI --> ST["Short-term memory<br/>(24h TTL)"]
    end

    subgraph Path2["Agent Run Path"]
        RC["Agent run completes<br/>(action taken, result produced)"] --> SUM["Summarizer (LLM call)<br/>What was requested, what happened,<br/>outcome, entities involved"]
        SUM --> EP["Episodic memory<br/>(90d TTL)"]
        EP -- "Async extraction" --> FE["Fact extractor<br/>(LLM call)"]
        FE --> SM["Semantic memory<br/>(new fact + vector embed)"]
        FE --> UF["Update existing facts<br/>(merge / supersede)"]
    end

    subgraph Path3["User Pin Path"]
        PIN["User action in dashboard<br/>or WhatsApp command<br/>(e.g. Pin: always book morning flights)"] --> PM["Pinned memory<br/>(no TTL)"]
    end
```

## Retrieval Composition

When the agent needs context for a new run, it assembles a memory bundle from all four tiers:

```mermaid
flowchart TD
    INPUT["User message + conversation context"] --> EMBED["Generate query embedding<br/>(derive semantic query for vector search)"]

    EMBED --> T4["**Tier 4: PINNED**<br/>Strategy: include ALL<br/>Always returned, no filtering"]
    EMBED --> T1["**Tier 1: SHORT-TERM**<br/>Strategy: recency window<br/>Return last N messages (default 20)"]
    EMBED --> T3["**Tier 3: SEMANTIC**<br/>Strategy: vector similarity top-k<br/>(k=10, threshold > 0.75)"]
    EMBED --> T2["**Tier 2: EPISODIC**<br/>Strategy: relevance + recency<br/>Keyword + recency hybrid score"]

    T4 --> ASM["**Context Assembler**<br/>1. Pinned facts (highest priority)<br/>2. Short-term context (recent conversation)<br/>3. Semantic facts (relevant knowledge)<br/>4. Episodic summaries (past interactions)<br/><br/>Token budget: ~4000 tokens<br/>Overflow: truncate episodic first,<br/>then semantic, never pinned"]
    T1 --> ASM
    T3 --> ASM
    T2 --> ASM

    ASM --> BUNDLE["Assembled context bundle<br/>(ready for agent prompt injection)"]
```

## Convex Vector Search Setup

Semantic memory uses Convex's built-in vector search for similarity-based retrieval.

### Schema

```
  memoryFacts table
  ─────────────────

  ┌────────────────────────────────────────────────────────────┐
  │ Field              Type           Description              │
  │ ─────              ────           ───────────              │
  │ _id                Id             Convex document ID       │
  │ userId             Id<users>      Owner of the fact        │
  │ workspaceId        Id<workspaces> Workspace scope          │
  │ content            string         Fact text (normalized)   │
  │ contentAr          string?        Arabic translation       │
  │ embedding          float64[1536]  OpenAI ada-002 vector    │
  │ source             string         "episodic" | "message"   │
  │                                   | "user_input"           │
  │ confidence         float64        0.0 - 1.0                │
  │ language           string         "en" | "ar" | "mixed"    │
  │ entityRefs         string[]       Referenced entity IDs    │
  │ createdAt          number         Timestamp                │
  │ expiresAt          number         TTL expiry timestamp     │
  │ supersededBy       Id?            Newer fact that replaces │
  │                                   this one                 │
  └────────────────────────────────────────────────────────────┘

  Indexes:
    - by_user_workspace: [userId, workspaceId]
    - by_expiry: [expiresAt]
    - vector_index: embedding (dimensions: 1536, filter: userId)
```

### Query Flow

```
  User message: "When is my next meeting with Khalid?"
       │
       v
  ┌──────────────┐
  │ Embed query  │     "next meeting with Khalid"
  │ (ada-002)    │──>  [0.023, -0.187, 0.445, ...]  (1536 dims)
  └──────┬───────┘
         │
         v
  ┌──────────────────────────────────────────────────────┐
  │ db.query("memoryFacts")                              │
  │   .withIndex("by_user_workspace",                    │
  │     q => q.eq("userId", userId)                      │
  │            .eq("workspaceId", workspaceId))           │
  │   .vectorSearch("embedding", queryVector, { top: 10 })│
  │   .filter(q => q.gt(q.field("confidence"), 0.5))     │
  │   .filter(q => q.eq(q.field("supersededBy"), null))   │
  └──────────────────────────────────────────────────────┘
         │
         v
  Results (ranked by cosine similarity):
  ┌──────────────────────────────────────────────────────┐
  │ 1. "Khalid Al-Fahad prefers morning meetings"  0.92 │
  │ 2. "Weekly sync with Khalid is on Sundays"     0.89 │
  │ 3. "Khalid's office is in DIFC Gate Village"   0.81 │
  │ 4. "Last meeting with Khalid discussed Q2..."  0.78 │
  └──────────────────────────────────────────────────────┘
```

## EN/AR Bilingual Handling

Ecqqo serves a bilingual user base (English and Arabic). The memory system handles this through language detection, dual storage, and cross-language retrieval.

### Language Pipeline

```mermaid
flowchart TD
    A["Input text"] --> B["Language detect<br/>(character-range heuristics + fasttext fallback)"]

    B -- English --> N["Normalize:<br/>lowercase, trim"]
    B -- Arabic --> N
    B -- "Mixed (code-switching)" --> N

    N --> S["Store:<br/>content: original language<br/>contentAr: Arabic version<br/>(translated if original was English)<br/>embedding: computed from English version<br/>(ada-002 performs best on English)<br/>language: en | ar | mixed"]
```

### Cross-Language Retrieval

When a user queries in Arabic but relevant facts were stored in English (or vice versa):

```mermaid
flowchart TD
    Q["Arabic query:<br/>متى اجتماعي القادم مع خالد؟"]
    T["Translate to English for embedding<br/>(When is my next meeting with Khalid?)"]
    E["Embed English version<br/>(standard vector search on English embedding space)"]
    R["Retrieve facts by similarity<br/>(results may be in English or Arabic)"]
    L["Return facts in user's preferred language<br/>(use contentAr if available,<br/>otherwise translate on-the-fly)"]

    Q --> T --> E --> R --> L
```

## TTL Policies Per Tier

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                       TTL Policy Summary                            │
  └──────────────────────────────────────────────────────────────────────┘

  Tier           TTL          Cleanup Strategy          Can Extend?
  ────           ───          ────────────────          ───────────

  Short-term     24 hours     Convex scheduled job      No
                              runs hourly, deletes      (auto-expire
                              expired entries           only)

  Episodic       90 days      Convex scheduled job      Yes
                              runs daily; entries       (if re-referenced
                              with low relevance        in a new run,
                              score may expire          TTL resets)
                              sooner (30 days if
                              relevance < 0.3)

  Semantic       180 days     Convex scheduled job      Yes
                              runs daily; only          (if re-confirmed
                              deletes if                by new evidence,
                              supersededBy != null      TTL resets)
                              OR confidence < 0.3
                              AND expired

  Pinned         Never        Only removed by           N/A
                              explicit user action      (permanent
                              (unpin from dashboard     until unpinned)
                              or WhatsApp command)
```

### TTL Extension Logic

```
  Episodic or Semantic fact referenced in a new agent run?
       │
       ├──── YES ──> Reset TTL to full duration
       │             Bump relevance score += 0.1 (capped at 1.0)
       │
       └──── NO  ──> TTL continues counting down
                     No change to relevance score
```

## Memory Quality and Confidence Scoring

Every fact in semantic memory carries a **confidence score** (0.0 to 1.0) that reflects the system's certainty about the fact's accuracy and relevance.

### Confidence Assignment

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    Confidence Score Assignment                      │
  └─────────────────────────────────────────────────────────────────────┘

  Source                          Initial Confidence    Rationale
  ──────                          ──────────────────    ─────────

  User-pinned fact                1.0                   Explicit user
                                                        intent, highest
                                                        trust

  Extracted from user's own       0.9                   Direct user
  message ("I prefer morning                            statement
  meetings")

  Extracted from contact's        0.7                   Second-hand
  message ("Khalid said he's                            information
  available Sundays")

  Inferred from pattern           0.5                   Statistical
  ("User typically responds                             inference, may
  within 5 minutes")                                    not hold

  Extracted from group chat       0.4                   Noisy source,
  context                                               lower signal
```

### Confidence Decay and Reinforcement

```
  Confidence over time:

  1.0 |  *
      |  * *           * (re-confirmed by new evidence)
  0.9 |    *         * *
      |      *     *     *
  0.7 |        * *         *
      |                      *
  0.5 |  - - - - - - - - - - -*- - - threshold - - - - -
      |                        *
  0.3 |                          *
      |                            * (decay below threshold)
  0.0 |________________________________*__________________
      0    30    60    90   120   150   180  days

  Facts below threshold (0.5):
  - Excluded from retrieval results
  - Eligible for early TTL expiry
  - May be superseded by higher-confidence facts
```

### Fact Supersession

When a new fact contradicts an existing one, the older fact is superseded:

```
  Existing fact:
  ┌───────────────────────────────────────────┐
  │ "Ahmed's assistant is Sara"               │
  │ confidence: 0.7   created: 2025-12-01     │
  └────────────────────┬──────────────────────┘
                       │
  New fact extracted:  │
  ┌────────────────────┴──────────────────────┐
  │ "Ahmed's new assistant is Noor"           │
  │ confidence: 0.9   created: 2026-02-15     │
  └───────────────────────────────────────────┘
                       │
                       v
  Result:
  ┌───────────────────────────────────────────┐
  │ Old: supersededBy = <new_fact_id>         │
  │      (excluded from retrieval)            │
  │                                           │
  │ New: active, confidence 0.9               │
  │      (returned in search results)         │
  └───────────────────────────────────────────┘
```
