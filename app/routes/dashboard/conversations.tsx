import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/conversations")({
  component: ConversationsPage,
});

function ConversationsPage() {
  return (
    <div className="dash-placeholder">
      <span className="dash-placeholder-icon">◬</span>
      <h1 className="dash-placeholder-title">Conversations</h1>
      <p className="dash-placeholder-sub">Chat threads — coming soon</p>
    </div>
  );
}
