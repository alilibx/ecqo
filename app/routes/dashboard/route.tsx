import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Role = "owner" | "principal" | "operator";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    const { userId, convexClient } = context as {
      userId: string | null;
      convexClient: { query: (fn: any) => Promise<any> };
    };

    if (!userId) {
      throw redirect({ to: "/" });
    }

    const workspaces = await convexClient.query(api.workspaces.list);

    if (!workspaces || workspaces.length === 0) {
      throw redirect({ to: "/" });
    }

    const workspace = workspaces[0]!;

    return {
      workspaceId: workspace._id as Id<"workspaces">,
      workspaceName: workspace.name as string,
      role: workspace.role as Role,
    };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return <Outlet />;
}
