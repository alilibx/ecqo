# Connect WhatsApp

## Overview

The WhatsApp connection flow links a user's personal WhatsApp account to Ecqqo so the agent can read and act on their conversations. This uses the **wacli** library (an unofficial WhatsApp Web client) running on a dedicated Fly.io Machine per user. The flow mirrors how WhatsApp Web works: the user scans a QR code from the Linked Devices screen on their phone, and the wacli instance authenticates as a linked device.

The entire flow is orchestrated through Convex, which manages session state, relays QR codes to the dashboard in real time, and records the connection outcome.

## Sequence Diagram

<script setup>
const connectSeqConfig = {
  type: "sequence",
  actors: [
    { id: "cw-dash", icon: "fa-gauge", title: "Dashboard", subtitle: "Browser", color: "teal" },
    { id: "cw-convex", icon: "si:convex", title: "Convex", color: "warm" },
    { id: "cw-worker", icon: "si:flydotio", title: "Fly.io Worker", subtitle: "wacli", color: "red" },
  ],
  steps: [
    { from: "cw-dash", to: "cw-convex", label: "Click 'Connect WhatsApp'" },
    { over: "cw-convex", note: "Create waConnectSession (created)" },
    { from: "cw-convex", to: "cw-worker", label: "Allocate Machine + start auth" },
    { over: "cw-worker", note: "wacli generates QR code" },
    { from: "cw-worker", to: "cw-convex", label: "QR_READY event (signed)" },
    { over: "cw-convex", note: "Update session (qr_ready)\nqrData = base64" },
    { from: "cw-convex", to: "cw-dash", label: "Real-time push: QR code" },
    { over: "cw-dash", note: "User scans QR from\nWhatsApp Linked Devices" },
    { from: "cw-worker", to: "cw-convex", label: "SCANNED event (signed)" },
    { over: "cw-convex", note: "Update session (scanned)" },
    { from: "cw-worker", to: "cw-convex", label: "CONNECTED event (signed)" },
    { over: "cw-convex", note: "Update session (connected)\nStore auth credentials\nCreate waAccount record" },
    { from: "cw-convex", to: "cw-dash", label: "Dashboard shows 'Connected'" },
  ],
  groups: [
    { label: "QR Generation", color: "warm", from: 2, to: 6 },
    { label: "Authentication", color: "teal", from: 7, to: 12 },
  ],
}

const sessionStateConfig = {
  type: "state",
  states: [
    { id: "cw-s-start", shape: "initial", row: 0, col: 1 },
    { id: "cw-s-created", icon: "fa-plus", title: "created", row: 1, col: 1, color: "warm" },
    { id: "cw-s-qr", icon: "fa-qrcode", title: "qr_ready", subtitle: "Machine allocated", row: 2, col: 1, color: "teal" },
    { id: "cw-s-scanned", icon: "fa-camera", title: "scanned", subtitle: "QR scanned", row: 3, col: 1, color: "teal" },
    { id: "cw-s-retry", icon: "fa-rotate", title: "retry_pending", subtitle: "wacli error", row: 2, col: 2, color: "blue" },
    { id: "cw-s-connected", icon: "fa-circle-check", title: "connected", row: 4, col: 0, color: "dark" },
    { id: "cw-s-expired", icon: "fa-hourglass", title: "expired", subtitle: "60s timeout", row: 4, col: 1, color: "red" },
    { id: "cw-s-failed", icon: "fa-circle-xmark", title: "failed", subtitle: "Max retries (>= 3)", row: 4, col: 2, color: "red" },
    { id: "cw-s-end", shape: "final", row: 5, col: 1 },
  ],
  transitions: [
    { from: "cw-s-start", to: "cw-s-created" },
    { from: "cw-s-created", to: "cw-s-qr", label: "Machine allocated" },
    { from: "cw-s-qr", to: "cw-s-scanned", label: "QR scanned" },
    { from: "cw-s-qr", to: "cw-s-expired", label: "Timeout 60s" },
    { from: "cw-s-qr", to: "cw-s-retry", label: "wacli error" },
    { from: "cw-s-scanned", to: "cw-s-connected", label: "Auth completes" },
    { from: "cw-s-retry", to: "cw-s-qr", label: "< 3 retries", dashed: true },
    { from: "cw-s-retry", to: "cw-s-failed", label: "Max retries" },
    { from: "cw-s-connected", to: "cw-s-end" },
    { from: "cw-s-expired", to: "cw-s-end" },
    { from: "cw-s-failed", to: "cw-s-end" },
  ],
  groups: [
    { label: "QR Authentication", color: "teal", states: ["cw-s-qr", "cw-s-scanned"] },
  ],
}
</script>

