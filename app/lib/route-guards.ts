import { redirect } from "@tanstack/react-router";
import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Role = "owner" | "principal" | "operator";

/**
 * Role-page access matrix from docs/dashboard/information-architecture.md.
 *
 * Each key maps to the roles that can access that dashboard section.
 * "all" is a shorthand for all three roles.
 */
export const PAGE_ACCESS: Record<string, readonly Role[]> = {
  home: ["owner", "principal", "operator"],
  connect: ["owner", "principal"],
  inbox: ["owner", "principal", "operator"],
  conversations: ["owner", "principal", "operator"],
  runs: ["owner", "principal", "operator"],
  memory: ["owner", "principal", "operator"],
  integrations: ["owner", "principal", "operator"],
  policy: ["owner", "principal", "operator"],
  settings: ["owner", "principal"],
} as const;

/**
 * Check if a role can access a given dashboard page.
 */
export function canAccess(page: string, role: Role): boolean {
  const allowed = PAGE_ACCESS[page];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Get all pages a role can access (for nav filtering).
 */
export function getAccessiblePages(role: Role): string[] {
  return Object.entries(PAGE_ACCESS)
    .filter(([, roles]) => roles.includes(role))
    .map(([page]) => page);
}

/**
 * Route guard for dashboard pages. Call in beforeLoad() to enforce auth + RBAC.
 *
 * - Redirects to "/" if not authenticated
 * - Redirects to "/dashboard" if user lacks the required role for the page
 *
 * Returns the user's role and workspaceId for use in loaders.
 */
export async function requireDashboardRole(opts: {
  convexClient: ConvexReactClient;
  userId: string | null;
  page: string;
}): Promise<{ role: Role; workspaceId: Id<"workspaces"> }> {
  const { convexClient, userId, page } = opts;

  if (!userId) {
    throw redirect({ to: "/" });
  }

  // Get user's workspaces (V1: single workspace per user)
  const workspaces = await convexClient.query(api.workspaces.list);

  if (!workspaces || workspaces.length === 0) {
    throw redirect({ to: "/" });
  }

  const workspace = workspaces[0]!;
  const role = workspace.role as Role;

  if (!canAccess(page, role)) {
    // Redirect to dashboard home if they have access, otherwise landing
    if (canAccess("home", role)) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/" });
  }

  return { role, workspaceId: workspace._id as Id<"workspaces"> };
}
