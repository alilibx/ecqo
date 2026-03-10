import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/integrations")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <div className="dash-placeholder">
      <span className="dash-placeholder-icon">⊞</span>
      <h1 className="dash-placeholder-title">Integrations</h1>
      <p className="dash-placeholder-sub">Connected services — coming soon</p>
    </div>
  );
}