<ArchDiagram :config="connectSeqConfig" />

## Session State Machine

<ArchDiagram :config="sessionStateConfig" />

## State Transition Table

| From State        | To State         | Trigger                          | Side Effects                                               |
|-------------------|------------------|----------------------------------|------------------------------------------------------------|
| `created`         | `qr_ready`       | Worker emits `QR_READY` event    | QR data stored on session; dashboard subscription fires    |
| `qr_ready`        | `scanned`        | Worker emits `SCANNED` event     | Dashboard updates to "Confirming..."                       |
| `qr_ready`        | `expired`        | 60s timeout, no scan             | Worker stopped; user prompted to retry                     |
| `qr_ready`        | `retry_pending`  | Worker error during QR display   | Error logged; retry counter incremented                    |
| `scanned`         | `connected`      | Worker emits `CONNECTED` event   | Auth credentials stored; `waAccount` record created/updated; Fly.io Machine kept alive |
| `retry_pending`   | `qr_ready`       | Retry attempt (< 3 retries)     | New QR generated by worker; retry counter incremented      |
| `retry_pending`   | `failed`         | Max retries exceeded (>= 3)     | Worker terminated; Fly.io Machine released                 |

## Failure Handling

### QR Timeout

The QR code is valid for approximately 60 seconds (WhatsApp's native timeout). If the user does not scan within this window:

- The session transitions to `expired`.
- The Fly.io Machine is stopped to avoid resource waste.
- The dashboard shows "QR expired" with a "Try Again" button.
- Clicking "Try Again" creates a new `waConnectSession` and restarts the flow.

### Worker Crash

If the wacli worker process crashes or the Fly.io Machine becomes unreachable:

- Convex detects the failure via a missed heartbeat (15s interval) or a signed `ERROR` event.
- The session moves to `retry_pending`.
- Up to 3 automatic retries are attempted, each allocating a fresh Fly.io Machine.
- If all retries fail, the session transitions to `failed` and the user is notified.

### Re-auth Required

WhatsApp may revoke a linked device session at any time (e.g., user removes linked device from phone, WhatsApp server-side revocation). When this happens:

- The wacli worker detects the disconnection and emits a `DISCONNECTED` event.
- The `waAccount` status is set to `disconnected`.
- The dashboard shows a "Reconnect WhatsApp" prompt.
- The user must repeat the full QR scanning flow.

## User-Visible Status Values

| Status           | Dashboard Display               | Meaning                                                     |
|------------------|---------------------------------|-------------------------------------------------------------|
| `not_connected`  | "Connect WhatsApp" button       | No WhatsApp account linked yet                              |
| `connecting`     | Spinner + "Connecting..."       | Session created, waiting for QR                             |
| `scan_qr`       | QR code displayed               | QR ready, waiting for user to scan                          |
| `confirming`     | "Confirming..." with spinner    | QR scanned, completing auth handshake                       |
| `connected`      | Green checkmark + phone number  | WhatsApp linked and active                                  |
| `disconnected`   | Yellow warning + "Reconnect"    | Previously connected but session revoked                    |
| `failed`         | Red error + "Try Again"         | Connection failed after retries                             |
