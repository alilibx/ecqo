import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useAction } from "convex/react";
import { useState, useEffect, useCallback } from "react";
import { api } from "../../../convex/_generated/api";
import { useDashboard } from "../../lib/dashboard-context";

export const Route = createFileRoute("/dashboard/connect")({
  component: ConnectPage,
});

function ConnectPage() {
  const { workspaceId } = useDashboard();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = useQuery(api.connector.getActiveSession, { workspaceId });
  const account = useQuery(
    api.connector.getAccount,
    session?.status === "connected" && session._id
      ? { sessionId: String(session._id), workspaceId }
      : "skip",
  );

  const requestConnection = useAction(api.connector.requestConnection);
  const requestDisconnect = useAction(api.connector.requestDisconnect);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await requestConnection({ workspaceId });
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start connection");
    } finally {
      setConnecting(false);
    }
  }, [requestConnection, workspaceId]);

  const handleDisconnect = useCallback(async () => {
    if (!session) return;
    setConnecting(true);
    setError(null);
    try {
      await requestDisconnect({ workspaceId, sessionId: session._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setConnecting(false);
    }
  }, [requestDisconnect, workspaceId, session]);

  const isConnected = session?.status === "connected" && account;
  const hasQR = session?.status === "qr_ready" && session.qrCode;
  const canRetry =
    session?.status === "expired" || session?.status === "failed";
  const noSession = !session || session.status === "disconnected";

  if (isConnected && account) {
    return (
      <ConnectedView
        account={account}
        onDisconnect={handleDisconnect}
        disconnecting={connecting}
      />
    );
  }

  return (
    <div className="connect-page">
      <div className="connect-grid">
        <div className="connect-qr-panel">
          {hasQR ? (
            <>
              <div className="qr-container">
                <img
                  src={session.qrCode!}
                  alt="WhatsApp QR Code"
                  className="qr-image"
                />
              </div>
              <QRCountdown expiresAt={session.expiresAt} />
            </>
          ) : session?.status === "scanned" ? (
            <div className="qr-status-box">
              <div className="status-dot status-dot--syncing" />
              <p className="qr-status-text">Connecting...</p>
              <p className="qr-status-sub">QR scanned, completing setup</p>
            </div>
          ) : session?.status === "created" ? (
            <div className="qr-status-box">
              <div className="qr-placeholder" />
              <p className="qr-status-text">Generating QR code...</p>
              <p className="qr-status-sub">Starting WhatsApp session</p>
            </div>
          ) : canRetry ? (
            <div className="qr-status-box">
              <div className="status-dot status-dot--error" />
              <p className="qr-status-text">
                {session.status === "expired"
                  ? "QR Expired"
                  : "Connection Failed"}
              </p>
              {session.errorMessage && (
                <p className="qr-status-sub">{session.errorMessage}</p>
              )}
              <button
                className="connect-btn"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? "Retrying..." : "Try Again"}
              </button>
            </div>
          ) : (
            <div className="qr-status-box">
              <div className="qr-placeholder" />
              <p className="qr-status-text">No active session</p>
              <p className="qr-status-sub">
                Connect your WhatsApp to get started
              </p>
            </div>
          )}
        </div>

        <div className="connect-info-panel">
          <h2 className="connect-title">Connect WhatsApp</h2>
          <div className="connect-status-row">
            <div
              className={`status-dot ${
                hasQR || session?.status === "scanned"
                  ? "status-dot--syncing"
                  : session?.status === "created"
                    ? "status-dot--syncing"
                    : "status-dot--disconnected"
              }`}
            />
            <span className="connect-status-label">
              {hasQR
                ? "Scan QR Code"
                : session?.status === "scanned"
                  ? "Completing setup..."
                  : session?.status === "created"
                    ? "Starting..."
                    : "Disconnected"}
            </span>
          </div>

          <ol className="connect-steps">
            <li>Open WhatsApp on your phone</li>
            <li>
              Tap <strong>Menu</strong> &gt; <strong>Linked Devices</strong>
            </li>
            <li>Point your phone at the QR code</li>
          </ol>

          {noSession && (
            <button
              className="connect-btn connect-btn--primary"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? "Starting..." : "Connect WhatsApp"}
            </button>
          )}

          {error && <p className="connect-error">{error}</p>}

          <p className="connect-note">
            Session will persist across browser sessions.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectedView({
  account,
  onDisconnect,
  disconnecting,
}: {
  account: {
    phoneNumber?: string;
    pushName?: string;
    connectedAt?: number;
    lastHeartbeat?: number;
    machineId?: string;
    status: string;
  };
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="connect-page">
      <div className="connected-card">
        <h2 className="connect-title">WhatsApp Connected</h2>

        <div className="connected-details">
          <div className="connected-row">
            <div className="status-dot status-dot--connected" />
            <span className="connected-status">Connected</span>
          </div>

          {account.phoneNumber && (
            <div className="connected-row">
              <span className="connected-label">Phone</span>
              <span className="connected-value">
                {maskPhone(account.phoneNumber)}
              </span>
            </div>
          )}

          {account.pushName && (
            <div className="connected-row">
              <span className="connected-label">Name</span>
              <span className="connected-value">{account.pushName}</span>
            </div>
          )}

          {account.connectedAt && (
            <div className="connected-row">
              <span className="connected-label">Uptime</span>
              <span className="connected-value">
                {formatDuration(now - account.connectedAt)}
              </span>
            </div>
          )}

          {account.lastHeartbeat && (
            <div className="connected-row">
              <span className="connected-label">Last heartbeat</span>
              <span className="connected-value">
                {formatAgo(now - account.lastHeartbeat)}
              </span>
            </div>
          )}

          {account.machineId && (
            <div className="connected-row">
              <span className="connected-label">Worker</span>
              <span className="connected-value mono">
                {account.machineId}
              </span>
            </div>
          )}
        </div>

        <button
          className="connect-btn connect-btn--danger"
          onClick={onDisconnect}
          disabled={disconnecting}
        >
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    </div>
  );
}

function QRCountdown({ expiresAt }: { expiresAt?: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!expiresAt) return null;

  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const total = 60;
  const pct = Math.max(0, (remaining / total) * 100);

  return (
    <div className="qr-countdown">
      <div className="qr-countdown-bar">
        <div
          className="qr-countdown-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="qr-countdown-text">
        {remaining > 0 ? `QR expires in ${remaining}s` : "QR expired"}
      </span>
    </div>
  );
}

// -- Helpers --

function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  const last2 = phone.slice(-2);
  const prefix = phone.slice(0, phone.length - 6);
  return `${prefix} *** **${last2}`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60) % 60;
  const h = Math.floor(s / 3600) % 24;
  const d = Math.floor(s / 86400);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
