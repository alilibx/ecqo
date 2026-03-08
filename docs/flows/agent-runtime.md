# Agent Runtime & Approval Gates

## Overview

The agent runtime is the core orchestration layer that processes user messages, plans actions, enforces approval policies, and executes tools. Every interaction flows through this pipeline, ensuring that no side-effecting action is taken without appropriate authorization.

The runtime operates on a **gated execution model**: the agent can freely read and reason, but any action that modifies external state (sending a message, creating a calendar event, making a payment) must pass through the policy engine. Depending on the action's risk level and the workspace's configuration, it may execute immediately or require explicit human approval via WhatsApp.

## Agent Run Sequence Diagram

<script setup>
const agentRunSeqConfig = {
  type: "sequence",
  actors: [
    { id: "ar-user", icon: "si:whatsapp", title: "User", subtitle: "WhatsApp", color: "teal" },
    { id: "ar-orch", icon: "fa-sitemap", title: "Orchestrator", subtitle: "Convex", color: "warm" },
    { id: "ar-policy", icon: "fa-scale-balanced", title: "Policy Engine", color: "dark" },
    { id: "ar-op", icon: "si:whatsapp", title: "Operator", subtitle: "WhatsApp", color: "teal" },
  ],
  steps: [
    { from: "ar-user", to: "ar-orch", label: "Sends message" },
    { over: "ar-orch", note: "1. Create agentRun (queued)\n2. Load context: profile, workspace, memory\n3. Select specialist agent\n4. Plan action (planning)" },
    { from: "ar-orch", to: "ar-policy", label: "Evaluate policy" },
    { over: "ar-policy", note: "Check: action, risk,\nrole, rules, spend" },
    { from: "ar-policy", to: "ar-orch", label: "Approval required", dashed: true },
    { over: "ar-orch", note: "Create approvalRequest\nstate = awaiting_approval" },
    { from: "ar-orch", to: "ar-op", label: "Approval request via WA" },
    { over: "ar-op", note: "Reviews: action,\npreview, requester" },
    { from: "ar-op", to: "ar-orch", label: "Replies 'approve'" },
    { over: "ar-orch", note: "Execute tool (executing)" },
    { from: "ar-orch", to: "ar-user", label: "Confirmation sent" },
    { over: "ar-orch", note: "state = completed\nLog to episodic memory" },
  ],
  groups: [
    { label: "Planning", color: "warm", from: 1, to: 3 },
    { label: "Approval Flow", color: "dark", from: 4, to: 8 },
    { label: "Execution", color: "teal", from: 9, to: 11 },
  ],
}

const approvalRoutingFlow = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ar1-a", icon: "fa-comments", title: "Inbound WA Message", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "ar1-b", icon: "fa-user", title: "Identify sender", subtitle: "phone lookup", row: 1, col: 1, shape: "rect", color: "warm" },
    { id: "ar1-c", icon: "fa-question", title: "Pending approvals?", row: 2, col: 1, shape: "diamond", color: "dark" },
    { id: "ar1-d", icon: "fa-robot", title: "Regular agent flow", row: 3, col: 0, shape: "rect", color: "teal" },
    { id: "ar1-e", icon: "fa-question", title: "Parse response", row: 3, col: 1, shape: "diamond", color: "dark" },
    { id: "ar1-f", icon: "fa-circle-check", title: "Execute action", subtitle: "Notify requester", row: 4, col: 0, shape: "rect", color: "teal" },
    { id: "ar1-g", icon: "fa-circle-xmark", title: "Cancel agentRun", subtitle: "Notify requester", row: 4, col: 1, shape: "rect", color: "red" },
    { id: "ar1-h", icon: "fa-circle-question", title: "Ask to clarify", subtitle: "approve or reject?", row: 4, col: 2, shape: "rect", color: "warm" },
  ],
  edges: [
    { from: "ar1-a", to: "ar1-b" },
    { from: "ar1-b", to: "ar1-c" },
    { from: "ar1-c", to: "ar1-d", label: "No" },
    { from: "ar1-c", to: "ar1-e", label: "Yes" },
    { from: "ar1-e", to: "ar1-f", label: "Approve" },
    { from: "ar1-e", to: "ar1-g", label: "Reject" },
    { from: "ar1-e", to: "ar1-h", label: "Unclear" },
  ],
}

