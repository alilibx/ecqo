# Architectural Planes

Ecqqo's architecture is organized into four distinct planes, each with a clear responsibility boundary. This separation ensures that concerns like user interaction, data management, connectivity, and intelligence remain decoupled, allowing independent evolution and failure isolation.

## Plane Interaction Diagram

<script setup>
const planesConfig = {
  layers: [
    {
      id: "experience",
      title: "Experience Plane",
      subtitle: "Users & Interfaces",
      icon: "fa-desktop",
      color: "teal",
      nodes: [
        { id: "pl-dash", icon: "fa-gauge", title: "Dashboard", subtitle: "TanStack Start · SSR" },
        { id: "pl-clerk", icon: "si:clerk", title: "Clerk Auth", subtitle: "JWT · RBAC" },
        { id: "pl-wa", icon: "si:whatsapp", title: "WhatsApp Chat", subtitle: "Primary Interface" },
      ],
    },
    {
      id: "control",
      title: "Control Plane",
      subtitle: "Convex · Source of Truth",
      icon: "si:convex",
      color: "warm",
      nodes: [
        { id: "pl-identity", icon: "fa-user", title: "Identity & Roles", subtitle: "Phone-based Lookup" },
        { id: "pl-state", icon: "fa-database", title: "State", subtitle: "Messages · Runs · Policies" },
        { id: "pl-memory", icon: "fa-microchip", title: "Memory", subtitle: "Vectors · Ingestion" },
      ],
    },
    {
      id: "connector",
      title: "Connector Plane",
      subtitle: "wacli Worker Fleet",
      icon: "fa-network-wired",
      color: "red",
      nodes: [
        { id: "pl-fly", icon: "si:flydotio", title: "Fly.io Worker", subtitle: "Per-user Isolation" },
        { id: "pl-waweb", icon: "fa-globe", title: "WA Web", subtitle: "Session Bridge" },
      ],
    },
    {
      id: "intelligence",
      title: "Intelligence Plane",
      subtitle: "AI Agents · Orchestration",
      icon: "fa-brain",
      color: "dark",
      nodes: [
        { id: "pl-orch", icon: "fa-sitemap", title: "Orchestrator", subtitle: "Intent Routing" },
        { id: "pl-agents", icon: "fa-robot", title: "Agents", subtitle: "Specialist Dispatch" },
        { id: "pl-aisdk", icon: "fa-microchip", title: "AI SDK", subtitle: "Provider Agnostic" },
        { id: "pl-tools", icon: "fa-wrench", title: "Tools", subtitle: "External Services" },
      ],
    },
  ],
  connections: [
    { from: "pl-dash", to: "pl-identity", label: "queries" },
    { from: "pl-clerk", to: "pl-identity", label: "JWT" },
    { from: "pl-wa", to: "pl-state", label: "webhooks" },
    { from: "pl-state", to: "pl-fly", label: "lifecycle" },
    { from: "pl-fly", to: "pl-state", label: "events" },
    { from: "pl-state", to: "pl-orch", label: "orchestrate" },
    { from: "pl-orch", to: "pl-agents" },
    { from: "pl-orch", to: "pl-tools" },
  ],
}

const providerConfig = {
  layers: [
    {
      id: "caller",
      title: "Caller",
      subtitle: "Convex Action",
      icon: "fa-code",
      color: "teal",
      nodes: [
        { id: "pv-orch", icon: "fa-sitemap", title: "Orchestrator", subtitle: "Convex Action" },
      ],
    },
    {
      id: "sdk",
      title: "Abstraction Layer",
      subtitle: "Vercel AI SDK",
      icon: "fa-microchip",
      color: "warm",
      nodes: [
        { id: "pv-sdk", icon: "fa-microchip", title: "Vercel AI SDK", subtitle: "generateText · streamText" },
      ],
    },
    {
      id: "providers",
      title: "AI Providers",
      subtitle: "Swappable via Configuration",
      icon: "fa-brain",
      color: "dark",
      nodes: [
        { id: "pv-oai", icon: "si:openai", title: "OpenAI", subtitle: "GPT-4o" },
        { id: "pv-ant", icon: "si:anthropic", title: "Anthropic", subtitle: "Claude" },
        { id: "pv-groq", icon: "fa-bolt", title: "Groq", subtitle: "Fast Inference" },
        { id: "pv-more", icon: "fa-plug", title: "More", subtitle: "OpenRouter · Azure" },
      ],
    },
  ],
  connections: [
    { from: "pv-orch", to: "pv-sdk" },
    { from: "pv-sdk", to: "pv-oai" },
    { from: "pv-sdk", to: "pv-ant" },
    { from: "pv-sdk", to: "pv-groq" },
    { from: "pv-sdk", to: "pv-more" },
  ],
}

const lifecycleSeqConfig = {
  type: "sequence",
  actors: [
    { id: "lc-convex", icon: "si:convex", title: "Convex", subtitle: "Control Plane", color: "teal" },
    { id: "lc-fly", icon: "si:flydotio", title: "Fly.io Machine", color: "red" },
  ],
  steps: [
    { from: "lc-convex", to: "lc-fly", label: "POST /start" },
    { over: "lc-fly", note: "Machine boots\nwacli starts\nQR generated" },
    { from: "lc-convex", to: "lc-fly", label: "POST /status" },
    { from: "lc-fly", to: "lc-convex", label: "Returns QR code", dashed: true },
    { over: ["lc-convex", "lc-fly"], note: "User scans QR — session active" },
    { from: "lc-fly", to: "lc-convex", label: "Signed events (messages, contacts)" },
    { over: "lc-convex", note: "Validate signatures\nStore data" },
    { from: "lc-convex", to: "lc-fly", label: "POST /stop" },
    { over: "lc-fly", note: "Machine stops ($0 when off)" },
  ],
  groups: [
    { label: "Ongoing Sync", color: "teal", from: 5, to: 6 },
  ],
}
</script>

