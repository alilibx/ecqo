import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useMatches,
} from "@tanstack/react-router";
import { useUser, UserButton } from "@clerk/tanstack-react-start";
import { useQuery, useMutation } from "convex/react";
import React, { useState, useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { canAccess } from "../../lib/route-guards";
import { DashboardProvider } from "../../lib/dashboard-context";

type Role = "owner" | "principal" | "operator";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    const { userId } = context as { userId: string | null };
    if (!userId) {
      throw redirect({ to: "/sign-in/$" });
    }
  },
  component: DashboardLayout,
});

// ── SVG Icons (20x20, stroke-based) ──

const icons: Record<string, React.ReactNode> = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  connect: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  inbox: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  ),
  conversations: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  runs: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  memory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
    </svg>
  ),
  integrations: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1" />
      <rect x="14" y="2" width="8" height="8" rx="1" />
      <rect x="2" y="14" width="8" height="8" rx="1" />
      <rect x="14" y="14" width="8" height="8" rx="1" />
    </svg>
  ),
  policy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" />
    </svg>
  ),
  collapse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  ),
  expand: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <polyline points="14 8 18 12 14 16" />
    </svg>
  ),
};

// ── Nav config ──

interface NavItem {
  page: string;
  label: string;
  href: string;
  mobileTab?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { page: "home", label: "Home", href: "/dashboard", mobileTab: true },
  { page: "connect", label: "Connect", href: "/dashboard/connect" },
  { page: "inbox", label: "Inbox", href: "/dashboard/inbox", mobileTab: true },
  { page: "conversations", label: "Chats", href: "/dashboard/conversations" },
  { page: "runs", label: "Runs", href: "/dashboard/runs", mobileTab: true },
  { page: "memory", label: "Memory", href: "/dashboard/memory", mobileTab: true },
  { page: "integrations", label: "Integrations", href: "/dashboard/integrations" },
  { page: "policy", label: "Policy", href: "/dashboard/policy" },
  { page: "settings", label: "Settings", href: "/dashboard/settings" },
];

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  principal: "Principal",
  operator: "Operator",
};

// ── Layout ──

function DashboardLayout() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const matches = useMatches();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const workspaces = useQuery(api.workspaces.list);
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (isUserLoaded && user && workspaces !== undefined && workspaces.length === 0) {
      ensureUser();
    }
  }, [isUserLoaded, user, workspaces, ensureUser]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [matches]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Loading
  if (workspaces === undefined) {
    return (
      <div className="dash">
        <div className="dash-loading">
          <img src="/logos/logo-icon.png" alt="" className="dash-loading-logo" />
        </div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="dash">
        <div className="dash-loading">
          <img src="/logos/logo-icon.png" alt="" className="dash-loading-logo" />
          <span className="dash-loading-text">Setting up workspace...</span>
        </div>
      </div>
    );
  }

  const workspace = workspaces[0]!;
  const workspaceId = workspace._id as Id<"workspaces">;
  const role = workspace.role as Role;
  const workspaceName = workspace.name as string;
  const dashCtx = { workspaceId, workspaceName, role };

  const visibleItems = NAV_ITEMS.filter((item) => canAccess(item.page, role));
  const mobileItems = visibleItems.filter((item) => item.mobileTab).slice(0, 4);

  const currentPath = matches[matches.length - 1]?.fullPath ?? "/dashboard";
  const activePage = currentPath === "/dashboard" || currentPath === "/dashboard/"
    ? "home"
    : currentPath.replace("/dashboard/", "");

  const sidebarCls = [
    "dash-sidebar",
    sidebarOpen ? "is-open" : "",
    collapsed ? "is-collapsed" : "",
  ].filter(Boolean).join(" ");

  return (
    <DashboardProvider value={dashCtx}>
    <div className={`dash ${collapsed ? "dash--collapsed" : ""}`}>
      {sidebarOpen && (
        <div
          className="dash-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside className={sidebarCls}>
        {/* Logo + collapse toggle */}
        <div className="dash-sidebar-header">
          <Link to="/dashboard" className="dash-logo">
            <img src="/logos/logo-icon.png" alt="" className="dash-logo-img" />
            <span className="dash-logo-text">Ecqqo</span>
          </Link>
          <button
            className="dash-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? icons.expand : icons.collapse}
          </button>
        </div>

        {/* Workspace badge */}
        <div className="dash-workspace">
          <div className="dash-workspace-dot" />
          <span className="dash-workspace-name">{workspaceName}</span>
          <span className="dash-workspace-role">{ROLE_LABELS[role]}</span>
        </div>

        {/* Nav */}
        <nav className="dash-nav" aria-label="Dashboard navigation">
          <ul className="dash-nav-list">
            {visibleItems.map((item) => (
              <li key={item.page}>
                <Link
                  to={item.href}
                  className={`dash-nav-item ${activePage === item.page ? "is-active" : ""}`}
                  activeOptions={{ exact: item.page === "home" }}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="dash-nav-icon">{icons[item.page]}</span>
                  <span className="dash-nav-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User (Clerk UserButton) */}
        <div className="dash-sidebar-bottom">
          <div className="dash-user-row">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "dash-clerk-avatar",
                },
              }}
            />
            <div className="dash-user-info">
              <span className="dash-user-name">{user?.firstName ?? "User"}</span>
              <span className="dash-user-email">{user?.primaryEmailAddress?.emailAddress ?? ""}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main">
        <header className="dash-topbar">
          <button
            className="dash-burger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            <span className="dash-burger-line" />
            <span className="dash-burger-line" />
            <span className="dash-burger-line" />
          </button>
          <Link to="/dashboard" className="dash-topbar-logo">
            <img src="/logos/logo-icon.png" alt="" className="dash-topbar-logo-img" />
            <span className="dash-logo-text">Ecqqo</span>
          </Link>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "dash-clerk-avatar-sm",
              },
            }}
          />
        </header>

        <div className="dash-content">
          <Outlet />
        </div>
      </main>

      {/* Mobile tabs */}
      <nav className="dash-mobile-tabs" aria-label="Quick navigation">
        {mobileItems.map((item) => (
          <Link
            key={item.page}
            to={item.href}
            className={`dash-tab ${activePage === item.page ? "is-active" : ""}`}
            activeOptions={{ exact: item.page === "home" }}
          >
            <span className="dash-tab-icon">{icons[item.page]}</span>
            <span className="dash-tab-label">{item.label}</span>
          </Link>
        ))}
        <button
          className="dash-tab"
          onClick={() => setSidebarOpen(true)}
          aria-label="More pages"
        >
          <span className="dash-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
            </svg>
          </span>
          <span className="dash-tab-label">More</span>
        </button>
      </nav>
    </div>
    </DashboardProvider>
  );
}
