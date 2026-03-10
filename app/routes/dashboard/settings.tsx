import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="dash-placeholder">
      <span className="dash-placeholder-icon">⚙</span>
      <h1 className="dash-placeholder-title">Settings</h1>
      <p className="dash-placeholder-sub">Workspace, members &amp; billing — coming soon</p>
    </div>
  );
}
