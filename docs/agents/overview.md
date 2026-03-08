# Agent Architecture

This document describes Ecqqo's AI agent system: the orchestrator, specialist agents, tools, memory system, approval workflows, and prompt architecture. The agent processes WhatsApp messages and executes tasks on behalf of high-net-worth operators through a human-in-the-loop pipeline.

## Complete Agent Architecture

### Inbound Pipeline

<ArchDiagram :config="ao1Config" />

### Orchestrator

<ArchDiagram :config="ao2Config" />

Orchestrator model: Claude Sonnet / GPT-4o (runs as Convex Actions).

### Specialist Agents

<script setup>
// Flow Diagram 1: Inbound Pipeline
const ao1Config = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "ao1-msg", icon: "fa-message", title: "Inbound Message", subtitle: "webhook / wacli", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "ao1-pre", icon: "fa-gear", title: "Preprocessing", subtitle: "Lang · Sanitize · Metadata", row: 0, col: 1, shape: "rect", color: "warm" },
    { id: "ao1-ctx", icon: "fa-database", title: "Context Assembly", subtitle: "Msgs · Memories · Policies", row: 0, col: 2, shape: "rect", color: "blue" },
  ],
  edges: [
    { from: "ao1-msg", to: "ao1-pre" },
    { from: "ao1-pre", to: "ao1-ctx" },
  ],
}

// Flow Diagram 2: Orchestrator
const ao2Config = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "ao2-id", icon: "fa-magnifying-glass", title: "Intent Detection", subtitle: "scheduling · email · reminder · ...", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "ao2-sr", icon: "fa-sitemap", title: "Specialist Routing", subtitle: "Route to 1+ specialists", row: 0, col: 1, shape: "rect", color: "warm" },
    { id: "ao2-rf", icon: "fa-align-left", title: "Response Formatting", subtitle: "Lang match · WA fmt · Concise", row: 0, col: 2, shape: "rect", color: "blue" },
  ],
  edges: [
    { from: "ao2-id", to: "ao2-sr" },
    { from: "ao2-sr", to: "ao2-rf" },
  ],
}

// Flow Diagram 3: Approval Workflow
const ao3Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ao3-dr", icon: "fa-code", title: "Dry-run Payload", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "ao3-sa", icon: "fa-paper-plane", title: "Send Approval", subtitle: "via WhatsApp", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "ao3-wd", icon: "fa-clock", title: "Wait for Decision", subtitle: "30m timeout", row: 2, col: 1, shape: "rect", color: "dark" },
    { id: "ao3-ex", icon: "fa-circle-check", title: "Execute Tool", row: 3, col: 0, shape: "rect", color: "teal" },
    { id: "ao3-no", icon: "fa-circle-xmark", title: "Notify User", row: 3, col: 2, shape: "rect", color: "red" },
  ],
  edges: [
    { from: "ao3-dr", to: "ao3-sa" },
    { from: "ao3-sa", to: "ao3-wd" },
    { from: "ao3-wd", to: "ao3-ex", label: "Approved" },
    { from: "ao3-wd", to: "ao3-no", label: "Rejected" },
  ],
}

// Flow Diagram 4: Response Delivery
const ao4Config = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "ao4-fmt", icon: "fa-align-left", title: "Format for WA", subtitle: "bold, lists, brevity", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "ao4-send", icon: "fa-paper-plane", title: "Send via Meta API", subtitle: "POST /messages", row: 0, col: 1, shape: "rect", color: "warm" },
  ],
  edges: [
    { from: "ao4-fmt", to: "ao4-send" },
  ],
}

