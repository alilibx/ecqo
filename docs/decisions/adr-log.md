# Architecture Decision Records

This log captures the major architectural decisions made for Ecqqo. Each record explains the context, the decision, what alternatives were considered, and the consequences. Decisions are numbered sequentially and immutable once accepted -- superseded decisions are marked as such with a pointer to the replacement.

---

### ADR-001: Use Clerk for Authentication

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: Ecqqo needs multi-tenant authentication with workspace-scoped role-based access control (owner, principal, operator). The target user base includes UAE-based principals who may prefer phone number login or social login via Google. The dashboard requires session management, JWT issuance for Convex, and the ability to invite members to a workspace by email. Building auth from scratch is out of scope for a solo developer shipping an MVP.
- **Decision**: Use Clerk as the authentication provider. Clerk handles user registration, login (email, phone, Google OAuth), session management, and JWT issuance. Workspace membership and role assignment are stored in Clerk's organization feature, with claims embedded in the JWT and validated by every Convex function.
- **Alternatives Considered**:
  - **Convex built-in auth**: Convex offers a simple auth integration but lacks organization/workspace primitives, role management, and social login out of the box. Would require building membership and invitation flows manually.
  - **Auth0**: Mature platform with organizations feature, but significantly more complex configuration. Pricing scales unfavorably for a bootstrapped product. The dashboard and SDK feel enterprise-heavy for a solo-dev workflow.
  - **Supabase Auth**: Tightly coupled to Supabase's Postgres backend. Since Ecqqo uses Convex (not Supabase) for the database, using Supabase Auth alone creates an awkward split where auth lives in one cloud and data in another, with no real benefit.
- **Consequences**: Clerk becomes a critical dependency for all authenticated flows. JWT validation is performed on every Convex function call, adding a small latency overhead (typically <5ms). Clerk's pricing applies per monthly active user. If Clerk has an outage, no user can access the dashboard (mitigated by Clerk's 99.99% SLA). The team avoids building auth UI, email verification, password reset, and session management -- saving weeks of development time.

---

### ADR-002: Use Fly.io Machines for Connector Workers

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: Each Ecqqo workspace needs a long-running process (the "connector worker") that maintains a WhatsApp Web session, syncs messages, and forwards events to Convex. These workers are stateful (they hold an encrypted session file), must run 24/7, and need per-user isolation so that one user's crash does not affect another. The worker count scales linearly with user count (one worker per workspace). Workers need to be started and stopped programmatically when users connect or disconnect WhatsApp.
- **Decision**: Run connector workers as Fly.io Machines. Each workspace gets a dedicated Machine in the region closest to the user (e.g., `dxb` for UAE users). Machines are created/destroyed via the Fly.io Machines API from a Convex action. Session files are stored on encrypted Fly.io volumes attached to each Machine.
- **Alternatives Considered**:
  - **AWS ECS/Fargate**: Proven for container orchestration, but the operational overhead is high for a solo developer. ECS task definitions, VPC configuration, IAM roles, and CloudWatch setup add significant complexity. Fargate cold starts (30-60s) are acceptable but not ideal. Pricing is competitive but harder to reason about.
  - **Railway**: Simple developer experience, but lacks the per-machine volume attachment needed for persistent session storage. Auto-scaling behavior is less predictable. No regional selection granularity (important for UAE latency).
  - **Render**: Good for web services but background workers are a secondary use case. No machine-level API for programmatic start/stop. Volumes are available but the API for dynamic provisioning is limited.
  - **Hetzner VPS**: Cheapest option by far, but requires managing the entire orchestration layer (process management, health checks, restarts, multi-tenancy isolation) manually. Acceptable for a single user but does not scale without building significant infrastructure.
- **Consequences**: Fly.io Machines provide per-user isolation, persistent volumes, sub-second start times, and a simple REST API for lifecycle management. Cost is approximately $3-5/month per active worker (shared-cpu-1x, 256MB). Regional deployment reduces latency for WhatsApp Web protocol. The trade-off is vendor lock-in to Fly.io's Machines API and volume system. If Fly.io changes pricing or deprecates Machines, migration to another container platform would require re-implementing the orchestration layer but not the worker code itself.

---

