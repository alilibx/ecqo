import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Ecqqo Dashboard</h1>
      <p>Welcome to your dashboard.</p>
    </div>
  );
}
