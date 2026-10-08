"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            <p>Demo insights are synthetic and for exploration only.</p>
            <Link href="/login">Sign out <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="profile">
            <div className="avatar">AD</div>
            <div className="profile-copy">
              <strong>Admin Demo</strong>
              <span>State administrator</span>
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
            <span className="topbar-date">Reporting period <strong>Mar 2025</strong></span>
            <span className="demo-topbar-badge">DEMO DATA</span>
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