### ADR-003: Single Ecqqo WhatsApp Number via Meta Cloud API

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: Ecqqo needs to send outbound WhatsApp messages to users (approval notifications, agent responses, daily briefings). There are two approaches: give each user their own WhatsApp Business number, or have all users interact with a single Ecqqo-owned business number. The outbound path is separate from the connector (which syncs the user's personal WhatsApp). Outbound messages are sent by the agent on behalf of the user, delivered to the user's personal WhatsApp from Ecqqo's number.
- **Decision**: Use a single Ecqqo-owned WhatsApp Business number registered with Meta's Cloud API. All outbound messages (approval requests, agent responses, briefings) come from this one number. Users add Ecqqo's number to their contacts. Inbound replies to this number are routed to the correct workspace by matching the sender's verified phone number.
- **Alternatives Considered**:
  - **Per-user WhatsApp Business numbers**: Each workspace gets its own WhatsApp Business number. This provides a more "personal" feel but requires Meta Business verification per number, costs $0.05-0.10 per conversation per day per number, and creates operational complexity around number provisioning, compliance, and support. Not viable for an MVP.
  - **WhatsApp Business Platform multi-number**: Meta's BSP partners (like Twilio, MessageBird) offer multi-number management. This delegates provisioning complexity to the BSP but adds another vendor dependency, higher per-message costs, and a less direct relationship with Meta's API.
- **Consequences**: Simpler operations -- one number to manage, one Meta Business verification, one set of message templates. Users see "Ecqqo" as the sender, which reinforces brand but means the agent cannot impersonate the user via WhatsApp (all outbound is clearly from Ecqqo). Routing inbound replies requires a reliable phone-number-to-workspace lookup, which depends on Meta's verified phone number in webhook payloads. If Meta restricts the number (rate limits, policy violations), all users are affected simultaneously -- this is the primary risk, mitigated by strict message template compliance and conservative sending rates.

---

### ADR-004: Vercel AI SDK for Provider-Agnostic AI

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: The agent runtime needs to call LLMs for reasoning, tool planning, and natural language generation. Model quality and pricing are evolving rapidly. Ecqqo should be able to switch between providers (OpenAI, Anthropic, Google) without rewriting integration code. The agent uses structured tool calling, streaming responses, and multi-turn conversations.
- **Decision**: Use the Vercel AI SDK (`ai` package) as the abstraction layer for all LLM interactions. The SDK provides a unified interface for chat completions, tool calling, and streaming across providers. Model selection is a configuration value (`model: "anthropic/claude-sonnet-4-20250514"`) that can be changed per workspace or globally without code changes.
- **Alternatives Considered**:
  - **Direct OpenAI/Anthropic SDKs**: Maximum control and access to provider-specific features. But switching providers means rewriting integration code, handling different streaming formats, and adapting tool calling schemas. Maintenance burden multiplies with each provider.
  - **LangChain**: Feature-rich framework with chains, agents, memory, and retrieval. However, LangChain is heavily abstracted, has a large dependency tree, and its abstractions often leak or change between versions. The "framework" approach conflicts with Ecqqo's need for tight control over agent behavior (approval gates, kill switches). Debugging LangChain agent behavior is notoriously difficult.
  - **LiteLLM**: Lightweight proxy that normalizes provider APIs. Good for the specific problem of provider switching, but it is a Python-first tool. Using it from a TypeScript stack requires running a separate proxy service or using the REST API, adding latency and operational complexity.
- **Consequences**: The Vercel AI SDK is TypeScript-native, well-maintained (backed by Vercel), and has a small API surface. It supports streaming, tool calling, and multi-turn conversations. The trade-off is that provider-specific features (like Anthropic's extended thinking or OpenAI's function calling nuances) may be accessed through the SDK's lower-level escape hatches rather than the unified API. The SDK adds a dependency on Vercel's open-source project, but it is MIT-licensed and has no runtime lock-in to Vercel's hosting platform.

---

### ADR-005: Convex Vector Search for Semantic Memory

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: The agent needs semantic memory -- the ability to store facts, preferences, and episodic information and retrieve them by meaning rather than exact keyword match. For example, when a user says "schedule something at my favorite restaurant," the agent should retrieve the memory entry "user prefers La Petite Maison for business dinners" even though no keywords overlap. This requires vector embeddings and similarity search.
- **Decision**: Use Convex's built-in vector search feature. Memory entries are stored in a Convex table with a vector field containing the embedding (generated via OpenAI's `text-embedding-3-small`). Retrieval uses Convex's `ctx.vectorSearch()` API with cosine similarity, filtered by workspace and memory tier.
- **Alternatives Considered**:
  - **Pinecone**: Purpose-built vector database with excellent query performance, metadata filtering, and namespace isolation. However, it adds another managed service to the stack, requires synchronizing data between Convex (source of truth) and Pinecone (search index), and introduces eventual consistency between the two. Costs $70+/month for the standard tier.
  - **Qdrant**: Open-source vector database with a generous free tier on Qdrant Cloud. Strong filtering capabilities. Same synchronization concern as Pinecone. Self-hosting on Fly.io is possible but adds operational burden.
  - **Weaviate**: Full-featured vector database with built-in vectorization. Overkill for Ecqqo's use case. Heavy operational footprint if self-hosted.
  - **pgvector (via Supabase or Neon)**: Adds PostgreSQL to the stack, which conflicts with the Convex-first architecture. Would require maintaining two databases and keeping them in sync.
