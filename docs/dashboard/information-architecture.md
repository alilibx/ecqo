<script setup>
const iaNavConfig = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "ia-dashboard", icon: "fa-gauge", title: "Dashboard", subtitle: "Clerk auth, RBAC", row: 0, col: 4, shape: "rect", color: "teal" },

    { id: "ia-home", icon: "fa-house", title: "Home / Overview", row: 1, col: 0, shape: "rect", color: "teal" },
    { id: "ia-connect", icon: "fa-link", title: "Connect", row: 1, col: 1, shape: "rect", color: "teal" },
    { id: "ia-inbox", icon: "fa-inbox", title: "Inbox (Approvals)", row: 1, col: 2, shape: "rect", color: "teal" },
    { id: "ia-conversations", icon: "fa-comments", title: "Conversations", row: 1, col: 3, shape: "rect", color: "teal" },
    { id: "ia-runs", icon: "fa-list-check", title: "Runs", row: 1, col: 4, shape: "rect", color: "teal" },
    { id: "ia-memory", icon: "fa-microchip", title: "Memory", row: 1, col: 5, shape: "rect", color: "teal" },
    { id: "ia-integrations", icon: "fa-plug", title: "Integrations", row: 1, col: 6, shape: "rect", color: "teal" },
    { id: "ia-policy", icon: "fa-scale-balanced", title: "Policy", row: 1, col: 7, shape: "rect", color: "teal" },
    { id: "ia-settings", icon: "fa-gear", title: "Settings", row: 1, col: 8, shape: "rect", color: "teal" },

    { id: "ia-h1", icon: "fa-chart-line", title: "Status cards", subtitle: "WA, sync, approvals", row: 2, col: 0, shape: "rect", color: "green" },
    { id: "ia-h2", icon: "fa-bolt", title: "Quick actions", row: 3, col: 0, shape: "rect", color: "green" },
    { id: "ia-h3", icon: "fa-list-check", title: "Activity feed (24h)", row: 4, col: 0, shape: "rect", color: "green" },

    { id: "ia-c1", icon: "fa-comments", title: "QR code display", row: 2, col: 1, shape: "rect", color: "blue" },
    { id: "ia-c2", icon: "fa-circle-check", title: "Connection status", row: 3, col: 1, shape: "rect", color: "blue" },
    { id: "ia-c3", icon: "fa-link", title: "Reconnect / disconnect", row: 4, col: 1, shape: "rect", color: "blue" },
    { id: "ia-c4", icon: "fa-clock", title: "Uptime + heartbeat", row: 5, col: 1, shape: "rect", color: "blue" },

    { id: "ia-i1", icon: "fa-inbox", title: "Approval queue", subtitle: "+ dry-run previews", row: 2, col: 2, shape: "rect", color: "amber" },
    { id: "ia-i2", icon: "fa-circle-check", title: "Approve / reject", row: 3, col: 2, shape: "rect", color: "amber" },
    { id: "ia-i3", icon: "fa-magnifying-glass", title: "Filters", subtitle: "pending, approved, rejected", row: 4, col: 2, shape: "rect", color: "amber" },
    { id: "ia-i4", icon: "fa-list-check", title: "Batch approve", subtitle: "owner only", row: 5, col: 2, shape: "rect", color: "amber" },
    { id: "ia-i5", icon: "fa-comments", title: "WA deep-link", row: 6, col: 2, shape: "rect", color: "amber" },

    { id: "ia-cv1", icon: "fa-comments", title: "Chat list", subtitle: "+ allowlist toggles", row: 2, col: 3, shape: "rect", color: "purple" },
    { id: "ia-cv2", icon: "fa-message", title: "Thread viewer", row: 3, col: 3, shape: "rect", color: "purple" },
    { id: "ia-cv3", icon: "fa-user", title: "Contact + sync status", row: 4, col: 3, shape: "rect", color: "purple" },
    { id: "ia-cv4", icon: "fa-magnifying-glass", title: "Search metadata", row: 5, col: 3, shape: "rect", color: "purple" },

    { id: "ia-r1", icon: "fa-magnifying-glass", title: "Run explorer", row: 2, col: 4, shape: "rect", color: "orange" },
    { id: "ia-r2", icon: "fa-clock", title: "State timeline", row: 3, col: 4, shape: "rect", color: "orange" },
    { id: "ia-r3", icon: "fa-gear", title: "Step details", subtitle: "tools, reasoning", row: 4, col: 4, shape: "rect", color: "orange" },
    { id: "ia-r4", icon: "fa-arrow-right", title: "Retry info", row: 5, col: 4, shape: "rect", color: "orange" },
    { id: "ia-r5", icon: "fa-chart-line", title: "Duration + cost", row: 6, col: 4, shape: "rect", color: "orange" },

    { id: "ia-m1", icon: "fa-microchip", title: "Memory browser", subtitle: "core/active/episodic", row: 2, col: 5, shape: "rect", color: "cyan" },
    { id: "ia-m2", icon: "fa-magnifying-glass", title: "Semantic + keyword", row: 3, col: 5, shape: "rect", color: "cyan" },
    { id: "ia-m3", icon: "fa-gear", title: "Pin/unpin controls", row: 4, col: 5, shape: "rect", color: "cyan" },
    { id: "ia-m4", icon: "fa-chart-line", title: "Confidence scores", row: 5, col: 5, shape: "rect", color: "cyan" },
    { id: "ia-m5", icon: "fa-clock", title: "TTL + expiry", row: 6, col: 5, shape: "rect", color: "cyan" },

    { id: "ia-ig1", icon: "fa-link", title: "Google Calendar", row: 2, col: 6, shape: "rect", color: "indigo" },
    { id: "ia-ig2", icon: "fa-message", title: "Gmail", row: 3, col: 6, shape: "rect", color: "indigo" },
    { id: "ia-ig3", icon: "fa-comments", title: "WhatsApp connector", row: 4, col: 6, shape: "rect", color: "indigo" },
    { id: "ia-ig4", icon: "fa-credit-card", title: "Stripe billing", row: 5, col: 6, shape: "rect", color: "indigo" },
    { id: "ia-ig5", icon: "fa-plug", title: "Connect / disconnect", row: 6, col: 6, shape: "rect", color: "indigo" },

    { id: "ia-p1", icon: "fa-scale-balanced", title: "Approval rules", row: 2, col: 7, shape: "rect", color: "red" },
    { id: "ia-p2", icon: "fa-clock", title: "Quiet hours", row: 3, col: 7, shape: "rect", color: "red" },
    { id: "ia-p3", icon: "fa-shield-halved", title: "Guardrails", row: 4, col: 7, shape: "rect", color: "red" },
    { id: "ia-p4", icon: "fa-gear", title: "Defaults", subtitle: "lang, tz", row: 5, col: 7, shape: "rect", color: "red" },

    { id: "ia-s1", icon: "fa-gear", title: "Workspace config", row: 2, col: 8, shape: "rect", color: "gray" },
    { id: "ia-s2", icon: "fa-users", title: "Members + roles", row: 3, col: 8, shape: "rect", color: "gray" },
    { id: "ia-s3", icon: "fa-credit-card", title: "Billing portal", row: 4, col: 8, shape: "rect", color: "gray" },
    { id: "ia-s4", icon: "fa-globe", title: "Language (EN/AR)", row: 5, col: 8, shape: "rect", color: "gray" },
    { id: "ia-s5", icon: "fa-gear", title: "Theme (light/dark)", row: 6, col: 8, shape: "rect", color: "gray" },
    { id: "ia-s6", icon: "fa-triangle-exclamation", title: "Danger zone", row: 7, col: 8, shape: "rect", color: "gray" },
  ],
  edges: [
    { from: "ia-dashboard", to: "ia-home" },
    { from: "ia-dashboard", to: "ia-connect" },
    { from: "ia-dashboard", to: "ia-inbox" },
    { from: "ia-dashboard", to: "ia-conversations" },
    { from: "ia-dashboard", to: "ia-runs" },
    { from: "ia-dashboard", to: "ia-memory" },
    { from: "ia-dashboard", to: "ia-integrations" },
    { from: "ia-dashboard", to: "ia-policy" },
    { from: "ia-dashboard", to: "ia-settings" },
  ],
  groups: [
    { label: "Home / Overview", color: "green", nodes: ["ia-h1", "ia-h2", "ia-h3"] },
    { label: "Connect", color: "blue", nodes: ["ia-c1", "ia-c2", "ia-c3", "ia-c4"] },
    { label: "Inbox (Approvals)", color: "amber", nodes: ["ia-i1", "ia-i2", "ia-i3", "ia-i4", "ia-i5"] },
    { label: "Conversations", color: "purple", nodes: ["ia-cv1", "ia-cv2", "ia-cv3", "ia-cv4"] },
    { label: "Runs", color: "orange", nodes: ["ia-r1", "ia-r2", "ia-r3", "ia-r4", "ia-r5"] },
    { label: "Memory", color: "cyan", nodes: ["ia-m1", "ia-m2", "ia-m3", "ia-m4", "ia-m5"] },
    { label: "Integrations", color: "indigo", nodes: ["ia-ig1", "ia-ig2", "ia-ig3", "ia-ig4", "ia-ig5"] },
    { label: "Policy", color: "red", nodes: ["ia-p1", "ia-p2", "ia-p3", "ia-p4"] },
    { label: "Settings", color: "gray", nodes: ["ia-s1", "ia-s2", "ia-s3", "ia-s4", "ia-s5", "ia-s6"] },
  ],
}
</script>

