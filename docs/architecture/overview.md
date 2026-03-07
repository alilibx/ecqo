# System Overview

Ecqqo is a WhatsApp-native executive assistant that lets high-net-worth operators delegate scheduling, communications, and administrative tasks through natural WhatsApp conversations. The system identifies users by phone number, processes requests through an AI orchestration layer, and executes actions across integrated services with human-in-the-loop approval.

## Component Diagram

<script setup>
const trustConfig = {
  layers: [
    {
      id: "tb-edge",
      title: "Untrusted Edge",
      subtitle: "Trust Boundary 1 · User Perimeter",
      icon: "fa-shield-halved",
      color: "red",
      nodes: [
        { id: "tb-waapp", icon: "si:whatsapp", title: "WhatsApp App", subtitle: "User Device · Untrusted" },
      ],
    },
    {
      id: "tb-gateway",
      title: "API Gateway",
      subtitle: "Trust Boundary 2 · Platform Perimeter",
      icon: "fa-lock",
      color: "warm",
      nodes: [
        { id: "tb-meta", icon: "si:meta", title: "Meta Cloud API", subtitle: "Webhook Signature" },
        { id: "tb-clerk", icon: "si:clerk", title: "Clerk", subtitle: "JWT Verification" },
        { id: "tb-vercel", icon: "si:vercel", title: "Vercel", subtitle: "Client Auth" },
      ],
    },
    {
      id: "tb-core",
      title: "Platform Core",
      subtitle: "Trust Boundary 2 · Trusted Source of Truth",
      icon: "si:convex",
      color: "teal",
      nodes: [
        { id: "tb-convex", icon: "si:convex", title: "Convex", subtitle: "Authenticated Mutations" },
      ],
    },
    {
      id: "tb-connector",
      title: "Connector Isolation",
      subtitle: "Trust Boundary 3 · Connector Perimeter",
      icon: "fa-network-wired",
      color: "dark",
      nodes: [
        { id: "tb-fly", icon: "si:flydotio", title: "Fly.io Machine", subtitle: "Signed Events · Lifecycle" },
      ],
    },
    {
      id: "tb-external",
      title: "External APIs",
      subtitle: "Trust Boundary 4 · External Services Perimeter",
      icon: "fa-key",
      color: "blue",
      nodes: [
        { id: "tb-google", icon: "si:google", title: "Google APIs", subtitle: "OAuth 2.0 Tokens" },
        { id: "tb-stripe", icon: "si:stripe", title: "Stripe", subtitle: "API Keys · Webhooks" },
        { id: "tb-aiprov", icon: "si:openai", title: "AI Providers", subtitle: "API Keys · Per-request" },
      ],
    },
  ],
  connections: [
    { from: "tb-waapp", to: "tb-meta", label: "untrusted input" },
    { from: "tb-meta", to: "tb-convex", label: "webhook signature" },
    { from: "tb-clerk", to: "tb-convex", label: "JWT" },
    { from: "tb-vercel", to: "tb-convex", label: "client auth" },
    { from: "tb-convex", to: "tb-fly", label: "signed events" },
    { from: "tb-convex", to: "tb-google", label: "OAuth" },
    { from: "tb-convex", to: "tb-stripe", label: "API keys" },
    { from: "tb-convex", to: "tb-aiprov", label: "API keys" },
  ],
}

