import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/memory")({
  component: MemoryPage,
});

function MemoryPage() {
  return (
    <div className="dash-placeholder">
      <span className="dash-placeholder-icon">◈</span>
      <h1 className="dash-placeholder-title">Memory</h1>
      <p className="dash-placeholder-sub">Memory browser — coming soon</p>
    </div>
  );
}
