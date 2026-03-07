---
layout: home
hero:
  name: "Ecqo"
  text: "Architecture & Delivery Plan"
  tagline: WhatsApp-native executive assistant for high-net-worth operators
  actions:
    - theme: brand
      text: System Architecture
      link: /architecture/overview
    - theme: alt
      text: Delivery Plan
      link: /plan/milestones
features:
  - title: WhatsApp-Native
    details: Single Ecqo number. Users interact via WhatsApp. Agent responds in-chat via Meta Cloud API. Dashboard for monitoring and approvals.
  - title: Agent Platform
    details: Convex-native orchestrator with specialist agents, 4-tier memory system, approval-gated execution, and bilingual EN/AR support.
  - title: Pilot-Safe
    details: Read-only WhatsApp ingestion via managed wacli workers. Kill-switch controls. Metadata-first sync. Strict approval gates.
  - title: Solo-Dev Optimized
    details: Monorepo with TanStack Start + Convex + Fly.io workers. Provider-agnostic AI via Vercel AI SDK. Stripe billing. April 15 target.
---

# Quick Links

| Area | What's Covered |
|------|---------------|
| [System Overview](/architecture/overview) | Component diagram, tech stack, 4 architectural planes |
| [Deployment & Infra](/architecture/deployment) | Vercel + Convex + Fly.io topology, cost estimates |
| [Data Flow](/architecture/data-flow) | End-to-end message flow from WhatsApp to calendar |
| [Connect WhatsApp](/flows/connect-whatsapp) | QR auth flow, state machine, failure handling |
| [User Identification](/flows/user-identification) | Single-number user matching and account binding |
| [Agent Runtime](/flows/agent-runtime) | Orchestration, approval gates, specialist agents |
| [Schema & ERD](/data-model/schema) | All entities, indexes, relationships |
| [Agent Architecture](/agents/overview) | Orchestrator, specialist agents, tools, memory |
| [Milestones](/plan/milestones) | M0-M3 timeline targeting April 15, 2026 |
| [Epics](/plan/epics) | 10 epics, ~65 issues with dependencies |
| [Cost Estimation](/plan/cost-estimation) | Infrastructure + API cost projections |
