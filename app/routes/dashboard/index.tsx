import { createFileRoute } from "@tanstack/react-router";
import { useDashboard } from "../../lib/dashboard-context";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { workspaceName } = useDashboard();

  return (
    <div>
      <h1 style={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 700, fontSize: '1.5rem', margin: 0, marginBottom: 8 }}>
        {workspaceName}
      </h1>
      <p style={{ color: 'var(--muted)', margin: 0 }}>
        Overview — coming soon
      </p>
    </div>
  );
}
