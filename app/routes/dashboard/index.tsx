import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDashboard } from "../../lib/dashboard-context";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (d.toDateString() === new Date(now.getTime() - 86400_000).toDateString()) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function DashboardHome() {
  const { workspaceId, workspaceName } = useDashboard();
  const stats = useQuery(api.dashboard.stats, { workspaceId });
  const recentChats = useQuery(api.dashboard.recentChats, { workspaceId });

  return (
    <div className="dash-home">
      <div className="dash-home-header">
        <h1 className="dash-home-title">{workspaceName}</h1>
        <span className={`dash-home-status ${stats?.connected ? "is-connected" : ""}`}>
          {stats?.connected ? "WhatsApp connected" : "WhatsApp disconnected"}
        </span>
      </div>

      {/* Stats grid */}
      <div className="stat-grid">
        <StatCard
          label="Contacts"
          value={stats?.contactCount ?? "—"}
          sub="unique users"
        />
        <StatCard
          label="Conversations"
          value={stats?.chatCount ?? "—"}
          sub="total chats"
        />
        <StatCard
          label="Messages"
          value={stats?.messageCount ?? "—"}
          sub="all time"
        />
        <StatCard
          label="Agent runs"
          value={stats?.agentRunsToday ?? "—"}
          sub="today"
        />
      </div>

      {/* Recent conversations */}
      <div className="dash-home-section">
        <div className="dash-home-section-header">
          <h2 className="dash-home-section-title">Recent conversations</h2>
          <Link to="/dashboard/conversations" className="dash-home-link">
            View all
          </Link>
        </div>

        {recentChats === undefined ? (
          <div className="dash-home-empty">Loading...</div>
        ) : recentChats.length === 0 ? (
          <div className="dash-home-empty">
            No conversations yet. Connect WhatsApp to get started.
          </div>
        ) : (
          <div className="chat-list">
            {recentChats.map((chat) => (
              <Link
                key={chat._id}
                to="/dashboard/conversations/$chatJid"
                params={{ chatJid: encodeURIComponent(chat.chatJid) }}
                className="chat-list-item"
              >
                <div className="chat-list-avatar">
                  {chat.isGroup ? "G" : (chat.contactName?.[0] ?? chat.chatJid[0] ?? "?")}
                </div>
                <div className="chat-list-info">
                  <span className="chat-list-name">
                    {chat.contactName ?? chat.chatName ?? chat.chatJid.split("@")[0]}
                  </span>
                  <span className="chat-list-meta">
                    {chat.messageCount} messages
                  </span>
                </div>
                {chat.lastMessageAt && (
                  <span className="chat-list-time">{formatTime(chat.lastMessageAt)}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
