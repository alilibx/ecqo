import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDashboard } from "../../lib/dashboard-context";

export const Route = createFileRoute("/dashboard/conversations/")({
  component: ConversationsIndex,
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

function ConversationsIndex() {
  const { workspaceId } = useDashboard();
  const chats = useQuery(api.dashboard.listChats, { workspaceId });

  return (
    <div className="conversations-page">
      <div className="conversations-header">
        <h1 className="conversations-title">Conversations</h1>
        {chats && <span className="conversations-count">{chats.length} chats</span>}
      </div>

      {chats === undefined ? (
        <div className="dash-home-empty">Loading conversations...</div>
      ) : chats.length === 0 ? (
        <div className="dash-home-empty">
          No conversations yet. Messages will appear here once WhatsApp is connected and users start chatting.
        </div>
      ) : (
        <div className="chat-list">
          {chats.map((chat) => (
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
                <span className="chat-list-preview">
                  {chat.lastMessageFromMe && <span className="chat-list-you">You: </span>}
                  {chat.lastMessagePreview ?? (chat.lastMessageType ? `[${chat.lastMessageType}]` : "No messages")}
                </span>
              </div>
              <div className="chat-list-right">
                {chat.lastMessageAt && (
                  <span className="chat-list-time">{formatTime(chat.lastMessageAt)}</span>
                )}
                <span className="chat-list-badge">{chat.messageCount}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
