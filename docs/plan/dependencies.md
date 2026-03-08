<script setup>
// Diagram 1: Epic-Level Dependency DAG
const dep1Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    { id: "dep1-a", icon: "fa-key", title: "A: Auth/RBAC", subtitle: "A1-A5", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "dep1-b", icon: "fa-plug", title: "B: Connector Lifecycle", subtitle: "B1-B7", row: 1, col: 0, shape: "rect", color: "blue" },
    { id: "dep1-d", icon: "fa-robot", title: "D: Agent Runtime", subtitle: "D1-D6", row: 1, col: 1, shape: "rect", color: "purple" },
    { id: "dep1-j", icon: "fa-credit-card", title: "J: Billing & Stripe", subtitle: "J1-J5", row: 1, col: 2, shape: "rect", color: "amber" },
    { id: "dep1-c", icon: "fa-arrow-right", title: "C: Sync & Ingestion", subtitle: "C1-C7", row: 2, col: 0, shape: "rect", color: "blue" },
    { id: "dep1-e", icon: "fa-microchip", title: "E: Memory System", subtitle: "E1-E6", row: 2, col: 1, shape: "rect", color: "purple" },
    { id: "dep1-f", icon: "fa-gauge", title: "F: Dashboard", subtitle: "F1-F7", row: 2, col: 2, shape: "rect", color: "green" },
    { id: "dep1-g", icon: "fa-link", title: "G: External Integrations", subtitle: "G1-G8", row: 3, col: 0, shape: "rect", color: "indigo" },
    { id: "dep1-h", icon: "fa-shield-halved", title: "H: Security & Observability", subtitle: "H1-H7", row: 4, col: 1, shape: "rect", color: "red" },
    { id: "dep1-i", icon: "fa-list-check", title: "I: QA & Release Readiness", subtitle: "I1-I6", row: 5, col: 1, shape: "rect", color: "gray" },
  ],
  edges: [
    { from: "dep1-a", to: "dep1-b" },
    { from: "dep1-a", to: "dep1-d" },
    { from: "dep1-a", to: "dep1-j" },
    { from: "dep1-b", to: "dep1-c" },
    { from: "dep1-d", to: "dep1-e" },
    { from: "dep1-c", to: "dep1-g" },
    { from: "dep1-e", to: "dep1-g" },
    { from: "dep1-d", to: "dep1-f" },
    { from: "dep1-j", to: "dep1-f" },
    { from: "dep1-g", to: "dep1-h" },
    { from: "dep1-f", to: "dep1-h" },
    { from: "dep1-h", to: "dep1-i" },
  ],
  groups: [],
}

