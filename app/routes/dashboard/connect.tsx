import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { useDashboard } from "../../lib/dashboard-context";

export const Route = createFileRoute("/dashboard/connect")({
  component: ConnectPage,
});

function ConnectPage() {
  const { workspaceId } = useDashboard();

  const session = useQuery(api.connector.getActiveSession, { workspaceId });
  const account = useQuery(
    api.connector.getAccount,
    session?.status === "connected" && session._id
      ? { sessionId: String(session._id), workspaceId }
      : "skip",
  );

  const isConnected = session?.status === "connected" && account;
  const hasQR =
    session?.status === "qr_ready" && session.qrCode;

  if (isConnected && account) {
    return <ConnectedView account={account} />;
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
          ) : session?.status === "expired" || session?.status === "failed" ? (
            <div className="qr-status-box">
              <div className="status-dot status-dot--error" />
              <p className="qr-status-text">
                {session.status === "expired" ? "QR Expired" : "Connection Failed"}
              </p>
              {session.errorMessage && (
                <p className="qr-status-sub">{session.errorMessage}</p>
              )}
            </div>
          ) : (
            <div className="qr-status-box">
              <div className="qr-placeholder" />
              <p className="qr-status-text">Waiting for QR code...</p>
              <p className="qr-status-sub">
                {session ? "Generating..." : "No active session"}
              </p>
            </div>
          )}
        </div>

        <div className="connect-info-panel">
          <h2 className="connect-title">Connect WhatsApp</h2>
          <div className="connect-status-row">
            <div className="status-dot status-dot--disconnected" />
            <span className="connect-status-label">Disconnected</span>
          </div>

          <ol className="connect-steps">
            <li>Open WhatsApp on your phone</li>
            <li>
              Tap <strong>Menu</strong> &gt; <strong>Linked Devices</strong>
            </li>
            <li>Point your phone at the QR code</li>
          </ol>

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
}: {
  account: {
    phoneNumber?: string;
    pushName?: string;
    connectedAt?: number;
    lastHeartbeat?: number;
    machineId?: string;
    status: string;
  };
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

// ── Helpers ──

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