- **Consequences**: Keeping vector search inside Convex eliminates data synchronization issues -- when a memory entry is created or updated, the vector index is updated transactionally in the same mutation. No additional service to manage or pay for. The trade-off is that Convex's vector search is less feature-rich than dedicated vector databases (limited filtering options, no hybrid search, no re-ranking). For Ecqqo's scale (thousands of memory entries per workspace, not millions), this is acceptable. If semantic search quality becomes a bottleneck, migrating to Pinecone is a well-understood path.

---

### ADR-006: Metadata-First Sync with Allowlist for Full Content

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: The connector worker can sync the user's entire WhatsApp chat history, but doing so raises serious privacy and storage concerns. Users may have hundreds of chats, many of which are irrelevant to the assistant (family groups, meme channels, old conversations). Syncing everything means storing sensitive personal messages, increasing storage costs, and expanding the attack surface if the database is compromised. On the other hand, the agent needs conversation context to be useful.
- **Decision**: Sync metadata for all chats by default (contact name, last message timestamp, message count, chat type). Full message content is only synced for chats the user explicitly adds to an allowlist via the dashboard. The agent can see the user's chat list (for context like "you have an unread message from Ahmed") but can only read and act on allowlisted conversations.
- **Alternatives Considered**:
  - **Full sync by default**: Sync all message content from all chats. Maximizes agent capability but stores massive amounts of personal data. Users may not realize how much is being stored. Creates a significant liability if data is breached. Storage costs scale with message volume.
  - **User-selected chats only (no metadata)**: Only sync chats the user explicitly selects, with no metadata for other chats. This is the most privacy-preserving but severely limits the agent's contextual awareness. The agent cannot say "you have 3 unread messages" or "Ahmed messaged you 10 minutes ago" unless Ahmed's chat is selected. Reduces the product's value proposition.
- **Consequences**: The metadata-first approach balances privacy with utility. Users get a "WhatsApp overview" in the dashboard without exposing message content. The allowlist creates a clear consent boundary -- users actively choose which conversations the agent can read. This is a differentiator for privacy-conscious high-net-worth users. The trade-off is reduced agent capability for non-allowlisted chats. The agent can reference metadata ("you have a message from Fatima") but cannot read or respond to the content without the user first allowlisting that chat. This may create friction during onboarding when users need to allowlist their key contacts.

---