// Diagram 2: Detailed Issue-Level Dependency Graph
const dep2Config = {
  type: "flow",
  direction: "TD",
  nodes: [
    // Epic A
    { id: "dep2-a1", icon: "fa-key", title: "A1", subtitle: "Clerk auth", row: 0, col: 2, shape: "rect", color: "teal" },
    { id: "dep2-a2", icon: "fa-users", title: "A2", subtitle: "Workspace roles", row: 1, col: 2, shape: "rect", color: "teal" },
    { id: "dep2-a3", icon: "fa-shield-halved", title: "A3", subtitle: "RBAC enforcement", row: 2, col: 2, shape: "rect", color: "teal" },
    { id: "dep2-a4", icon: "fa-shield-halved", title: "A4", subtitle: "Route guards", row: 2, col: 3, shape: "rect", color: "teal" },
    { id: "dep2-a5", icon: "fa-list-check", title: "A5", subtitle: "Audit events", row: 3, col: 2, shape: "rect", color: "teal" },
    // Epic B
    { id: "dep2-b1", icon: "fa-database", title: "B1", subtitle: "waAccounts schema", row: 2, col: 0, shape: "rect", color: "blue" },
    { id: "dep2-b2", icon: "fa-plug", title: "B2", subtitle: "Connect API", row: 3, col: 1, shape: "rect", color: "blue" },
    { id: "dep2-b3", icon: "fa-server", title: "B3", subtitle: "Worker lease", row: 3, col: 0, shape: "rect", color: "blue" },
    { id: "dep2-b4", icon: "fa-comments", title: "B4", subtitle: "QR ingest", row: 4, col: 0, shape: "rect", color: "blue" },
    { id: "dep2-b5", icon: "fa-link", title: "B5", subtitle: "Reconnect", row: 5, col: 0, shape: "rect", color: "blue" },
    { id: "dep2-b6", icon: "fa-clock", title: "B6", subtitle: "Heartbeat", row: 4, col: 1, shape: "rect", color: "blue" },
    { id: "dep2-b7", icon: "fa-gauge", title: "B7", subtitle: "Dashboard QR UX", row: 5, col: 1, shape: "rect", color: "blue" },
    // Epic C
    { id: "dep2-c1", icon: "fa-database", title: "C1", subtitle: "Sync schemas", row: 3, col: -1, shape: "rect", color: "cyan" },
    { id: "dep2-c2", icon: "fa-plug", title: "C2", subtitle: "Sync ingest API", row: 3, col: -2, shape: "rect", color: "cyan" },
    { id: "dep2-c3", icon: "fa-circle-check", title: "C3", subtitle: "Idempotency", row: 4, col: -3, shape: "rect", color: "cyan" },
    { id: "dep2-c4", icon: "fa-clock", title: "C4", subtitle: "Scheduler", row: 4, col: -2, shape: "rect", color: "cyan" },
    { id: "dep2-c5", icon: "fa-scale-balanced", title: "C5", subtitle: "Metadata policy", row: 4, col: -1, shape: "rect", color: "cyan" },
    { id: "dep2-c6", icon: "fa-inbox", title: "C6", subtitle: "DLQ", row: 4, col: -4, shape: "rect", color: "cyan" },
    { id: "dep2-c7", icon: "fa-chart-line", title: "C7", subtitle: "Health", row: 5, col: -2, shape: "rect", color: "cyan" },
    // Epic D
    { id: "dep2-d1", icon: "fa-database", title: "D1", subtitle: "Agent schemas", row: 2, col: 4, shape: "rect", color: "purple" },
    { id: "dep2-d2", icon: "fa-gear", title: "D2", subtitle: "State machine", row: 3, col: 4, shape: "rect", color: "purple" },
    { id: "dep2-d3", icon: "fa-scale-balanced", title: "D3", subtitle: "Policy engine", row: 3, col: 5, shape: "rect", color: "purple" },
    { id: "dep2-d4", icon: "fa-inbox", title: "D4", subtitle: "Approval queue", row: 4, col: 5, shape: "rect", color: "purple" },
    { id: "dep2-d5", icon: "fa-arrow-right", title: "D5", subtitle: "Retry", row: 4, col: 3, shape: "rect", color: "purple" },
    { id: "dep2-d6", icon: "fa-chart-line", title: "D6", subtitle: "Traces", row: 4, col: 4, shape: "rect", color: "purple" },
    // Epic E
    { id: "dep2-e1", icon: "fa-database", title: "E1", subtitle: "Memory schema", row: 3, col: 6, shape: "rect", color: "pink" },
    { id: "dep2-e2", icon: "fa-clock", title: "E2", subtitle: "Episodic", row: 4, col: 7, shape: "rect", color: "pink" },
    { id: "dep2-e3", icon: "fa-brain", title: "E3", subtitle: "Semantic", row: 5, col: 7, shape: "rect", color: "pink" },
    { id: "dep2-e4", icon: "fa-magnifying-glass", title: "E4", subtitle: "Retrieval", row: 6, col: 7, shape: "rect", color: "pink" },
    { id: "dep2-e5", icon: "fa-gauge", title: "E5", subtitle: "Pinned UI", row: 4, col: 6, shape: "rect", color: "pink" },
    { id: "dep2-e6", icon: "fa-globe", title: "E6", subtitle: "EN/AR", row: 7, col: 6, shape: "rect", color: "pink" },
    // Epic F
    { id: "dep2-f1", icon: "fa-gauge", title: "F1", subtitle: "Dashboard shell", row: 3, col: 3, shape: "rect", color: "green" },
    { id: "dep2-f2", icon: "fa-gauge", title: "F2", subtitle: "Dashboard page", row: 5, col: 4, shape: "rect", color: "green" },
    { id: "dep2-f3", icon: "fa-gauge", title: "F3", subtitle: "Dashboard page", row: 5, col: -1, shape: "rect", color: "green" },
    { id: "dep2-f4", icon: "fa-gauge", title: "F4", subtitle: "Dashboard page", row: 5, col: 3, shape: "rect", color: "green" },
    { id: "dep2-f5", icon: "fa-microchip", title: "F5", subtitle: "Memory UI", row: 7, col: 7, shape: "rect", color: "green" },
    { id: "dep2-f6", icon: "fa-link", title: "F6", subtitle: "Integrations", row: 7, col: 9, shape: "rect", color: "green" },
    { id: "dep2-f7", icon: "fa-scale-balanced", title: "F7", subtitle: "Policy page", row: 4, col: 8, shape: "rect", color: "green" },
    // Epic G
    { id: "dep2-g1", icon: "fa-link", title: "G1", subtitle: "Calendar connect", row: 4, col: 9, shape: "rect", color: "indigo" },
    { id: "dep2-g2", icon: "fa-magnifying-glass", title: "G2", subtitle: "Cal read", row: 5, col: 9, shape: "rect", color: "indigo" },
    { id: "dep2-g3", icon: "fa-code", title: "G3", subtitle: "Cal write", row: 6, col: 9, shape: "rect", color: "indigo" },
    { id: "dep2-g4", icon: "fa-clock", title: "G4", subtitle: "Reminders", row: 4, col: 10, shape: "rect", color: "indigo" },
    { id: "dep2-g5", icon: "fa-link", title: "G5", subtitle: "Gmail connect", row: 4, col: 11, shape: "rect", color: "indigo" },
    { id: "dep2-g6", icon: "fa-arrow-right", title: "G6", subtitle: "Gmail sync", row: 5, col: 11, shape: "rect", color: "indigo" },
    { id: "dep2-g7", icon: "fa-globe", title: "G7", subtitle: "Travel", row: 7, col: 9, shape: "rect", color: "indigo" },
    { id: "dep2-g8", icon: "fa-message", title: "G8", subtitle: "Meeting briefs", row: 7, col: 8, shape: "rect", color: "indigo" },
    // Epic H
    { id: "dep2-h1", icon: "fa-lock", title: "H1", subtitle: "Encryption", row: 5, col: 10, shape: "rect", color: "red" },
    { id: "dep2-h2", icon: "fa-lock", title: "H2", subtitle: "Signed requests", row: 5, col: 2, shape: "rect", color: "red" },
    { id: "dep2-h3", icon: "fa-list-check", title: "H3", subtitle: "Audit stream", row: 5, col: 5, shape: "rect", color: "red" },
    { id: "dep2-h4", icon: "fa-chart-line", title: "H4", subtitle: "Observability", row: 5, col: 6, shape: "rect", color: "red" },
    { id: "dep2-h5", icon: "fa-chart-line", title: "H5", subtitle: "Observability", row: 6, col: 4, shape: "rect", color: "red" },
    // Epic J
    { id: "dep2-j1", icon: "fa-credit-card", title: "J1", subtitle: "Stripe customer", row: 1, col: 0, shape: "rect", color: "amber" },
    { id: "dep2-j2", icon: "fa-credit-card", title: "J2", subtitle: "Plans", row: 2, col: -1, shape: "rect", color: "amber" },
    { id: "dep2-j3", icon: "fa-credit-card", title: "J3", subtitle: "Billing portal", row: 4, col: 2, shape: "rect", color: "amber" },
    { id: "dep2-j4", icon: "fa-scale-balanced", title: "J4", subtitle: "Plan limits", row: 3, col: -1, shape: "rect", color: "amber" },
    { id: "dep2-j5", icon: "fa-clock", title: "J5", subtitle: "Trial/grace", row: 3, col: -3, shape: "rect", color: "amber" },
  ],
  edges: [
    // A dependencies
    { from: "dep2-a1", to: "dep2-a2" },
    { from: "dep2-a2", to: "dep2-a3" },
    { from: "dep2-a2", to: "dep2-a4" },
    { from: "dep2-a2", to: "dep2-b1" },
    { from: "dep2-a2", to: "dep2-d1" },
    { from: "dep2-a3", to: "dep2-a5" },
    { from: "dep2-a3", to: "dep2-g5" },
    { from: "dep2-a5", to: "dep2-h3" },
    // A4 -> F
    { from: "dep2-a4", to: "dep2-f1" },
    { from: "dep2-f1", to: "dep2-f2" },
    { from: "dep2-f1", to: "dep2-f3" },
    { from: "dep2-f1", to: "dep2-f4" },
    { from: "dep2-f1", to: "dep2-f5" },
    { from: "dep2-f1", to: "dep2-j3" },
    // B dependencies
    { from: "dep2-a3", to: "dep2-b2" },
    { from: "dep2-b1", to: "dep2-b3" },
    { from: "dep2-b3", to: "dep2-b4" },
    { from: "dep2-b3", to: "dep2-b6" },
    { from: "dep2-b4", to: "dep2-b5" },
    { from: "dep2-b4", to: "dep2-h2" },
    { from: "dep2-b4", to: "dep2-b7" },
    { from: "dep2-b6", to: "dep2-c7" },
    // C dependencies
    { from: "dep2-b1", to: "dep2-c1" },
    { from: "dep2-a3", to: "dep2-c2" },
    { from: "dep2-c1", to: "dep2-c5" },
    { from: "dep2-c5", to: "dep2-f3" },
    { from: "dep2-c2", to: "dep2-c3" },
    { from: "dep2-c2", to: "dep2-c4" },
    { from: "dep2-c2", to: "dep2-c6" },
    { from: "dep2-c4", to: "dep2-c7" },
    // D dependencies
    { from: "dep2-d1", to: "dep2-d2" },
    { from: "dep2-d1", to: "dep2-d3" },
    { from: "dep2-d2", to: "dep2-d5" },
    { from: "dep2-d2", to: "dep2-d6" },
    { from: "dep2-d3", to: "dep2-d4" },
    { from: "dep2-d4", to: "dep2-f2" },
    { from: "dep2-d4", to: "dep2-h3" },
    { from: "dep2-d3", to: "dep2-g4" },
    { from: "dep2-d3", to: "dep2-f7" },
    { from: "dep2-d6", to: "dep2-f4" },
    { from: "dep2-d6", to: "dep2-h4" },
    { from: "dep2-d6", to: "dep2-h5" },
    // E dependencies
    { from: "dep2-d1", to: "dep2-e1" },
    { from: "dep2-e1", to: "dep2-e2" },
    { from: "dep2-e2", to: "dep2-e3" },
    { from: "dep2-e3", to: "dep2-e4" },
    { from: "dep2-e4", to: "dep2-e6" },
    { from: "dep2-e4", to: "dep2-f5" },
    { from: "dep2-e4", to: "dep2-g8" },
    { from: "dep2-e1", to: "dep2-e5" },
    { from: "dep2-f4", to: "dep2-e5" },
    // G dependencies
    { from: "dep2-a3", to: "dep2-g1" },
    { from: "dep2-g1", to: "dep2-g2" },
    { from: "dep2-g1", to: "dep2-h1" },
    { from: "dep2-g2", to: "dep2-g3" },
    { from: "dep2-g3", to: "dep2-g7" },
    { from: "dep2-g2", to: "dep2-f6" },
    { from: "dep2-g5", to: "dep2-g6" },
    { from: "dep2-g6", to: "dep2-g8" },
    // J dependencies
    { from: "dep2-a1", to: "dep2-j1" },
    { from: "dep2-j1", to: "dep2-j2" },
    { from: "dep2-j2", to: "dep2-j3" },
    { from: "dep2-j2", to: "dep2-j4" },
    { from: "dep2-j2", to: "dep2-j5" },
    { from: "dep2-a2", to: "dep2-j4" },
  ],
  groups: [
    { label: "Epic A: Auth/RBAC", color: "teal", nodes: ["dep2-a1", "dep2-a2", "dep2-a3", "dep2-a4", "dep2-a5"] },
    { label: "Epic B: Connector Lifecycle", color: "blue", nodes: ["dep2-b1", "dep2-b2", "dep2-b3", "dep2-b4", "dep2-b5", "dep2-b6", "dep2-b7"] },
    { label: "Epic C: Sync & Ingestion", color: "cyan", nodes: ["dep2-c1", "dep2-c2", "dep2-c3", "dep2-c4", "dep2-c5", "dep2-c6", "dep2-c7"] },
    { label: "Epic D: Agent Runtime", color: "purple", nodes: ["dep2-d1", "dep2-d2", "dep2-d3", "dep2-d4", "dep2-d5", "dep2-d6"] },
    { label: "Epic E: Memory System", color: "pink", nodes: ["dep2-e1", "dep2-e2", "dep2-e3", "dep2-e4", "dep2-e5", "dep2-e6"] },
    { label: "Epic F: Dashboard", color: "green", nodes: ["dep2-f1", "dep2-f2", "dep2-f3", "dep2-f4", "dep2-f5", "dep2-f6", "dep2-f7"] },
    { label: "Epic G: External Integrations", color: "indigo", nodes: ["dep2-g1", "dep2-g2", "dep2-g3", "dep2-g4", "dep2-g5", "dep2-g6", "dep2-g7", "dep2-g8"] },
    { label: "Epic H: Security & Observability", color: "red", nodes: ["dep2-h1", "dep2-h2", "dep2-h3", "dep2-h4", "dep2-h5"] },
    { label: "Epic J: Billing & Stripe", color: "amber", nodes: ["dep2-j1", "dep2-j2", "dep2-j3", "dep2-j4", "dep2-j5"] },
  ],
}