// Flow Diagram 5: Specialist Routing Example
const ao5Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ao5-o", icon: "fa-sitemap", title: "Orchestrator", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "ao5-sa", icon: "fa-robot", title: "Scheduler", subtitle: "create event", row: 1, col: 0, shape: "rect", color: "warm" },
    { id: "ao5-ba", icon: "fa-robot", title: "Brief", subtitle: "pre-meeting", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "ao5-fr", icon: "fa-align-left", title: "Format Response", row: 1, col: 2, shape: "rect", color: "dark" },
    { id: "ao5-cr", icon: "fa-calendar", title: "calendar_read", subtitle: "check avail", row: 2, col: 0, shape: "rect", color: "teal" },
    { id: "ao5-cw", icon: "fa-lock", title: "calendar_write", subtitle: "create · APPROVAL", row: 3, col: 0, shape: "rect", color: "red" },
    { id: "ao5-mq", icon: "fa-magnifying-glass", title: "memory_query", subtitle: "Ahmed context", row: 2, col: 1, shape: "rect", color: "teal" },
    { id: "ao5-rs", icon: "fa-clock", title: "reminder_set", subtitle: "brief 30m before", row: 3, col: 1, shape: "rect", color: "warm" },
  ],
  edges: [
    { from: "ao5-o", to: "ao5-sa" },
    { from: "ao5-o", to: "ao5-ba" },
    { from: "ao5-o", to: "ao5-fr" },
    { from: "ao5-sa", to: "ao5-cr" },
    { from: "ao5-sa", to: "ao5-cw" },
    { from: "ao5-ba", to: "ao5-mq" },
    { from: "ao5-ba", to: "ao5-rs" },
  ],
}

// Flow Diagram 6: Policy Check
const ao6Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ao6-tc", icon: "fa-wrench", title: "Tool Call", subtitle: "requested", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "ao6-aa", icon: "fa-circle-question", title: "Auto-approved?", row: 1, col: 1, shape: "diamond", color: "warm" },
    { id: "ao6-ex1", icon: "fa-play", title: "Execute Now", row: 2, col: 0, shape: "rect", color: "teal" },
    { id: "ao6-wh", icon: "fa-clock", title: "Working hours?", row: 2, col: 2, shape: "diamond", color: "warm" },
    { id: "ao6-ex2", icon: "fa-play", title: "Execute Now", row: 3, col: 1, shape: "rect", color: "teal" },
    { id: "ao6-ap", icon: "fa-pause", title: "Create Approval", subtitle: "notify · pause run", row: 3, col: 3, shape: "rect", color: "red" },
  ],
  edges: [
    { from: "ao6-tc", to: "ao6-aa" },
    { from: "ao6-aa", to: "ao6-ex1", label: "Yes" },
    { from: "ao6-aa", to: "ao6-wh", label: "No" },
    { from: "ao6-wh", to: "ao6-ex2", label: "Yes" },
    { from: "ao6-wh", to: "ao6-ap", label: "No" },
  ],
}

// Flow Diagram 7: Tool Execution Flow
const ao7Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ao7-sa", icon: "fa-robot", title: "Specialist", subtitle: "requests tool call", row: 0, col: 2, shape: "rect", color: "teal" },
    { id: "ao7-te", icon: "fa-play", title: "Tool Executor", row: 1, col: 2, shape: "rect", color: "warm" },
    { id: "ao7-se", icon: "fa-circle-question", title: "Side effect?", row: 2, col: 2, shape: "diamond", color: "warm" },
    { id: "ao7-ex1", icon: "fa-play", title: "Execute", subtitle: "return result", row: 3, col: 0, shape: "rect", color: "teal" },
    { id: "ao7-ar", icon: "fa-circle-question", title: "Approval?", row: 3, col: 3, shape: "diamond", color: "warm" },
    { id: "ao7-ex2", icon: "fa-play", title: "Execute", subtitle: "return result", row: 4, col: 2, shape: "rect", color: "teal" },
    { id: "ao7-dr", icon: "fa-code", title: "Dry-run Payload", row: 4, col: 4, shape: "rect", color: "dark" },
    { id: "ao7-tc", icon: "fa-wrench", title: "Create toolCall", row: 5, col: 4, shape: "rect", color: "dark" },
    { id: "ao7-cr", icon: "fa-circle-check", title: "Create Approval", row: 6, col: 4, shape: "rect", color: "dark" },
    { id: "ao7-no", icon: "fa-paper-plane", title: "Notify Operator", row: 7, col: 4, shape: "rect", color: "warm" },
    { id: "ao7-pa", icon: "fa-pause", title: "Pause", subtitle: "await decision", row: 8, col: 4, shape: "rect", color: "dark" },
    { id: "ao7-ex3", icon: "fa-circle-check", title: "Execute Tool", row: 9, col: 3, shape: "rect", color: "teal" },
    { id: "ao7-rj", icon: "fa-circle-xmark", title: "Reject + Notify", row: 9, col: 5, shape: "rect", color: "red" },
  ],
  edges: [
    { from: "ao7-sa", to: "ao7-te" },
    { from: "ao7-te", to: "ao7-se" },
    { from: "ao7-se", to: "ao7-ex1", label: "No" },
    { from: "ao7-se", to: "ao7-ar", label: "Yes" },
    { from: "ao7-ar", to: "ao7-ex2", label: "No" },
    { from: "ao7-ar", to: "ao7-dr", label: "Yes" },
    { from: "ao7-dr", to: "ao7-tc" },
    { from: "ao7-tc", to: "ao7-cr" },
    { from: "ao7-cr", to: "ao7-no" },
    { from: "ao7-no", to: "ao7-pa" },
    { from: "ao7-pa", to: "ao7-ex3", label: "Approved" },
    { from: "ao7-pa", to: "ao7-rj", label: "Rejected" },
  ],
}