### ADR-007: WhatsApp-First Approval Notifications

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: When the agent needs approval for an action (sending an email, scheduling a meeting, replying to a message), the user needs to be notified promptly. The target users are high-net-worth operators who may not check a dashboard frequently but are on WhatsApp continuously throughout the day. Approval latency directly impacts the product's usefulness -- a 30-minute delay in approving a meeting reply defeats the purpose of having an AI assistant.
- **Decision**: Send approval notifications via WhatsApp (from Ecqqo's official business number via Meta Cloud API). The notification includes a summary of the proposed action and a prompt to approve or reject. Users can approve by replying "yes" or "approve" directly in WhatsApp, or tap a link to the dashboard for the full dry-run preview.
- **Alternatives Considered**:
  - **Email notifications**: Reliable delivery but slow engagement. Target users receive hundreds of emails daily. An approval request email will compete with newsletters, marketing, and other notifications. Open rates for transactional email average 40-50%, which means half of approval requests would be missed or delayed.
  - **Push notifications (PWA or native app)**: Requires building a mobile app or PWA with push notification support. Users must install the app and grant notification permissions. Adds significant development scope (iOS/Android or service worker setup). Push notifications are often silenced or ignored.
  - **Dashboard-only**: The dashboard shows pending approvals with a badge count. This works if the user keeps the dashboard open, but target users are unlikely to keep a browser tab open all day. Requires active polling by the user.
- **Consequences**: WhatsApp notifications meet users where they already are. Response times are expected to be minutes, not hours. The trade-off is dependence on Meta Cloud API delivery (which has >99.5% delivery rates for template messages). Users must have Ecqqo's number saved and must not block it. WhatsApp message templates require Meta approval, which constrains notification formatting. Quick approval via WhatsApp reply is convenient but less secure than dashboard approval (no dry-run preview) -- this is acceptable for low-risk actions, with high-risk actions requiring dashboard review enforced by policy rules.

---

### ADR-008: Stripe for Billing with AED/USD Multi-Currency

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: Ecqqo needs subscription billing for its SaaS plans. The primary market is UAE (where AED is the local currency), with plans to serve international users (USD). The billing system must support recurring subscriptions, plan changes, payment method management, and invoice generation. UAE has no sales tax (VAT is 5% but may not apply to B2B SaaS depending on the free zone), simplifying tax handling.
- **Decision**: Use Stripe for all billing. Plans are defined in both AED and USD. Users select their preferred currency during onboarding (or change it in Settings). Stripe's Customer Portal is embedded in the dashboard for self-service plan changes, payment method updates, and invoice access.
- **Alternatives Considered**:
  - **Paddle**: Merchant of record model handles VAT/tax globally, which is appealing. However, Paddle's Middle East support is limited -- AED is not a supported settlement currency, and UAE payment methods (local debit cards, bank transfers) are not well-supported. Paddle takes a higher revenue cut (5% + $0.50 per transaction vs. Stripe's 2.9% + $0.30).
  - **LemonSqueezy**: Developer-friendly, good for indie SaaS. But limited currency support (no AED), no embedded customer portal, and less mature API for programmatic plan management. Better suited for simple products with a single pricing tier.
  - **Custom billing**: Build invoicing and payment collection manually using local UAE payment gateways (e.g., Telr, PayTabs). Maximum control but massive development effort for subscription management, proration, failed payment handling, and invoice generation. Not viable for an MVP.
- **Consequences**: Stripe provides a mature API, excellent TypeScript SDK, and handles the complexity of recurring billing. AED support requires creating separate Stripe Price objects for each plan in AED. The Customer Portal reduces dashboard development scope. The trade-off is Stripe's per-transaction fees and the requirement for UAE users to have cards that work with Stripe (Visa/Mastercard are ubiquitous in UAE, so this is low risk). If Stripe changes its UAE fee structure or currency support, migration to another provider would require rebuilding the billing integration but not the rest of the product.

---