// Diagram 3: Critical Path Option 1
const dep3Config = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "dep3-a1", icon: "fa-key", title: "A1", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "dep3-a2", icon: "fa-users", title: "A2", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "dep3-a3", icon: "fa-shield-halved", title: "A3", row: 0, col: 2, shape: "rect", color: "teal" },
    { id: "dep3-d1", icon: "fa-database", title: "D1", row: 0, col: 3, shape: "rect", color: "purple" },
    { id: "dep3-d2", icon: "fa-gear", title: "D2", row: 0, col: 4, shape: "rect", color: "purple" },
    { id: "dep3-e1", icon: "fa-database", title: "E1", row: 0, col: 5, shape: "rect", color: "pink" },
    { id: "dep3-e2", icon: "fa-clock", title: "E2", row: 0, col: 6, shape: "rect", color: "pink" },
    { id: "dep3-e3", icon: "fa-brain", title: "E3", row: 0, col: 7, shape: "rect", color: "pink" },
    { id: "dep3-e4", icon: "fa-magnifying-glass", title: "E4", row: 0, col: 8, shape: "rect", color: "pink" },
    { id: "dep3-e6", icon: "fa-globe", title: "E6", row: 0, col: 9, shape: "rect", color: "pink" },
    { id: "dep3-g8", icon: "fa-message", title: "G8", row: 0, col: 10, shape: "rect", color: "indigo" },
    { id: "dep3-i5", icon: "fa-list-check", title: "I5", row: 0, col: 11, shape: "rect", color: "gray" },
    { id: "dep3-i6", icon: "fa-flag", title: "I6", row: 0, col: 12, shape: "rect", color: "gray" },
  ],
  edges: [
    { from: "dep3-a1", to: "dep3-a2" },
    { from: "dep3-a2", to: "dep3-a3" },
    { from: "dep3-a3", to: "dep3-d1" },
    { from: "dep3-d1", to: "dep3-d2" },
    { from: "dep3-d2", to: "dep3-e1" },
    { from: "dep3-e1", to: "dep3-e2" },
    { from: "dep3-e2", to: "dep3-e3" },
    { from: "dep3-e3", to: "dep3-e4" },
    { from: "dep3-e4", to: "dep3-e6" },
    { from: "dep3-e6", to: "dep3-g8" },
    { from: "dep3-g8", to: "dep3-i5" },
    { from: "dep3-i5", to: "dep3-i6" },
  ],
  groups: [],
}