const overviewConfig = {
  layers: [
    {
      id: "client",
      title: "Client Layer",
      subtitle: "Users & Interfaces",
      icon: "fa-users",
      color: "teal",
      nodes: [
        { id: "wa", icon: "si:whatsapp", title: "WhatsApp", subtitle: "Primary Interface" },
        { id: "dash", icon: "si:vercel", title: "Dashboard", subtitle: "TanStack Start · SSR" },
      ],
    },
    {
      id: "gateway",
      title: "Gateway & Auth",
      subtitle: "Routing · Identity · Verification",
      icon: "fa-cloud",
      color: "warm",
      nodes: [
        { id: "meta", icon: "si:meta", title: "Meta Cloud API", subtitle: "Webhooks · Send" },
        { id: "clerk", icon: "si:clerk", title: "Clerk", subtitle: "JWT · RBAC · SSO" },
      ],
    },
    {
      id: "control",
      title: "Control Plane",
      subtitle: "Convex Cloud — Source of Truth",
      icon: "si:convex",
      color: "teal",
      nodes: [
        { id: "fn", icon: "fa-code", title: "Functions", subtitle: "Mutations · Queries · Crons" },
        { id: "db", icon: "fa-database", title: "Database", subtitle: "Real-time Subscriptions" },
        { id: "vec", icon: "fa-magnifying-glass", title: "Vector Search", subtitle: "Semantic Memory" },
      ],
    },
    {
      id: "intelligence",
      title: "Intelligence Layer",
      subtitle: "AI Agents · Memory · Orchestration",
      icon: "fa-brain",
      color: "dark",
      nodes: [
        { id: "orch", icon: "fa-sitemap", title: "Orchestrator", subtitle: "Intent Routing" },
        { id: "agents", icon: "fa-robot", title: "Agents", subtitle: "Scheduler · Email · Research" },
        { id: "ai", icon: "si:openai", title: "AI Providers", subtitle: "GPT-4o · Claude · Groq" },
      ],
    },
    {
      id: "services",
      title: "External Services",
      subtitle: "Third-party Integrations",
      icon: "fa-plug",
      color: "warm",
      nodes: [
        { id: "gcal", icon: "si:googlecalendar", title: "Google Calendar", subtitle: "Events · Availability" },
        { id: "gmail", icon: "si:gmail", title: "Gmail", subtitle: "Read · Draft · Send" },
        { id: "stripe", icon: "si:stripe", title: "Stripe", subtitle: "Billing · Subscriptions" },
      ],
    },
    {
      id: "connector",
      title: "Connector Plane",
      subtitle: "WhatsApp Web Bridge · History Sync",
      icon: "fa-network-wired",
      color: "red",
      nodes: [
        { id: "fly", icon: "si:flydotio", title: "Fly.io Worker", subtitle: "1 per user · Isolated" },
        { id: "waweb", icon: "fa-globe", title: "WA Web", subtitle: "Session Bridge" },
      ],
    },
  ],
  connections: [
    { from: "wa", to: "meta", label: "messages" },
    { from: "dash", to: "clerk", label: "auth" },
    { from: "meta", to: "fn", label: "webhooks" },
    { from: "clerk", to: "fn", label: "JWT" },
    { from: "fn", to: "orch", label: "orchestrate" },
    { from: "orch", to: "agents" },
    { from: "agents", to: "ai", label: "LLM" },
    { from: "fn", to: "gcal" },
    { from: "fn", to: "gmail" },
    { from: "fn", to: "stripe" },
    { from: "fn", to: "fly", label: "lifecycle" },
    { from: "fly", to: "waweb", label: "wacli" },
  ],
}
</script>

<ArchDiagram :config="overviewConfig" />

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Frontend** | TanStack Start + React 19 | SSR-first framework with file-based routing. React 19 provides server components and improved streaming. |
| **Backend / Control Plane** | Convex | Reactive database with built-in real-time subscriptions, scheduled functions, and vector search. Zero-ops backend eliminates infrastructure management for a solo dev. |
| **Auth** | Clerk | Drop-in auth with JWT integration for Convex. Supports role-based access (Principal vs Operator) out of the box. |
| **Deployment (Dashboard)** | Vercel | Native TanStack Start support. Edge + serverless functions for SSR with zero-config deployments. |
| **Connector Workers** | Fly.io Machines | Per-user isolated machines that can be started/stopped on demand. Pay-nothing when stopped. Simple deployment model for solo dev. |
| **WhatsApp Integration** | Meta Cloud API + wacli | Cloud API for official business messaging (send/receive). wacli for extended WhatsApp Web capabilities (history sync, richer context). |
| **AI Orchestration** | Vercel AI SDK | Provider-agnostic interface to swap between OpenAI, Anthropic, Groq, and others without code changes. Streaming support built in. |
| **Billing** | Stripe | Industry-standard subscription billing with webhooks for lifecycle events. |
| **Email** | Resend (@convex-dev/resend) | Transactional email for waitlist and notifications. Native Convex component. |

## Key Architectural Decisions

1. **WhatsApp as primary interface, dashboard as secondary.** The target users (executives, operators) already live in WhatsApp. Forcing them into a web dashboard creates friction. The dashboard exists for configuration, analytics, and approval workflows that benefit from a richer UI.

2. **Convex as the single source of truth.** All state lives in Convex: user identity, message history, agent runs, memory, policies, and audit logs. Fly.io workers and the Vercel dashboard are stateless consumers. This simplifies consistency guarantees and eliminates state synchronization bugs.

3. **One Fly.io Machine per user for connector isolation.** Each user's wacli session runs in its own machine. This provides process isolation (one user's crash cannot affect another), independent lifecycle management (start/stop per user), and clear cost attribution.

4. **Vercel AI SDK for provider agnosticism.** Wrapping AI calls through the Vercel AI SDK means switching from OpenAI to Anthropic (or using both for different tasks) requires changing a single provider parameter, not rewriting prompt handling, streaming, or tool-calling code.

5. **Human-in-the-loop approval for sensitive actions.** The agent never executes calendar changes, email sends, or financial operations without explicit approval from the designated operator. Approval requests flow through WhatsApp for speed and are logged in Convex for audit.

6. **Monorepo with clear service boundaries.** Frontend (`app/`), backend (`convex/`), and connector worker (`services/connector/`) live in one repo for atomic changes and shared types, but deploy independently to different platforms.

## Trust Boundaries

The system has four distinct trust boundaries that govern how components authenticate and authorize communication:

<ArchDiagram :config="trustConfig" />

Each boundary enforces the principle of least privilege: components only receive the credentials and data they need to perform their specific function. Cross-boundary communication always flows through authenticated, validated channels.
