import { createContext, useContext } from "react";
import type { Id } from "../../convex/_generated/dataModel";

type Role = "owner" | "principal" | "operator";

interface DashboardContextValue {
  workspaceId: Id<"workspaces">;
  workspaceName: string;
  role: Role;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const DashboardProvider = DashboardContext.Provider;

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