// Diagram 4: Critical Path Option 2
const dep4Config = {
  type: "flow",
  direction: "LR",
  nodes: [
    { id: "dep4-a1", icon: "fa-key", title: "A1", row: 0, col: 0, shape: "rect", color: "teal" },
    { id: "dep4-a2", icon: "fa-users", title: "A2", row: 0, col: 1, shape: "rect", color: "teal" },
    { id: "dep4-b1", icon: "fa-database", title: "B1", row: 0, col: 2, shape: "rect", color: "blue" },
    { id: "dep4-b3", icon: "fa-server", title: "B3", row: 0, col: 3, shape: "rect", color: "blue" },
    { id: "dep4-b4", icon: "fa-comments", title: "B4", row: 0, col: 4, shape: "rect", color: "blue" },
    { id: "dep4-b5", icon: "fa-link", title: "B5", row: 0, col: 5, shape: "rect", color: "blue" },
    { id: "dep4-h2", icon: "fa-lock", title: "H2", row: 0, col: 6, shape: "rect", color: "red" },
    { id: "dep4-h6", icon: "fa-chart-line", title: "H6", row: 0, col: 7, shape: "rect", color: "red" },
    { id: "dep4-h7", icon: "fa-shield-halved", title: "H7", row: 0, col: 8, shape: "rect", color: "red" },
    { id: "dep4-i2", icon: "fa-list-check", title: "I2", row: 0, col: 9, shape: "rect", color: "gray" },
    { id: "dep4-i6", icon: "fa-flag", title: "I6", row: 0, col: 10, shape: "rect", color: "gray" },
  ],
  edges: [
    { from: "dep4-a1", to: "dep4-a2" },
    { from: "dep4-a2", to: "dep4-b1" },
    { from: "dep4-b1", to: "dep4-b3" },
    { from: "dep4-b3", to: "dep4-b4" },
    { from: "dep4-b4", to: "dep4-b5" },
    { from: "dep4-b5", to: "dep4-h2" },
    { from: "dep4-h2", to: "dep4-h6" },
    { from: "dep4-h6", to: "dep4-h7" },
    { from: "dep4-h7", to: "dep4-i2" },
    { from: "dep4-i2", to: "dep4-i6" },
  ],
  groups: [],
}
</script>

