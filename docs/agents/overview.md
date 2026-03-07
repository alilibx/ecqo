# Agent Architecture

This document describes Ecqqo's AI agent system: the orchestrator, specialist agents, tools, memory system, approval workflows, and prompt architecture. The agent processes WhatsApp messages and executes tasks on behalf of high-net-worth operators through a human-in-the-loop pipeline.

## Complete Agent Architecture

### Inbound Pipeline

```mermaid
flowchart LR
    A["fa:fa-message Inbound Message<br/>(webhook / wacli)"] --> B["fa:fa-gear Preprocessing"]
    B --> C["fa:fa-database Context Assembly"]

    B -.- B1["fa:fa-language Lang detect"]
    B -.- B2["fa:fa-shield-halved Sanitize"]
    B -.- B3["fa:fa-magnifying-glass Extract metadata"]

    C -.- C1["fa:fa-comments Recent msgs (10)"]
    C -.- C2["fa:fa-thumbtack Pinned memories"]
    C -.- C3["fa:fa-magnifying-glass Vector hits"]
    C -.- C4["fa:fa-scale-balanced User policies"]
    C -.- C5["fa:fa-clock Active reminders"]
    C -.- C6["fa:fa-calendar Calendar context"]
```

### Orchestrator

```mermaid
flowchart LR
    ID["fa:fa-magnifying-glass Intent Detection"] --> SR["fa:fa-sitemap Specialist<br/>Routing"] --> RF["fa:fa-align-left Response<br/>Formatting"]

    ID -.- I1["fa:fa-calendar scheduling"]
    ID -.- I2["fa:fa-calendar calendar_query"]
    ID -.- I3["fa:fa-envelope email"]
    ID -.- I4["fa:fa-clock reminder"]
    ID -.- I5["fa:fa-paper-plane travel"]
    ID -.- I6["fa:fa-microchip brief"]
    ID -.- I7["fa:fa-comments chitchat"]
    ID -.- I8["fa:fa-circle-question unclear"]

    SR -.- S1["fa:fa-sitemap Route to 1+<br/>specialists"]

    RF -.- R1["fa:fa-language Lang match (EN/AR)"]
    RF -.- R2["fa:fa-align-left WA formatting"]
    RF -.- R3["fa:fa-comments Concise tone"]
```

Orchestrator model: Claude Sonnet / GPT-4o (runs as Convex Actions).

### Specialist Agents

<script setup>
const agentsConfig = {
  layers: [
    {
      id: "ag-orch",
      title: "Orchestrator",
      subtitle: "Intent Detection · Specialist Routing",
      icon: "fa-sitemap",
      color: "teal",
      nodes: [
        { id: "ag-orchestrator", icon: "fa-sitemap", title: "Orchestrator", subtitle: "Claude Sonnet / GPT-4o" },
      ],
    },
    {
      id: "ag-core",
      title: "Core Specialists",
      subtitle: "Primary Domain Agents",
      icon: "fa-robot",
      color: "warm",
      nodes: [
        { id: "ag-sched", icon: "fa-calendar", title: "Scheduler", subtitle: "Time · Participants · Ops" },
        { id: "ag-cal", icon: "fa-calendar", title: "Calendar", subtitle: "Availability · Conflicts" },
        { id: "ag-email", icon: "fa-envelope", title: "Email", subtitle: "Digest · Draft · Reply" },
      ],
    },
    {
      id: "ag-extended",
      title: "Extended Specialists",
      subtitle: "Support Domain Agents",
      icon: "fa-robot",
      color: "warm",
      nodes: [
        { id: "ag-remind", icon: "fa-clock", title: "Reminder", subtitle: "Set · Track · Recur" },
        { id: "ag-travel", icon: "fa-paper-plane", title: "Travel", subtitle: "Details · Cal Entries" },
        { id: "ag-brief", icon: "fa-microchip", title: "Brief", subtitle: "Pre-meeting Context" },
      ],
    },
    {
      id: "ag-exec",
      title: "Execution",
      subtitle: "Tool Invocation",
      icon: "fa-play",
      color: "dark",
      nodes: [
        { id: "ag-executor", icon: "fa-play", title: "Tool Executor", subtitle: "External API Calls" },
      ],
    },
  ],
  connections: [
    { from: "ag-orchestrator", to: "ag-sched" },
    { from: "ag-orchestrator", to: "ag-cal" },
    { from: "ag-orchestrator", to: "ag-email" },
    { from: "ag-orchestrator", to: "ag-remind" },
    { from: "ag-orchestrator", to: "ag-travel" },
    { from: "ag-orchestrator", to: "ag-brief" },
    { from: "ag-sched", to: "ag-executor" },
    { from: "ag-email", to: "ag-executor" },
    { from: "ag-brief", to: "ag-executor" },
  ],
}