<ArchDiagram :config="planesConfig" />

## 1. Experience Plane

The Experience Plane handles all user-facing interactions across two surfaces: the WhatsApp chat interface (primary) and the web dashboard (secondary).

### WhatsApp Interface
- Users interact with a single Ecqqo WhatsApp Business number
- Messages arrive via Meta Cloud API webhooks into Convex
- Responses are sent back through the Meta Cloud API send endpoint
- The phone number serves as the identity anchor -- no login required for WhatsApp interactions

### Web Dashboard (TanStack Start on Vercel)
- Server-side rendered React 19 application
- Clerk provides authentication with JWT tokens validated by Convex
- Two role-based views:
  - **Principal view**: The executive sees their conversation history, pending approvals, preferences, and analytics
  - **Operator view**: The assistant/operator sees all principals they manage, can configure agent behavior, review audit logs, and handle approvals that escalate beyond WhatsApp

### Key Responsibilities
- Rendering UI (chat history, approval cards, settings)
- Capturing user input and routing it to the Control Plane
- Real-time updates via Convex subscriptions (new messages, approval status changes)
- Zero business logic -- the Experience Plane is a pure presentation layer

## 2. Control Plane

The Control Plane is the authoritative source of truth for the entire system. It runs entirely on Convex Cloud.

### Data Domains

| Domain | Description |
|---|---|
| **Identity** | User records keyed by phone number, linked Clerk IDs, role assignments (Principal/Operator), onboarding state |
| **Messages** | All WhatsApp messages (inbound and outbound), normalized and stored with metadata (timestamps, delivery status, media references) |
| **Ingestion State** | Per-user sync cursors for wacli workers, deduplication checksums, last-sync timestamps |
| **Policies** | Per-user agent configuration: what actions require approval, spending limits, allowed calendar operations, contact preferences |
| **Agent Runs** | Execution records for every agent invocation: input, plan, tool calls, results, approval decisions, final output |
| **Memory** | Extracted facts, preferences, and relationship context stored as vector embeddings for semantic retrieval |
| **Audit Log** | Immutable append-only log of every state change, approval decision, and external action for compliance |

### Key Responsibilities
- Webhook reception and validation (Meta Cloud API signatures)
- User identification and session resolution by phone number
- Triggering agent runs via scheduled functions
- Managing Fly.io machine lifecycle (start, stop, restart commands)
- Enforcing policies and approval requirements
- Storing and indexing all data with real-time subscriptions

## 3. Connector Plane

The Connector Plane manages the fleet of isolated wacli worker processes that connect to WhatsApp Web for extended capabilities beyond the official Cloud API.

### Architecture
- Each user gets a dedicated Fly.io Machine running a wacli process
- The machine connects to WhatsApp Web and maintains a persistent session
- Synced data (message history, contacts, group info) is posted to Convex as signed events
- Convex validates event signatures before processing

### Why a Separate Plane
The official Meta Cloud API only provides messages sent after the business number is set up. The wacli connector enables:
- Historical message sync (past conversations for context)
- Richer contact and group metadata
- Read receipts and presence information
- Media download and processing

### Lifecycle Management

<ArchDiagram :config="lifecycleSeqConfig" />

### Isolation Guarantees
- Each machine runs in its own VM -- no shared memory or filesystem
- Service tokens are scoped to a single user's data partition in Convex
- A crashed worker cannot affect other users' sessions
- Machines are ephemeral and can be rebuilt from Convex state

## 4. Intelligence Plane

The Intelligence Plane contains all AI reasoning, tool execution, and approval workflow logic. It runs as Convex actions (serverless functions with external network access).

### Orchestration Flow
1. **Trigger**: A new message arrives and the Control Plane schedules an agent run
2. **Context Assembly**: The orchestrator retrieves relevant memory (vector search), recent conversation history, user policies, and contact context
3. **Planning**: The orchestrator calls an AI provider (via Vercel AI SDK) with the assembled context and available tools
4. **Specialist Dispatch**: Based on the plan, specialist agents handle specific domains:
   - **Scheduler**: Calendar operations (create, move, cancel events)
   - **Communicator**: Draft and send messages on behalf of the principal
   - **Researcher**: Look up information, summarize documents
   - **Operator**: Handle meta-tasks (update preferences, explain capabilities)
5. **Approval Gate**: If the planned action requires approval (per user policies), an approval request is created and the operator is notified via WhatsApp
6. **Execution**: Upon approval, the specialist executes the action against external services
7. **Response**: The result is composed into a natural WhatsApp message and sent to the user
8. **Memory Extraction**: Key facts from the interaction are extracted and stored as vector embeddings

### Provider Agnosticism
The Vercel AI SDK provides a unified interface across providers:
<ArchDiagram :config="providerConfig" />

Switching providers is a configuration change, not a code change. Different specialists can use different providers optimized for their task (e.g., fast models for classification, powerful models for planning).

### Memory System
- Facts extracted from conversations are stored with vector embeddings
- Convex vector search enables semantic retrieval at query time
- Memory is scoped per principal (never leaks across users)
- The orchestrator assembles a context window from: recent messages + relevant memories + user policies
