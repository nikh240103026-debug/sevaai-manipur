"use client";

import { useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { alerts as initialAlerts } from "@/lib/demo-data";

export default function AlertsPage() {
  const [visibleAlerts, setVisibleAlerts] = useState(initialAlerts);

  return (
    <AppShell title="Alerts">
      <PageHeading
        eyebrow="EARLY WARNING · SYNTHETIC DEMO"
        title="AI-generated alerts"
        detail="Review sample service delivery signals and follow up on potential gaps."
        action={<span className="alert-open-count">{visibleAlerts.length} open in this preview</span>}
      />
      <div className="demo-notice">
        <span className="notice-icon" aria-hidden="true">ⓘ</span>
        <span><strong>Demo environment</strong> · These illustrative alerts are not generated from live data or an operational AI service.</span>
      </div>
      <div className="alert-filter-row">
        <span className="alert-filter-label">Showing all active sample alerts</span>
        <span className="priority-badge priority-badge-high"><i />High priority</span>
        <span className="priority-badge priority-badge-medium"><i />Medium priority</span>
      </div>
      <section className="alert-list" aria-label="Sample alerts">
        {visibleAlerts.map((alert) => (
          <article className="panel alert-card" key={alert.id}>
            <div className={`alert-priority-rail alert-rail-${alert.priority.toLowerCase()}`} />
            <div className="alert-card-content">
              <div className="alert-card-top">
                <span className={`priority-badge priority-badge-${alert.priority.toLowerCase()}`}><i />{alert.priority} priority</span>
                <span className="alert-id">{alert.id}</span>
                <span className="alert-time">{alert.time}</span>
              </div>
              <h2>{alert.title}</h2>
              <p>{alert.description}</p>
              <div className="alert-card-footer">
                <span className="alert-location"><span aria-hidden="true">⌖</span>{alert.location}</span>
                <span className="alert-category">{alert.category}</span>
                <button
                  className="button button-secondary"
                  onClick={() => setVisibleAlerts((current) => current.filter((item) => item.id !== alert.id))}
                  type="button"
                >
                  Mark reviewed
                </button>
              </div>
            </div>
          </article>
        ))}
        {visibleAlerts.length === 0 && (
          <div className="panel no-alerts"><span className="metric-icon metric-icon-teal">✓</span><h2>You’re all caught up</h2><p>All sample alerts have been marked as reviewed.</p><button className="button button-secondary" onClick={() => setVisibleAlerts(initialAlerts)} type="button">Restore demo alerts</button></div>
        )}
      </section>
    </AppShell>
  );
}
