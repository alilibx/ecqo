import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/policy")({
  component: PolicyPage,
});

function PolicyPage() {
  return (
    <div className="dash-placeholder">
      <span className="dash-placeholder-icon">⊘</span>
      <h1 className="dash-placeholder-title">Policy</h1>
      <p className="dash-placeholder-sub">Approval rules &amp; quiet hours — coming soon</p>
    </div>
  );
}