# Dependency Graph

This document maps the dependency relationships across all 10 epics and 64 issues, identifies the critical path, and highlights parallelization opportunities for a solo developer.

## Epic-Level Dependency DAG

<ArchDiagram :config="dep1Config" />

## Detailed Issue-Level Dependency Graph

<ArchDiagram :config="dep2Config" />

## Critical Path

The longest dependency chain determines the minimum possible project duration. Two candidates:

**Critical Path Option 1 (Agent + Memory + Meeting Briefs):**
Total: 12 issues, ~62 SP (longest chain)

<ArchDiagram :config="dep3Config" />

**Critical Path Option 2 (Connector + Security + QA):**
Total: 10 issues, ~46 SP (shorter but high-risk)

<ArchDiagram :config="dep4Config" />

**Critical path is Option 1.** The chain from auth through agent runtime, memory, and advanced integrations (meeting briefs) is the longest. Any delay on D2, E3, or E4 pushes the entire project.

| Rank | ID | Why it is critical |
|------|----|--------------------|
| 1 | A1 | Everything depends on auth |
| 2 | A2 | Workspace roles unlock B1, D1, E1, J |
| 3 | D1 | Agent schemas unlock state machine |
| 4 | D2 | State machine unlocks memory + traces |
| 5 | E3 | Semantic extraction is hardest ML task |
| 6 | E4 | Retrieval composer gates G8 + F5 |

