import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/inbox")({
  component: InboxPage,
});

function InboxPage() {
  return (
    <div className="dash-placeholder">
      <span className="dash-placeholder-icon">▤</span>
      <h1 className="dash-placeholder-title">Inbox</h1>
      <p className="dash-placeholder-sub">Approval queue — coming soon</p>
    </div>
  );
}
