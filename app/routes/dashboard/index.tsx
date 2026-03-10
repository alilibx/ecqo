import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { role, workspaceName } = Route.useRouteContext();
  return (
    <div>
      <h1>{workspaceName}</h1>
      <p>Role: {role}</p>
    </div>
  );
}