const toolsConfig = {
  layers: [
    {
      id: "tools-ro",
      title: "Read-only Tools",
      subtitle: "No Approval Required",
      icon: "fa-magnifying-glass",
      color: "teal",
      nodes: [
        { id: "tl-cal-read", icon: "fa-calendar", title: "calendar_read", subtitle: "Availability · Events" },
        { id: "tl-email-read", icon: "fa-envelope", title: "email_read", subtitle: "Inbox · Threads" },
      ],
    },
    {
      id: "tools-internal",
      title: "Internal Tools",
      subtitle: "No Approval Required",
      icon: "fa-gear",
      color: "warm",
      nodes: [
        { id: "tl-mem-query", icon: "fa-magnifying-glass", title: "memory_query", subtitle: "Semantic Search" },
        { id: "tl-mem-pin", icon: "fa-thumbtack", title: "memory_pin", subtitle: "Pin Facts" },
        { id: "tl-rem-set", icon: "fa-clock", title: "reminder_set", subtitle: "Create Reminders" },
      ],
    },
    {
      id: "tools-write",
      title: "Write Tools",
      subtitle: "Approval-gated · Side Effects",
      icon: "fa-lock",
      color: "red",
      nodes: [
        { id: "tl-cal-write", icon: "fa-calendar", title: "calendar_write", subtitle: "Create · Update · Delete" },
        { id: "tl-wa-send", icon: "si:whatsapp", title: "whatsapp_send", subtitle: "Send Messages" },
        { id: "tl-rem-deliver", icon: "fa-bolt", title: "reminder_deliver", subtitle: "Trigger Delivery" },
      ],
    },
    {
      id: "tools-gate",
      title: "Approval Gate",
      subtitle: "Policy Enforcement",
      icon: "fa-shield-halved",
      color: "dark",
      nodes: [
        { id: "tl-gate", icon: "fa-circle-check", title: "Approval Gate", subtitle: "Dry-run · Approve · Execute" },
      ],
    },
  ],
  connections: [
    { from: "tl-cal-write", to: "tl-gate", label: "requires approval" },
    { from: "tl-wa-send", to: "tl-gate" },
    { from: "tl-rem-deliver", to: "tl-gate" },
  ],
}