### ADR-009: Monorepo Structure

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: Ecqqo consists of multiple components: the TanStack Start dashboard (frontend), Convex functions (backend), connector worker code (services), and documentation. These components share TypeScript types (e.g., workspace IDs, role enums, event schemas) and need to be deployed in coordination (e.g., a schema change in Convex requires updating the dashboard's queries). The project is built and maintained by a solo developer.
- **Decision**: Keep all code in a single repository with a directory-based structure.
  ```
  ecqqo/
  +-- app/            Frontend (TanStack Start + React)
  +-- convex/         Backend (Convex functions + schema)
  +-- services/       Connector worker, background jobs
  +-- docs/           VitePress documentation
  +-- vite.config.ts  Build configuration
  +-- package.json    Dependencies (single lockfile)
  ```
- **Alternatives Considered**:
  - **Separate repos per service**: `ecqqo-dashboard`, `ecqqo-convex`, `ecqqo-connector`, `ecqqo-docs`. Clean separation of concerns, independent CI/CD pipelines, independent versioning. But for a solo developer, the overhead of maintaining multiple repos (PRs, dependency sync, cross-repo type sharing, coordinated deployments) is high. Shared types require publishing an internal package or git submodules, both of which add friction.
  - **Turborepo/Nx monorepo**: Structured monorepo with workspace packages, shared configs, and build caching. Powerful for teams but overkill for a solo developer. Turborepo's caching and task orchestration solve problems that do not yet exist at Ecqqo's scale. Adds configuration complexity (workspace protocols, package boundaries, build pipelines) without proportional benefit.
- **Consequences**: A flat monorepo with directory-based separation gives the fastest iteration speed for a solo developer. Shared types are imported directly across directories without package publishing. A single `bun.lockb` file means no dependency version conflicts. The trade-off is that as the team grows, the lack of formal package boundaries may lead to tight coupling. The migration path to Turborepo workspaces is straightforward when needed -- add `workspaces` to `package.json` and split `dependencies` per package.

---

### ADR-010: Approval-Required for All External Side-Effects

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: The agent can perform actions with real-world consequences: sending emails, scheduling meetings, replying to WhatsApp messages, creating calendar events. These actions affect the principal's professional relationships and reputation. A single incorrect email or an embarrassing auto-reply could damage trust irreparably. The target users are high-net-worth operators with low tolerance for errors and high expectations for control. During the pilot phase, the system's reliability is unproven.
- **Decision**: Every external side-effect requires explicit user approval before execution. There is no auto-execute mode, no confidence-based bypass, and no "low-risk" exception. The agent prepares the action, generates a dry-run preview, and waits for the user to approve or reject via WhatsApp or the dashboard. Only after approval does the action execute.
- **Alternatives Considered**:
  - **Auto-execute low-risk actions**: Define a risk taxonomy (e.g., reading calendar is low-risk, sending email is high-risk) and auto-execute low-risk actions. This reduces approval fatigue but requires correctly classifying risk, which is subjective and context-dependent. A calendar read might be low-risk in general but high-risk if it exposes the user's schedule to an unauthorized party via the agent's response.
  - **Confidence-based gating**: Let the agent self-assess confidence and auto-execute above a threshold (e.g., 95%). This is unreliable because LLM confidence calibration is poor -- models are often confidently wrong. A 95% confidence threshold would still mean 1 in 20 actions is wrong, which is unacceptable for high-stakes operations.
  - **Progressive trust (unlock auto-execute after N successful approvals)**: Build a track record per action type and unlock auto-execution after consistent approval. Theoretically sound but complex to implement safely. Edge cases (what happens after a rejection? does the counter reset?) create ambiguity. Better suited for a post-pilot feature.
- **Consequences**: The approval-required policy maximizes user trust and control at the cost of throughput. Every action has human-in-the-loop latency (minutes to hours depending on user responsiveness). This is acceptable for the pilot because the target users value control over speed -- they are not trying to automate high-volume tasks but rather delegate high-judgment tasks. The WhatsApp-first notification system (ADR-007) minimizes approval latency by reaching users where they already are. Post-pilot, progressive trust (ADR alternative 3) is the most likely evolution path, gated behind a strong track record and user opt-in.

---

### ADR-011: Use LangSmith for Agent Observability

- **Status**: Accepted
- **Date**: 2026-03-07
- **Context**: Ecqqo's agent runtime involves multi-step LLM chains (orchestrator -> specialist -> tool execution -> approval -> delivery). In production, the team needs visibility into prompt performance, token costs, latency breakdowns, tool call success rates, and the ability to replay/debug failed runs. Generic APM tools (Datadog, New Relic) can measure HTTP latency but cannot trace LLM-specific concerns like token usage, prompt quality, or chain-of-thought reasoning. The system uses Vercel AI SDK for provider-agnostic model access, so the observability tool must work across providers.
- **Decision**: Use LangSmith as the observability layer for all agent runs. Every LLM call is wrapped with LangSmith's `traceable()` decorator. Traces capture the full run lifecycle: context assembly, orchestrator call, specialist call, policy evaluation, approval wait, tool execution, and response delivery. PII is redacted before traces are sent. LangSmith's eval framework is used for prompt regression testing.
- **Alternatives Considered**:
  - **Langfuse (open-source)**: Self-hosted LLM observability. Full control over data, no vendor lock-in. But self-hosting adds ops burden for a solo developer -- Postgres instance, deployment, upgrades, backups. The managed cloud tier exists but is less mature than LangSmith's ecosystem. The eval and dataset features are catching up but not yet as polished.
  - **Braintrust**: Strong eval-first platform with good tracing. But smaller ecosystem and fewer integrations. The tracing is newer and less battle-tested. Better suited for teams focused primarily on eval workflows rather than production monitoring.
  - **Custom Convex logging**: Store trace data directly in Convex tables. Zero external dependency, full control, no data leaves the system. But this means building a trace viewer, aggregation queries, alerting, eval framework, and dataset management from scratch. Significant engineering investment that distracts from core product work.
  - **Helicone (proxy-based)**: Sits as a proxy between the app and LLM providers. Simple setup, good cost tracking. But only captures LLM calls, not the full agent chain (memory retrieval, tool execution, approval workflow). Cannot trace non-LLM steps. Also adds latency as a request proxy.
- **Consequences**: LangSmith becomes the source of truth for agent performance. The free tier (5K traces/month) covers pilot volume. PII redaction must be enforced at the instrumentation layer since traces leave the Convex environment. If LangSmith has an outage, tracing silently fails but agent execution continues unaffected (tracing is async and non-blocking). The `langsmith` SDK is added as a dependency. Three environment variables (`LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT`, `LANGCHAIN_TRACING_V2`) are set in the Convex dashboard.
