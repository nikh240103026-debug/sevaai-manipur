"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { ApiError, apiRequest, hasApiConfiguration } from "@/lib/client";
import {
  isLocalDemoSession,
  signOutOfLocalDemo,
  subscribeLocalDemoState,
} from "@/lib/local-passkey";

const links = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "Map", href: "/map", icon: "⌖" },
  { label: "Analytics", href: "/analytics", icon: "◷" },
  { label: "Villages", href: "/villages", icon: "♧" },
  { label: "Alerts", href: "/alerts", icon: "♧", count: "08" },
  { label: "Interventions", href: "/interventions", icon: "◇" },
];

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const localDemo = useSyncExternalStore(
    subscribeLocalDemoState,
    () => !hasApiConfiguration || isLocalDemoSession(),
    () => !hasApiConfiguration,
  );

  async function handleSignOut() {
    setSignOutError("");
    if (localDemo || !hasApiConfiguration || isLocalDemoSession()) {
      signOutOfLocalDemo();
      router.replace("/login");
      return;
    }
    try {
      await apiRequest<void>("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/login");
    } catch (error) {
      setSignOutError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to sign out. Please try again.",
      );
    }
  }

  return (
    <div className="dashboard-shell">
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <Link
          className="brand"
          href="/dashboard"
          onClick={() => setSidebarOpen(false)}
        >
          <span className="brand-mark" aria-hidden="true">✳</span>
          <span className="brand-copy">
            <strong>seva<span>ai</span></strong>
            <small>MANIPUR · INTELLIGENCE</small>
          </span>
        </Link>
        <button
          className="icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          type="button"
        >
          ×
        </button>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href === "/villages" && pathname.startsWith("/villages/"));
            return (
              <Link
                className={`nav-link${active ? " nav-link-active" : ""}`}
                href={link.href}
                key={link.href}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="shell-nav-icon" aria-hidden="true">{link.icon}</span>
                <span>{link.label}</span>
                {link.count && <span className="nav-count">{link.count}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon" aria-hidden="true">✳</div>
            <strong>Built for better decisions</strong>
            <p>{localDemo ? "Synthetic village data for local page previews." : "Live village coverage and pending-case indicators from connected APIs."}</p>
            <button className="signout-button" onClick={handleSignOut} type="button">
              Sign out <span aria-hidden="true">↗</span>
            </button>
            {signOutError && (
              <p className="signout-error" role="alert">{signOutError}</p>
            )}
          </div>
          <div className="profile">
            <div className="avatar">AD</div>
            <div className="profile-copy">
              <strong>{localDemo ? "Local demo access" : "Authenticated user"}</strong>
              <span>{localDemo ? "Device passkey · synthetic data" : "Signed in through the API"}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              type="button"
            >
              {sidebarOpen ? "×" : "☰"}
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="topbar-date">Data source <strong>{localDemo ? "Local demo" : "FastAPI"}</strong></span>
            <span className="demo-topbar-badge">{localDemo ? "SYNTHETIC DATA" : "LIVE API"}</span>
          </div>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <section className="welcome-row page-welcome">
      <div>
        <div className="welcome-overline">
          <span className="live-dot" />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {action}
    </section>
  );
}