const memoryConfig = {
  layers: [
    {
      id: "mem-pinned",
      title: "Pinned",
      subtitle: "No Expiry · Always Included",
      icon: "fa-thumbtack",
      color: "blue",
      nodes: [
        { id: "mem-pin", icon: "fa-thumbtack", title: "Pinned Facts", subtitle: "Operator preferences" },
      ],
    },
    {
      id: "mem-short",
      title: "Short-term",
      subtitle: "7d TTL · Recent Context",
      icon: "fa-clock",
      color: "teal",
      nodes: [
        { id: "mem-st", icon: "fa-clock", title: "Short-term", subtitle: "Recent facts · In-flight" },
      ],
    },
    {
      id: "mem-episodic",
      title: "Episodic",
      subtitle: "90d TTL · Decision History",
      icon: "fa-database",
      color: "warm",
      nodes: [
        { id: "mem-ep", icon: "fa-chart-line", title: "Episodic", subtitle: "Daily digests · Logs" },
      ],
    },
    {
      id: "mem-semantic",
      title: "Semantic",
      subtitle: "365d TTL · Vector Embeddings",
      icon: "fa-brain",
      color: "dark",
      nodes: [
        { id: "mem-sem", icon: "fa-microchip", title: "Semantic", subtitle: "Long-term prefs · Patterns" },
      ],
    },
    {
      id: "mem-vector",
      title: "Vector Search",
      subtitle: "embed-3-small · 1536 Dimensions",
      icon: "fa-magnifying-glass",
      color: "teal",
      nodes: [
        { id: "mem-embed", icon: "fa-microchip", title: "Embeddings", subtitle: "text-embedding-3-small" },
        { id: "mem-filter", icon: "fa-user", title: "Filter", subtitle: "By principalId" },
        { id: "mem-rank", icon: "fa-chart-line", title: "Ranking", subtitle: "Top-10 · Threshold 0.7" },
      ],
    },
  ],
  connections: [
    { from: "mem-sem", to: "mem-embed" },
    { from: "mem-embed", to: "mem-filter" },
    { from: "mem-filter", to: "mem-rank" },
  ],
}
</script>

<ArchDiagram :config="agentsConfig" />

### Tools

<ArchDiagram :config="toolsConfig" />

### Approval Workflow

```mermaid
flowchart TD
    DR["fa:fa-code Dry-run payload"] --> SA["fa:fa-paper-plane Send approval<br/>via WhatsApp"] --> WD["fa:fa-clock Wait for decision<br/>(30m timeout)"]
    WD -->|Approved| EX["fa:fa-circle-check Execute tool"]
    WD -->|Rejected| NO["fa:fa-circle-xmark Notify user"]
```

### Memory System

<ArchDiagram :config="memoryConfig" />

### Response Delivery

```mermaid
flowchart LR
    F["fa:fa-align-left Format for WA<br/>(bold, lists, brevity)"] --> S["fa:fa-paper-plane Send via Meta API<br/>(POST /messages)"]
```

## Orchestrator Responsibilities

The orchestrator is the central coordinator for every agent run. It receives the preprocessed message and assembled context, then manages the entire execution lifecycle.

### 1. Intent Detection

The orchestrator classifies the inbound message into one of these intents:

| Intent | Description | Example |
|---|---|---|
| `scheduling` | Create, move, or cancel meetings | "Set up a call with Ahmed at 3pm tomorrow" |
| `calendar_query` | Check availability or daily agenda | "What do I have on Thursday?" |
| `email` | Read, summarize, or draft email | "Any important emails today?" |
| `reminder` | Set, check, or cancel reminders | "Remind me to call the bank at 2pm" |
| `travel` | Travel-related scheduling | "I'm flying to London on March 15th" |
| `brief` | Pre-meeting briefing | "Brief me on my next meeting" |
| `chitchat` | Non-actionable conversation | "Thanks!" |
| `unclear` | Ambiguous or multi-intent | "Handle my stuff for tomorrow" |

For `unclear` intents, the orchestrator asks a clarifying question before routing.

### 2. Specialist Routing

Based on the detected intent, the orchestrator selects one or more specialist agents. Complex requests may involve multiple specialists in sequence:

Example: *"Set up a call with Ahmed tomorrow at 3pm and send me a brief about him 30 minutes before"*

```mermaid
flowchart TD
    O["fa:fa-sitemap Orchestrator"] --> SA["fa:fa-robot Scheduler<br/>(create event)"]
    O --> BA["fa:fa-robot Brief<br/>(pre-meeting)"]
    O --> FR["fa:fa-align-left Format response"]

    SA --> CR["fa:fa-calendar calendar_read<br/>(check avail)"]
    SA --> CW["fa:fa-lock calendar_write<br/>(create) APPROVAL"]

    BA --> MQ["fa:fa-magnifying-glass memory_query<br/>(Ahmed context)"]
    BA --> RS["fa:fa-clock reminder_set<br/>(brief 30m before)"]
```