// Flow Diagram 8: System Prompt Structure
const ao8Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ao8-role", icon: "fa-user", title: "1. ROLE", subtitle: "WA assistant for principal", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "ao8-cap", icon: "fa-wrench", title: "2. CAPABILITIES", subtitle: "Boundaries + limits", row: 1, col: 0, shape: "rect", color: "teal" },
    { id: "ao8-pol", icon: "fa-scale-balanced", title: "3. POLICIES", subtitle: "Hours, auto-approve", row: 2, col: 0, shape: "rect", color: "teal" },
    { id: "ao8-lang", icon: "fa-language", title: "4. LANGUAGE", subtitle: "Match EN/AR, Gulf dialect", row: 3, col: 0, shape: "rect", color: "teal" },
    { id: "ao8-fmt", icon: "fa-align-left", title: "5. FORMATTING", subtitle: "WA bold/italic, ≤500ch", row: 4, col: 0, shape: "rect", color: "teal" },
    { id: "ao8-tools", icon: "fa-code", title: "6. TOOLS", subtitle: "JSON schemas, constraints", row: 5, col: 0, shape: "rect", color: "teal" },
    { id: "ao8-pin", icon: "fa-thumbtack", title: "PINNED MEMORIES", subtitle: "Prefs, contacts, rules", row: 0, col: 2, shape: "rect", color: "blue" },
    { id: "ao8-rel", icon: "fa-magnifying-glass", title: "RELEVANT MEMORIES", subtitle: "Semantic search hits", row: 1, col: 2, shape: "rect", color: "blue" },
    { id: "ao8-cal", icon: "fa-calendar", title: "TODAY'S CALENDAR", subtitle: "Scheduled events", row: 2, col: 2, shape: "rect", color: "blue" },
    { id: "ao8-conv", icon: "fa-comments", title: "RECENT CONVERSATION", subtitle: "Last 10 messages", row: 3, col: 2, shape: "rect", color: "blue" },
  ],
  edges: [
    { from: "ao8-role", to: "ao8-cap" },
    { from: "ao8-cap", to: "ao8-pol" },
    { from: "ao8-pol", to: "ao8-lang" },
    { from: "ao8-lang", to: "ao8-fmt" },
    { from: "ao8-fmt", to: "ao8-tools" },
    { from: "ao8-tools", to: "ao8-pin" },
    { from: "ao8-pin", to: "ao8-rel" },
    { from: "ao8-rel", to: "ao8-cal" },
    { from: "ao8-cal", to: "ao8-conv" },
  ],
  groups: [
    { label: "SYSTEM PROMPT", color: "teal", nodes: ["ao8-role", "ao8-cap", "ao8-pol", "ao8-lang", "ao8-fmt", "ao8-tools"] },
    { label: "CONTEXT WINDOW", color: "blue", nodes: ["ao8-pin", "ao8-rel", "ao8-cal", "ao8-conv"] },
  ],
}

// Flow Diagram 9: Language Handling
const ao9Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ao9-in", icon: "fa-message", title: "Inbound Message", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "ao9-dl", icon: "fa-language", title: "Detect Language", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "ao9-en", icon: "fa-align-left", title: "English Response", subtitle: "Warm tone, standard fmt", row: 2, col: 0, shape: "rect", color: "blue" },
    { id: "ao9-ar", icon: "fa-align-left", title: "Arabic Response", subtitle: "Gulf dialect, RTL fmt", row: 2, col: 2, shape: "rect", color: "blue" },
  ],
  edges: [
    { from: "ao9-in", to: "ao9-dl" },
    { from: "ao9-dl", to: "ao9-en", label: "en" },
    { from: "ao9-dl", to: "ao9-ar", label: "ar" },
  ],
}

