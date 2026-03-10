import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/runs")({
  component: RunsPage,
});

function RunsPage() {
  return (
    <div className="dash-placeholder">
      <span className="dash-placeholder-icon">▶</span>
      <h1 className="dash-placeholder-title">Runs</h1>
      <p className="dash-placeholder-sub">Agent run explorer — coming soon</p>
    </div>
  );
}