# Dashboard Information Architecture

The Ecqqo dashboard is a role-gated, real-time control surface built with TanStack Start + React 19. It gives principals (the high-net-worth operators who use the assistant) and their support staff visibility into every action the agent takes, with approval controls at every exit point.

> **Implementation status (ECQ-9):** The dashboard layout shell is complete with live data pages. `app/routes/dashboard/route.tsx` implements a fixed sidebar (240px) on desktop, a collapsible sidebar with hamburger toggle and overlay on tablet (<= 1024px), and a bottom tab bar (4 tabs + More) on mobile (<= 640px). Navigation is role-aware via `canAccess()` from `app/lib/route-guards.ts`, with active route highlighting and Escape-key sidebar dismiss.
>
> **Implemented pages:**
> - **Home** (`app/routes/dashboard/index.tsx`): Stats grid (contacts, conversations, messages, agent runs today), WhatsApp connection status badge, recent conversations list with links to detail view. Data via `convex/dashboard.ts` queries (`stats`, `recentChats`).
> - **Conversations list** (`app/routes/dashboard/conversations.index.tsx`): Full chat list with contact names, message previews, timestamps, and message counts. Real-time via `dashboard.listChats` Convex subscription.
> - **Conversation detail** (`app/routes/dashboard/conversations.$chatJid.tsx`): Message thread with date separators, incoming/outgoing bubble styling, agent message labels, auto-scroll to latest. Contact info sidebar (phone, language, message count, first/last seen). Real-time via `dashboard.listMessages` Convex subscription.
> - Remaining pages (inbox, runs, memory, integrations, policy, settings) are placeholder stubs with `beforeLoad` RBAC guards.
>
> **Backend queries** (`convex/dashboard.ts`): `stats` (aggregate workspace stats), `listChats` (enriched chat list with contacts + last message), `listMessages` (message thread + contact info), `recentChats` (top 5 for home overview). All RBAC-protected.

