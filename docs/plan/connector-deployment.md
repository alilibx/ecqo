# Connector Deployment

The WhatsApp connector runs on Fly.io as a multi-user supervisor process managing isolated Baileys worker sessions.

## Fly.io App

| Setting | Value |
|---------|-------|
| App name | `ecqqo-connector` |
| Region | `ams` (Amsterdam) |
| VM size | `shared-cpu-1x`, 1024 MB RAM |
| `auto_stop_machines` | `off` |
| `min_machines_running` | `1` |
| Estimated cost | ~$5/mo per machine (shared-cpu-1x, 1024 MB) |
| Estimated capacity | 20-50 users per machine |

## Deploy Command

Manual deploys from the repo root:

```bash
fly deploy --config services/connector/fly.toml --dockerfile services/connector/Dockerfile .
```

The build context is the repo root (`.`) so that `shared/` packages are available during the Docker build.

## CI/CD

Auto-deploys are handled by GitHub Actions via `.github/workflows/deploy-connector.yml`. The workflow triggers on push to `main` when files change in:

- `services/connector/`
- `shared/`
- `convex/`

### Required Secrets

| Secret | Where | Purpose |
|--------|-------|---------|
| `FLY_API_TOKEN` | GitHub Actions secrets | Authenticates `flyctl` for deployment |
| `CONVEX_URL` | Fly.io app secrets (`fly secrets set`) | Convex deployment URL for the supervisor to call backend APIs |

## Monitoring

View live logs:

```bash
fly logs -a ecqqo-connector
```

Health check (returns machine stats, active workers, memory usage):

```bash
curl https://ecqqo-connector.fly.dev/health
```

## Session Restoration on Restart

When a machine restarts (due to deploy, crash, or Fly.io maintenance), the supervisor automatically restores sessions:

1. On startup, scans `/tmp/wa-auth/` for existing auth directories.
2. Spawns a worker for each found session using persisted credentials.
3. Workers reconnect to WhatsApp without requiring a new QR scan.
4. Reports restored session status back to Convex.

This makes deploys transparent to end users — sessions resume within seconds as long as WhatsApp has not revoked the linked device.

## Machine Configuration

Key `fly.toml` settings:

- `auto_stop_machines = "off"` — machines must stay running to maintain persistent WhatsApp WebSocket connections.
- `min_machines_running = 1` — ensures at least one machine is always available for new sessions.
- Internal port `8080` — supervisor HTTP API for session management and health reporting.

## Scaling

To add capacity, scale horizontally by adding machines:

```bash
fly scale count 2 -a ecqqo-connector
```

Convex's `waMachines` table tracks each machine's health and worker count. New sessions are assigned to the least-loaded active machine via the `getAvailableMachine` query.

## Tigris S3 Auth State Storage

Auth credentials are persisted to Tigris (Fly.io's S3-compatible object storage) so that sessions are not tied to a specific machine or volume.

### Setup

Create a Tigris bucket attached to the Fly app:

```bash
fly storage create -a ecqqo-connector
```

This automatically sets the following secrets on the Fly app:

| Env Var | Purpose |
|---------|---------|
| `AWS_ENDPOINT_URL_S3` | Tigris S3 endpoint |
| `AWS_ACCESS_KEY_ID` | Tigris access key |
| `AWS_SECRET_ACCESS_KEY` | Tigris secret key |
| `BUCKET_NAME` | Tigris bucket name |

### How It Works

Auth files are synced to and from Tigris at key lifecycle points:

1. **Session start** — Downloads all auth files from Tigris into the local `/tmp/wa-auth/{sessionId}/` directory before Baileys connects.
2. **Credential updates** — On every `creds.update` event from Baileys, the updated auth files are incrementally uploaded to Tigris.
3. **Session stop** — Performs a final sync of all auth files to Tigris before the worker shuts down.

Local tmpfs (`/tmp/wa-auth/`) is still used for fast Baileys I/O during the session. Tigris serves as the durable backing store.

### S3 Key Structure

Files are stored under a per-session prefix:

```
auth/{sessionId}/{filename}
```

For example: `auth/user_abc123/creds.json`, `auth/user_abc123/app-state-sync-key-AABBCCDD.json`.

### Benefits

- **Machine portability** — Sessions can be restored on any machine, not tied to a specific Fly volume.
- **Horizontal scaling** — New machines pull auth state on demand; no need to migrate volumes.
- **Machine replacement** — Fly.io can destroy and recreate machines freely without losing session state.
- **Zero-downtime deploys** — Combined with the existing session restoration logic, deploys remain transparent to users.

### Local Development Fallback

The sync logic checks whether Tigris is configured (`isTigrisConfigured`). When the `AWS_ENDPOINT_URL_S3` env var is not set (e.g., local dev), Tigris sync is skipped entirely and auth files are only stored on the local filesystem. No additional setup is needed for local development.

### Key File

The sync implementation lives in `services/connector/src/auth-sync.ts`.