// Flow Diagram 10: Prompt Composition Pipeline
const ao10Config = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "ao10-bp", icon: "fa-code", title: "Base Prompt", subtitle: "per agent, static", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "ao10-pi", icon: "fa-scale-balanced", title: "Policy Injection", subtitle: "per principal", row: 0, col: 1, shape: "rect", color: "warm" },
    { id: "ao10-ci", icon: "fa-database", title: "Context Injection", subtitle: "per request", row: 0, col: 2, shape: "rect", color: "blue" },
    { id: "ao10-fp", icon: "fa-brain", title: "Final Prompt", subtitle: "to LLM via AI SDK", row: 0, col: 3, shape: "rect", color: "dark" },
  ],
  edges: [
    { from: "ao10-bp", to: "ao10-pi" },
    { from: "ao10-pi", to: "ao10-ci" },
    { from: "ao10-ci", to: "ao10-fp" },
  ],
}

// Flow Diagram 11: Observability (LangSmith)
const ao11Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ao11-ar", icon: "fa-robot", title: "Agent Run", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "ao11-sdk", icon: "fa-code", title: "Vercel AI SDK", subtitle: "traceable() wrapped", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "ao11-llm", icon: "fa-brain", title: "LLM Provider", row: 2, col: 0, shape: "rect", color: "dark" },
    { id: "ao11-ls", icon: "fa-chart-line", title: "LangSmith", subtitle: "Async, non-blocking", row: 2, col: 2, shape: "rect", color: "blue" },
    { id: "ao11-te", icon: "fa-magnifying-glass", title: "Trace Explorer", row: 3, col: 1, shape: "rect", color: "blue" },
    { id: "ao11-da", icon: "fa-gauge", title: "Latency/Cost Dash", row: 3, col: 2, shape: "rect", color: "blue" },
    { id: "ao11-pe", icon: "fa-play", title: "Prompt Evals", row: 3, col: 3, shape: "rect", color: "blue" },
    { id: "ao11-pd", icon: "fa-database", title: "Prod Datasets", row: 4, col: 2, shape: "rect", color: "blue" },
  ],
  edges: [
    { from: "ao11-ar", to: "ao11-sdk" },
    { from: "ao11-sdk", to: "ao11-llm" },
    { from: "ao11-sdk", to: "ao11-ls", dashed: true },
    { from: "ao11-ls", to: "ao11-te" },
    { from: "ao11-ls", to: "ao11-da" },
    { from: "ao11-ls", to: "ao11-pe" },
    { from: "ao11-ls", to: "ao11-pd" },
  ],
}

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

<ArchDiagram :config="ao3Config" />

### Memory System

<ArchDiagram :config="memoryConfig" />

### Response Delivery

<ArchDiagram :config="ao4Config" />

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

<ArchDiagram :config="ao5Config" />

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

<ArchDiagram :config="ao6Config" />

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

<ArchDiagram :config="ao7Config" />

---

## Agent Prompt Architecture

### System Prompt Structure

Each agent (orchestrator and specialists) receives a structured system prompt composed of these sections:

<ArchDiagram :config="ao8Config" />

### Language Handling (EN/AR)

The agent detects the language of the inbound message and responds accordingly:

<ArchDiagram :config="ao9Config" />

Language detection uses a lightweight classifier (no LLM call). The detected language is stored on the message record and passed to the agent as context. The agent's system prompt includes bilingual instructions.

### Prompt Composition Pipeline

<ArchDiagram :config="ao10Config" />

1. **Base prompt** is static per agent type (orchestrator, scheduler, calendar, etc.) and defines the role, capabilities, and formatting rules.
2. **Policy injection** adds the principal's specific preferences, approval rules, and working hours.
3. **Context injection** adds real-time data: memories, calendar events, recent conversation, and any active reminders.

The composed prompt is passed to `generateText()` or `streamText()` from the Vercel AI SDK. Tool definitions are provided as structured JSON schemas to enable native tool calling by the LLM.

---

## Observability (LangSmith)

Every agent run is traced via LangSmith for production observability. See [Security Posture > Agent Observability](/security/posture#agent-observability-langsmith) for the full integration architecture, PII redaction policy, and alerting thresholds.

<ArchDiagram :config="ao11Config" />

Key: tracing is async and non-blocking. LangSmith outage does not affect agent execution.
