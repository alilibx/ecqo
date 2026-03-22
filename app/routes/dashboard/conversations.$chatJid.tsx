import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useRef, useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { useDashboard } from "../../lib/dashboard-context";

export const Route = createFileRoute("/dashboard/conversations/$chatJid")({
  component: ConversationDetail,
});

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function ConversationDetail() {
  const { chatJid: rawChatJid } = Route.useParams();
  const chatJid = decodeURIComponent(rawChatJid);
  const { workspaceId } = useDashboard();
  const data = useQuery(api.dashboard.listMessages, { workspaceId, chatJid });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  const contact = data?.contact;
  const messages = data?.messages ?? [];
  const displayName = contact?.name ?? chatJid.split("@")[0];

  // Group messages by date
  const dateGroups: { date: string; messages: typeof messages }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const d = formatDate(msg.timestamp);
    if (d !== currentDate) {
      currentDate = d;
      dateGroups.push({ date: d, messages: [] });
    }
    dateGroups[dateGroups.length - 1].messages.push(msg);
  }

  return (
    <div className="conv-detail">
      {/* Header */}
      <div className="conv-header">
        <Link to="/dashboard/conversations" className="conv-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className="conv-header-avatar">
          {displayName[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="conv-header-info">
          <span className="conv-header-name">{displayName}</span>
          {contact && (
            <span className="conv-header-phone">+{contact.phone}</span>
          )}
        </div>
      </div>

      {/* Messages + sidebar layout */}
      <div className="conv-body">
        {/* Message thread */}
        <div className="conv-messages">
          {data === undefined ? (
            <div className="dash-home-empty">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="dash-home-empty">No messages in this conversation.</div>
          ) : (
            dateGroups.map((group) => (
              <div key={group.date}>
                <div className="conv-date-sep">
                  <span>{group.date}</span>
                </div>
                {group.messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`conv-bubble ${msg.fromMe ? "is-outgoing" : "is-incoming"}`}
                  >
                    {msg.senderJid === "agent" && (
                      <span className="conv-bubble-agent">Ecqqo</span>
                    )}
                    {msg.type !== "text" && !msg.text ? (
                      <span className="conv-bubble-media">[{msg.type}]</span>
                    ) : (
                      <span className="conv-bubble-text">{msg.text}</span>
                    )}
                    <span className="conv-bubble-time">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Contact sidebar */}
        {contact && (
          <aside className="conv-sidebar">
            <div className="conv-sidebar-avatar">
              {displayName[0]?.toUpperCase() ?? "?"}
            </div>
            <h3 className="conv-sidebar-name">{displayName}</h3>
            <dl className="conv-sidebar-details">
              <dt>Phone</dt>
              <dd>+{contact.phone}</dd>
              <dt>Language</dt>
              <dd>{contact.locale === "ar" ? "Arabic" : "English"}</dd>
              <dt>Messages</dt>
              <dd>{contact.messageCount}</dd>
              <dt>First seen</dt>
              <dd>{new Date(contact.firstSeenAt).toLocaleDateString()}</dd>
              <dt>Last seen</dt>
              <dd>{new Date(contact.lastSeenAt).toLocaleDateString()}</dd>
            </dl>
          </aside>
        )}
      </div>
    </div>
  );
}