## Navigation Structure

<ArchDiagram :config="iaNavConfig" />

## Role-Page Access Matrix

Three roles govern dashboard access. Every Convex query and mutation checks the caller's Clerk JWT and workspace membership before returning data.

> **Implementation note:** Route-level RBAC is enforced by `app/lib/route-guards.ts` (defines `PAGE_ACCESS` map, `canAccess()`, `getAccessiblePages()`, `requireDashboardRole()`) and `app/routes/dashboard/route.tsx` (runs auth check in `beforeLoad()`, passes `workspaceId`, `role`, and `workspaceName` via route context to all child routes).

| Page           | Owner              | Principal          | Operator           |
|----------------|--------------------|--------------------|---------------------|
| Home           | Full               | Full               | Limited (no billing stats) |
| Connect        | Full               | View only          | No access           |
| Inbox          | Full + batch       | Approve/reject own | Full (triage + escalate) |
| Conversations  | Full               | Own context only   | Full (monitor all)  |
| Runs           | Full               | Own context only   | Full (monitor all)  |
| Memory         | Full (CRUD)        | Own context only   | View only           |
| Integrations   | Full (connect/disconnect) | View status  | View status         |
| Policy         | Full (CRUD)        | Edit own defaults  | View only           |
| Settings       | Full               | Profile + language | No access           |

**Role definitions:**

- **Owner** -- Workspace creator. Full administrative control. Can invite/remove members, manage billing, activate kill switches, modify all policies. One per workspace.
- **Principal** -- The person the assistant serves. Can approve/reject actions, view their own conversation context and runs, adjust their own default preferences. Multiple allowed per workspace.
- **Operator** -- Support staff or delegated admin. Can triage the approval queue, monitor all conversations and runs, escalate issues. Cannot modify policies or billing.

## Page Wireframes

### Home / Overview