const policyEngineFlow = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ar2-p1", icon: "fa-gear", title: "Workspace Overrides", subtitle: "Owner-configured rules", row: 0, col: 1, shape: "rect", color: "warm" },
    { id: "ar2-p2", icon: "fa-scale-balanced", title: "Risk Classification", subtitle: "None/Low: auto | Med+: approval", row: 1, col: 1, shape: "rect", color: "dark" },
    { id: "ar2-p3", icon: "fa-user", title: "Approver Selection", subtitle: "Med: operator | High+: owner", row: 2, col: 1, shape: "rect", color: "blue" },
  ],
  edges: [
    { from: "ar2-p1", to: "ar2-p2", label: "No override" },
    { from: "ar2-p2", to: "ar2-p3", label: "Needs approval" },
  ],
}
</script>

<ArchDiagram :config="agentRunSeqConfig" />

## Agent Run State Machine

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> planning : Context loaded,<br>specialist selected

    planning --> executing : Auto-approved
    planning --> awaiting_approval : Approval required

    awaiting_approval --> executing : Approved
    awaiting_approval --> rejected : Rejected
    awaiting_approval --> expired : Timeout (24h TTL)

    executing --> completed : Success
    executing --> retry_executing : Transient error

    retry_executing --> executing : Retry ok (< 3 retries)
    retry_executing --> failed : Max retries exceeded

    completed --> [*]
    rejected --> [*]
    expired --> [*]
    failed --> [*]
```

## Approval via WhatsApp

The approval flow is a core differentiator of Ecqqo: operators and principals can approve or reject agent actions directly from WhatsApp, without opening a dashboard.

### Approval Request Message

When the agent determines an action requires approval, a structured WhatsApp message is sent to the designated approver:

> **Ecqqo Approval Request**
>
> **Action:** Create calendar event
> **For:** Ahmed Al-Rashid (Principal)
> **Details:**
> - Title: Board meeting with Investor Group
> - Date: Sunday, March 15 at 2:00 PM GST
> - Location: DIFC Office, Meeting Room 3
> - Duration: 90 minutes
> - Attendees: 4 (invites will be sent)
>
> Reply "approve" or "reject"
>
> `[Approve]` `[Reject]` *(Quick reply buttons)*

### Approval Response Routing

When the approver replies, the response flows back through the same Meta Cloud API webhook. The system must distinguish approval responses from regular messages:

<ArchDiagram :config="approvalRoutingFlow" />

### Context-Aware Routing

If an approver has multiple pending approval requests, the system uses context to determine which one the reply refers to:

1. **Recency** -- If only one pending request, the reply applies to it.
2. **Quick-reply metadata** -- WhatsApp interactive button replies include a payload ID that maps to a specific `approvalRequest`.
3. **Explicit reference** -- The approver can reply with "approve the calendar event" to disambiguate.
4. **Disambiguation prompt** -- If ambiguous, Ecqqo lists pending requests and asks the approver to specify.

## Policy Engine Rules

The policy engine determines whether an action can auto-execute or needs approval. Rules are evaluated in priority order:

<ArchDiagram :config="policyEngineFlow" />

### Spend Limits

For financial actions, additional spend-based rules apply:

| Condition                         | Policy                              |
|-----------------------------------|-------------------------------------|
| Amount < daily auto-approve limit | Auto-execute (if action type allows)|
| Amount >= daily limit             | Approval required                   |
| Cumulative daily spend > cap      | Approval required (even if individual amount is small) |
| No spend limit configured         | All financial actions need approval |

## Retry Behavior

When tool execution fails (e.g., Google Calendar API is down, payment gateway timeout):

| Attempt | Delay  | Action                                                     |
|---------|--------|------------------------------------------------------------|
| 1       | 0s     | Initial execution attempt                                  |
| 2       | 10s    | First retry, same parameters                               |
| 3       | 60s    | Second retry, same parameters                              |
| --      | --     | Max retries exceeded: state = "failed", user notified      |

Retries do **not** re-trigger the approval flow. Once an action is approved, retries execute under the same approval grant. The approval has a 24-hour TTL; if retries are still failing after 24 hours, the approval expires and the run fails permanently.

### Non-Retryable Failures

Some failures are terminal and skip the retry queue:

- **Validation errors** -- Invalid tool parameters (e.g., malformed email address).
- **Permission denied** -- The connected account lacks access to the target resource.
- **Resource not found** -- The target entity no longer exists (e.g., deleted calendar).
- **Approval rejected** -- The operator explicitly rejected the action.
- **Approval expired** -- No response within the 24-hour TTL.