## Parallelization Opportunities

As a solo developer, true parallelism is impossible, but context-switching between loosely coupled workstreams is efficient when one stream is blocked or needs a mental break.

| Stream A | Stream B | Why they parallelize |
|----------|----------|---------------------|
| B (Connector) | D (Agent runtime) | Share only A as ancestor; no direct dependency until H1 |
| C (Sync) | E (Memory) | C produces data that E consumes, but E1-E3 can be stubbed with test data |
| J (Billing) | B/C (WA stack) | J depends only on A1; fully independent of connector work |
| F (Dashboard) | G (Integrations) | F consumes G outputs but F1 shell can be built before G delivers data |
| H (Security) | I (QA) | H must finish first, but H1-H2 can run alongside M1 connector work |

**Recommended context-switching pattern per week:**

```
Week 1 (M0):   A  ================>  (focus: auth + schemas)
                B1, D1  =====>       (schema stubs in parallel)

Week 2 (M1a):  B2-B4  ============> (AM: connector work)
                C1-C3  ============> (PM: sync pipeline)

Week 3 (M1b):  B5-B7  ============> (AM: connector polish)
                C4-C5, H1-H2  ====> (PM: sync + security)

Week 4 (M2a):  D2-D4  ============> (AM: orchestration)
                J1-J3  ============> (PM: billing)
                F1     ============> (evening: dashboard shell)

Week 5 (M2b):  E1-E4  ============> (AM: memory system)
                G1-G3  ============> (PM: calendar integration)
                F2-F4  ============> (evening: dashboard pages)

Week 6 (M3):   H3-H7  ============> (AM: security hardening)
                I1-I6  ============> (PM: testing + gate check)
                G5-G6  ============> (if time permits)
```

## Dependency Table

| Epic | Depends On | Blocks | Risk Level |
|---|---|---|---|
| **A** (Auth) | None | B, C, D, E, F, G, H, I, J | **Critical** -- delays cascade everywhere |
| **B** (Connector) | A | C, F, H, I | **High** -- external API risk (Meta/WhatsApp) |
| **C** (Sync) | A, B | E (indirectly), F, G, H, I | **High** -- data integrity is foundational |
| **D** (Runtime) | A | E, F, G, H, I | **High** -- core product value |
| **E** (Memory) | A, D | F, G (G8), I | **Medium** -- can degrade gracefully |
| **F** (Dashboard) | A, D, E, C, G | I | **Medium** -- UI can be iterative |
| **G** (Integrations) | A, D | F, H, I | **Medium** -- G5-G8 are deferrable |
| **H** (Security) | A, B, C, D | I | **High** -- pilot safety requirement |
| **I** (QA) | All | None (terminal) | **Medium** -- scoped by what ships |
| **J** (Billing) | A | F (J3) | **Low** -- Stripe is well-documented |