```
+------------------------------------------------------------------+
|  [logo] Ecqqo          Home  Inbox(3)  Runs  Memory    [AR] [??]  |
+------------------------------------------------------------------+
|                                                                    |
|  +-------------------+  +-------------------+                      |
|  | WhatsApp          |  | Sync Health       |                      |
|  | [*] Connected     |  | [*] Healthy       |                      |
|  | Uptime: 4d 12h    |  | Last sync: 2m ago |                      |
|  +-------------------+  +-------------------+                      |
|                                                                    |
|  +-------------------+  +-------------------+                      |
|  | Pending Approvals |  | Today's Runs      |                      |
|  | [!] 3 waiting     |  | 12 completed      |                      |
|  | Oldest: 14m ago   |  | 1 failed, 0 retry |                      |
|  +-------------------+  +-------------------+                      |
|                                                                    |
|  Recent Activity                                        [View all] |
|  +--------------------------------------------------------------+ |
|  | 10:42  Agent scheduled meeting with Dr. Khalid    [approved]  | |
|  | 10:38  Approval requested: send follow-up email   [pending]   | |
|  | 10:21  Memory updated: "prefers morning meetings" [auto]      | |
|  | 09:55  Run completed: daily briefing generation   [completed] | |
|  | 09:30  WhatsApp sync: 4 new messages ingested     [synced]    | |
|  +--------------------------------------------------------------+ |
|                                                                    |
+------------------------------------------------------------------+
```

### Inbox / Approvals

```
+------------------------------------------------------------------+
|  [logo] Ecqqo          Home  Inbox(3)  Runs  Memory    [AR] [??]  |
+------------------------------------------------------------------+
|                                                                    |
|  Approvals                    [Pending v]  [All types v]  [Search] |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | [!] Send follow-up email to Ahmed Al-Mansour                  | |
|  |     Type: gmail.send | Requested: 14m ago                     | |
|  |                                                                | |
|  |  Dry-run preview:                                              | |
|  |  +----------------------------------------------------------+ | |
|  |  | To: ahmed@example.com                                     | | |
|  |  | Subject: Re: Q2 Investment Summary                        | | |
|  |  | Body: "Dear Ahmed, Following up on our discussion..."     | | |
|  |  +----------------------------------------------------------+ | |
|  |                                                                | |
|  |  [Approve]  [Reject]  [View full context]                     | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | [!] Create calendar event: Board dinner                       | |
|  |     Type: calendar.create | Requested: 22m ago                | |
|  |     Mar 15, 7:00 PM - 10:00 PM | La Petite Maison             | |
|  |                                                                | |
|  |  [Approve]  [Reject]  [View full context]                     | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | [!] Reply to WhatsApp message from Fatima                     | |
|  |     Type: whatsapp.send | Requested: 31m ago                  | |
|  |     "Will confirm the venue by Thursday evening."              | |
|  |                                                                | |
|  |  [Approve]  [Reject]  [View full context]                     | |
|  +--------------------------------------------------------------+ |
|                                                                    |
+------------------------------------------------------------------+
```

### Connect WhatsApp

```
+------------------------------------------------------------------+
|  [logo] Ecqqo          Home  Inbox(3)  Runs  Memory    [AR] [??]  |
+------------------------------------------------------------------+
|                                                                    |
|  Connect WhatsApp                                                  |
|                                                                    |
|  +-------------------------------+  +---------------------------+  |
|  |                               |  |                           |  |
|  |    +-------------------+      |  |  Status: Disconnected     |  |
|  |    |                   |      |  |                           |  |
|  |    |    [QR CODE]      |      |  |  1. Open WhatsApp on      |  |
|  |    |                   |      |  |     your phone            |  |
|  |    |   +-----------+   |      |  |  2. Tap Menu > Linked     |  |
|  |    |   |           |   |      |  |     Devices               |  |
|  |    |   |  QR CODE  |   |      |  |  3. Point your phone at   |  |
|  |    |   |   HERE    |   |      |  |     this QR code          |  |
|  |    |   |           |   |      |  |                           |  |
|  |    |   +-----------+   |      |  |  Session will persist     |  |
|  |    |                   |      |  |  across browser sessions. |  |
|  |    +-------------------+      |  |                           |  |
|  |                               |  |  [Refresh QR]             |  |
|  |  QR expires in 42s [|||||||]  |  |                           |  |
|  |                               |  +---------------------------+  |
|  +-------------------------------+                                 |
|                                                                    |
|  After connecting:                                                 |
|  +--------------------------------------------------------------+ |
|  |  Status: [*] Connected                                        | |
|  |  Phone: +971 50 *** **42                                      | |
|  |  Session uptime: 4d 12h 33m                                   | |
|  |  Last heartbeat: 12s ago                                       | |
|  |  Worker region: Dubai (fly-dxb)                                | |
|  |                                                                | |
|  |  [Reconnect]  [Disconnect]                                     | |
|  +--------------------------------------------------------------+ |
|                                                                    |
+------------------------------------------------------------------+
```