### 3. Context Assembly

Before calling any specialist, the orchestrator assembles a context window:

| Context Source | Content | Max Size |
|---|---|---|
| Recent messages | Last 10 messages in the conversation | ~2000 tokens |
| Pinned memories | All pinned facts for the principal | ~500 tokens |
| Vector search | Top-10 semantically relevant memories | ~1000 tokens |
| User policies | Approval rules, working hours, preferences | ~200 tokens |
| Active reminders | Upcoming reminders for the next 24 hours | ~300 tokens |
| Calendar context | Today's and tomorrow's events | ~500 tokens |

Total context budget: ~4500 tokens, leaving room for the system prompt and response.

### 4. Policy Check

Before executing any tool, the orchestrator checks the principal's policies:

```mermaid
flowchart TD
    TC["fa:fa-wrench Tool call requested"] --> AA{"Auto-approved?"}
    AA -->|Yes| EX1["fa:fa-play Execute now"]
    AA -->|No| WH{"Within working<br/>hours?"}
    WH -->|Yes| EX2["fa:fa-play Execute now"]
    WH -->|No| AP["fa:fa-pause Create approval<br/>notify operator<br/>pause run"]
```

### 5. Approval Workflow

For approval-gated tools, the orchestrator:

1. Generates a dry-run payload (what the tool would do, in human-readable format)
2. Creates an `approvalRequest` record in Convex
3. Sends a WhatsApp message to the operator with the request details
4. Pauses the agent run (status = `"awaiting_approval"`)
5. On approval: resumes execution with the approved payload
6. On rejection: notifies the principal and marks the run complete

### 6. Result Formatting

The orchestrator formats the final response for WhatsApp delivery:

- Matches the language of the inbound message (EN or AR)
- Uses WhatsApp formatting (bold, italic, lists, line breaks)
- Keeps responses concise (under 500 characters for simple confirmations)
- Includes relevant details without being verbose
- Adds a follow-up prompt when appropriate ("Anything else?")

---

## Specialist Agents

### Scheduler Agent

**Purpose:** Handles all meeting and event creation, modification, and cancellation requests.

**Input Context:**
- Inbound message with scheduling intent
- Principal's calendar for the relevant day(s)
- Contact information for mentioned participants
- Principal's scheduling preferences from memory

**Tools:**
- `calendar_read` -- check availability, find events
- `calendar_write` -- create, update, or delete events (approval-gated)
- `memory_query` -- look up contact preferences, usual meeting patterns

**Output Format:**
- Confirmation message with event details (time, date, participants, location)
- Conflict notification if time slot is busy
- Alternative time suggestions if requested slot is unavailable

**Approval Required:** Yes, for `calendar_write` (unless auto-approved via policy).

---

### Calendar Agent

**Purpose:** Answers questions about the principal's calendar without making changes.

**Input Context:**
- Inbound message with calendar query intent
- Principal's calendar for the relevant timeframe

**Tools:**
- `calendar_read` -- fetch events for date range
- `memory_query` -- look up context about meetings or attendees

**Output Format:**
- Day summary with event list (time, title, participants)
- Availability windows for the requested date
- Meeting count and free time summary

**Approval Required:** No (read-only).

---

### Email Agent

**Purpose:** Reads, summarizes, and helps draft email responses.

**Input Context:**
- Inbound message with email intent
- Recent email subjects and senders (via Gmail API)

**Tools:**
- `email_read` -- fetch inbox, read specific emails
- `memory_query` -- look up sender context and past interactions

**Output Format:**
- Inbox digest: top N unread emails with sender, subject, and 1-line summary
- Full email summary when a specific email is referenced
- Flagged items: emails from VIP contacts or containing urgent keywords