## Status Indicators and Color Coding

The dashboard uses a consistent set of status indicators across all pages. Colors map to the design token system defined in `app/styles.css`.

| Status | Color | CSS Variable | Behavior |
|--------|-------|-------------|----------|
| Connected | Green / teal | `--accent` (#0d7a6a) | Solid dot |
| Healthy | Green / teal | `--accent` (#0d7a6a) | Solid dot |
| Degraded | Amber | `--warning` (#d4a017) | Pulsing dot |
| Disconnected | Red | `--signal` (#e04b2c) | Solid dot |
| Failed | Red | `--signal` (#e04b2c) | Solid dot |
| Syncing | Blue | `--info` (#2563eb) | Animated spinner |
| Pending | Amber | `--warning` (#d4a017) | Pulsing dot |
| Approved | Green / teal | `--accent` (#0d7a6a) | Checkmark icon |
| Rejected | Red | `--signal` (#e04b2c) | X icon |
| Expired | Gray | `--muted` (#9ca3af) | Dimmed, strikethrough |

### Dark Mode Adaptations

In dark mode (`[data-theme="dark"]`), status colors maintain their hue but shift luminosity for contrast against the dark background (`--bg-dark: #1a1a1a`). The accent teal becomes slightly lighter, and the signal red gains brightness to meet WCAG AA contrast requirements.

## Real-Time Subscriptions

The dashboard uses Convex real-time subscriptions to keep data live without polling. The following elements update automatically when backend state changes:

| Page | Element | Convex Subscription |
|------|---------|-------------------|
| Home | Status cards | `workspace.status` |
| Home | Activity feed | `auditEvents.recent` |
| Home | Pending approval count | `approvals.pendingCount` |
| Connect | Connection status | `connector.status` |
| Connect | Heartbeat timestamp | `connector.heartbeat` |
| Connect | QR code (during pairing) | `connector.qrCode` |
| Inbox | Approval queue | `approvals.list` (filtered) |
| Inbox | Approval count badge (nav) | `approvals.pendingCount` |
| Conversations | Chat list | `conversations.list` |
| Conversations | Thread messages | `conversations.messages` |
| Runs | Run list | `runs.list` |
| Runs | Active run state | `runs.byId` (per-run) |
| Runs | Step progress | `runs.steps` |
| Memory | Memory entries | `memory.list` |
| Memory | Confidence scores | `memory.byId` |
| Integrations | Connection statuses | `integrations.status` |
| Settings | Member list | `workspace.members` |

All subscriptions are scoped to the user's workspace ID and filtered by their role. Convex handles connection multiplexing, so opening multiple tabs does not create redundant WebSocket connections.

## Mobile Responsiveness

The dashboard uses the same breakpoint system as the landing page, defined in `app/styles.css`.

| Breakpoint | Width | Layout Changes |
|-----------|-------|---------------|
| Desktop | > 1024px | Sidebar navigation, multi-column cards, full data tables, side-by-side panels |
| Tablet | 641-1024px | Collapsible sidebar (hamburger toggle), two-column card grid, scrollable tables, stacked panels |
| Mobile | <= 640px | Bottom tab navigation (5 primary pages), single-column layout, cards stack vertically, approval actions become full-width buttons, QR code centered, simplified data tables (key columns only) |

### Navigation Adaptation

```
Desktop (> 1024px):
+----------+---------------------------------------------------+
|          |                                                     |
| Sidebar  |  Main content area                                  |
| nav      |                                                     |
| (fixed)  |                                                     |
|          |                                                     |
+----------+---------------------------------------------------+

Tablet (641-1024px):
[=] +-------------------------------------------------------+
    |                                                         |
    |  Main content area (full width)                         |
    |                                                         |
    |  Sidebar slides in as overlay on hamburger tap           |
    |                                                         |
    +-------------------------------------------------------+

Mobile (<= 640px):
+-------------------------------------------------------+
|                                                         |
|  Main content area (full width, more padding)           |
|                                                         |
|                                                         |
+-------------------------------------------------------+
| Home | Inbox | Runs | Memory | More... |   <-- bottom tabs
+-------------------------------------------------------+
```

### RTL Layout (Arabic)

When the language is set to Arabic, the entire layout mirrors horizontally:

- Sidebar moves to the right side on desktop
- Text alignment flips to right-to-left
- Navigation order reverses
- Icons with directional meaning (arrows, chevrons) flip
- Numbers and Latin text remain LTR within the RTL flow (handled by `dir="auto"` on mixed-content elements)
- Font switches from DM Sans to a system Arabic font stack with comparable metrics