**Approval Required:** No (read-only). Future: email sending will be approval-gated.

---

### Reminder Agent

**Purpose:** Creates, tracks, and delivers reminders via WhatsApp.

**Input Context:**
- Inbound message with reminder intent
- Active reminders for the principal
- Principal's timezone

**Tools:**
- `reminder_set` -- create a Convex scheduled function for delivery
- `reminder_deliver` -- send reminder message via Meta Cloud API (approval-gated for first delivery)
- `memory_query` -- check for related context

**Output Format:**
- Confirmation with reminder details (what, when)
- Active reminders list when requested
- Delivery confirmation when a reminder fires

**Approval Required:** `reminder_deliver` requires approval for the first reminder to a new contact. Subsequent deliveries to the same principal are auto-approved.

---

### Travel Agent

**Purpose:** Extracts travel details from messages and proposes calendar entries.

**Input Context:**
- Inbound message mentioning travel (flights, hotels, trips)
- Principal's calendar for the travel dates
- Timezone information

**Tools:**
- `calendar_read` -- check conflicts with travel dates
- `calendar_write` -- create travel blocks and related events (approval-gated)
- `memory_query` -- look up travel preferences (airline, hotel, seat)

**Output Format:**
- Extracted travel itinerary (flight times, hotel dates, destinations)
- Proposed calendar entries for the trip
- Conflict warnings if travel overlaps with existing events

**Approval Required:** Yes, for `calendar_write`.

---

### Brief Agent

**Purpose:** Assembles pre-meeting briefing documents with context from multiple sources.

**Input Context:**
- The upcoming meeting (participants, agenda, location)
- Memory about each participant
- Past meeting notes and outcomes
- Recent email threads with participants

**Tools:**
- `calendar_read` -- get meeting details
- `email_read` -- find recent correspondence with attendees
- `memory_query` -- retrieve relationship context, past interactions, notes

**Output Format:**
- Structured brief: meeting title, time, participants with context
- Key talking points from past interactions
- Open items or follow-ups from previous meetings
- Relevant facts from memory (preferences, sensitivities, recent events)

**Approval Required:** No (read-only assembly).

---

## Tool Registry

| Tool Name | Description | Side Effect | Approval Required | Provider |
|---|---|---|---|---|
| `calendar_read` | Read events, check availability | No | No | Google Calendar API |
| `calendar_write` | Create, update, delete calendar events | Yes | Yes (default) | Google Calendar API |
| `email_read` | Read inbox, fetch email content | No | No | Gmail API |
| `reminder_set` | Schedule a reminder delivery | Yes | No | Convex scheduled function |
| `reminder_deliver` | Send reminder via WhatsApp | Yes | Yes (first contact) | Meta Cloud API |
| `whatsapp_send` | Send message via WhatsApp | Yes | Yes (first contact) | Meta Cloud API |
| `memory_query` | Semantic search over memories | No | No | Convex vector search |
| `memory_pin` | Pin a fact as permanent memory | Yes | No | Convex mutation |

### Tool Execution Flow

```mermaid
flowchart TD
    SA["fa:fa-robot Specialist requests<br/>tool call"] --> TE["fa:fa-play Tool Executor"]
    TE --> SE{"Side effect?"}
    SE -->|No| EX1["fa:fa-play Execute, return"]
    SE -->|Yes| AR{"Approval needed?"}
    AR -->|No| EX2["fa:fa-play Execute, return"]
    AR -->|Yes| DR["fa:fa-code Gen dry-run payload"]
    DR --> TC["fa:fa-wrench Create toolCall"]
    TC --> CR["fa:fa-circle-check Create approval req"]
    CR --> NO["fa:fa-paper-plane Notify operator"]
    NO --> PA["fa:fa-pause Pause, await decision"]
    PA -->|Approved| EX3["fa:fa-circle-check Execute tool"]
    PA -->|Rejected| RJ["fa:fa-circle-xmark Reject + notify"]
```

---

## Agent Prompt Architecture

### System Prompt Structure

Each agent (orchestrator and specialists) receives a structured system prompt composed of these sections:

```mermaid
flowchart TD
    subgraph SP["fa:fa-gear SYSTEM PROMPT"]
        direction TB
        R["fa:fa-user 1. ROLE<br/>WA assistant for principal"]
        C["fa:fa-wrench 2. CAPABILITIES<br/>Boundaries + limits"]
        P["fa:fa-scale-balanced 3. POLICIES<br/>Hours, auto-approve"]
        L["fa:fa-language 4. LANGUAGE<br/>Match EN/AR, Gulf dialect"]
        F["fa:fa-align-left 5. FORMATTING<br/>WA bold/italic, ≤500ch"]
        T["fa:fa-code 6. TOOLS<br/>JSON schemas, constraints"]
        R --> C --> P --> L --> F --> T
    end

    subgraph CW["fa:fa-database CONTEXT WINDOW"]
        direction TB
        PM["fa:fa-thumbtack PINNED MEMORIES<br/>Prefs, contacts, rules"]
        RM["fa:fa-magnifying-glass RELEVANT MEMORIES<br/>Semantic search hits"]
        TC2["fa:fa-calendar TODAY'S CALENDAR<br/>Scheduled events"]
        RC["fa:fa-comments RECENT CONVERSATION<br/>Last 10 messages"]
        PM --> RM --> TC2 --> RC
    end

    SP --> CW
```

### Language Handling (EN/AR)

The agent detects the language of the inbound message and responds accordingly:

```mermaid
flowchart TD
    IN["fa:fa-message Inbound message"] --> DL["fa:fa-language Detect language"]
    DL -->|"en"| EN["fa:fa-align-left English response<br/>Warm tone, standard fmt"]
    DL -->|"ar"| AR["fa:fa-align-left Arabic response<br/>Gulf dialect, RTL fmt"]
```

Language detection uses a lightweight classifier (no LLM call). The detected language is stored on the message record and passed to the agent as context. The agent's system prompt includes bilingual instructions.

### Prompt Composition Pipeline

```mermaid
flowchart LR
    BP["fa:fa-code Base prompt<br/>(per agent, static)"] --> PI["fa:fa-scale-balanced Policy injection<br/>(per principal)"] --> CI["fa:fa-database Context injection<br/>(per request)"] --> FP["fa:fa-brain Final prompt<br/>to LLM via AI SDK"]
```

1. **Base prompt** is static per agent type (orchestrator, scheduler, calendar, etc.) and defines the role, capabilities, and formatting rules.
2. **Policy injection** adds the principal's specific preferences, approval rules, and working hours.
3. **Context injection** adds real-time data: memories, calendar events, recent conversation, and any active reminders.

The composed prompt is passed to `generateText()` or `streamText()` from the Vercel AI SDK. Tool definitions are provided as structured JSON schemas to enable native tool calling by the LLM.

---

## Observability (LangSmith)

Every agent run is traced via LangSmith for production observability. See [Security Posture > Agent Observability](/security/posture#agent-observability-langsmith) for the full integration architecture, PII redaction policy, and alerting thresholds.

```mermaid
flowchart TD
    AR["fa:fa-robot Agent Run"] -->|"traceable() wrapped"| SDK["fa:fa-code Vercel AI SDK"]
    SDK --> LLM["fa:fa-brain LLM Provider"]
    SDK -->|"Async, non-blocking"| LS["fa:fa-chart-line LangSmith"]
    LS --> TE["fa:fa-magnifying-glass Trace explorer"]
    LS --> DA["fa:fa-gauge Latency/cost dash"]
    LS --> PE["fa:fa-play Prompt evals"]
    LS --> PD["fa:fa-database Prod datasets"]
```

Key: tracing is async and non-blocking. LangSmith outage does not affect agent execution.
