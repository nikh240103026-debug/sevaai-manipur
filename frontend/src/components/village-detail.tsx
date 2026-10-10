"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { getVillage, getVillageAnalytics } from "@/lib/api/villages";
import { ApiError } from "@/lib/api/client";
import type { Village, VillageAnalytics } from "@/types/village";

const serviceColors = ["#6274ed", "#54a1eb", "#3fb6a4", "#9a7be7"];

function messageForError(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "This village is not present in the active dataset.";
  }
  if (error instanceof ApiError && error.status === 403) {
    return "You do not have permission to view this village.";
  }
  if (error instanceof ApiError && error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  return "Village details could not be loaded. Check your connection and try again.";
}

export default function VillageDetail({ villageId }: { villageId: string }) {
  const [village, setVillage] = useState<Village | null>(null);
  const [analytics, setAnalytics] = useState<VillageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    Promise.all([getVillage(villageId), getVillageAnalytics(villageId)])
      .then(([record, result]) => {
        if (!current) return;
        setVillage(record);
        setAnalytics(result);
      })
      .catch((requestError: unknown) => {
        if (current) setError(messageForError(requestError));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [villageId]);

  const services = village ? [
    { name: "Housing", coverage: village.housing_coverage },
    { name: "Health", coverage: village.health_coverage },
    { name: "Water", coverage: village.water_coverage },
    { name: "Welfare", coverage: village.welfare_coverage },
  ] : [];
  const availableCoverages = services.flatMap((service) =>
    service.coverage === null ? [] : [service.coverage],
  );
  const averageCoverage = availableCoverages.length === services.length && services.length
    ? availableCoverages.reduce((total, value) => total + value, 0) / services.length
    : null;

  return (
    <AppShell title="Villages">
      <Link className="back-link" href="/villages">← Back to village directory</Link>
      {loading ? (
        <div className="dashboard-state" role="status"><span className="loading-indicator" /> Loading village details…</div>
      ) : error || !village ? (
        <div className="dashboard-state dashboard-state-error" role="alert">
          <p>{error || "This village is not present in the active dataset."}</p>
          <Link className="button button-secondary" href="/villages">Back to villages</Link>
        </div>
      ) : (
        <>
          <PageHeading
            eyebrow={`${village.district.toUpperCase()}${village.block ? ` · ${village.block.toUpperCase()} BLOCK` : ""}`}
            title={village.village}
            detail={`Record ${village.village_id}${village.data_date ? ` · Data date ${village.data_date}` : ""}`}
            action={analytics?.priority_level
              ? <span className={`priority-badge priority-badge-${analytics.priority_level.toLowerCase()}`}><i />{analytics.priority_level} priority</span>
              : undefined}
          />
          {!analytics?.available && (
            <div className="dashboard-state dashboard-state-empty" role="status">
              {analytics?.unavailable_reason ?? "Priority analytics are unavailable for this record."}
            </div>
          )}
          <section className="metrics-grid village-detail-metrics">
            <article className="metric-card"><div className="metric-icon metric-icon-indigo">◷</div><div className="metric-value">{averageCoverage === null ? "Unavailable" : `${averageCoverage.toFixed(1)}%`}</div><div className="metric-label">Overall service coverage</div><div className="metric-note">Available only when all service values are present</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-amber">◇</div><div className="metric-value">{village.pending_cases?.toLocaleString() ?? "Unavailable"}</div><div className="metric-label">Pending cases</div><div className="metric-note">{village.pending_rate === null ? "Pending rate unavailable" : `${village.pending_rate}% of eligible households`}</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-teal">⌖</div><div className="metric-value">{village.district}</div><div className="metric-label">District</div><div className="metric-note">{village.block ?? "Block unavailable"}</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-rose">!</div><div className="metric-value">{analytics?.priority_score === null || !analytics ? "Unavailable" : analytics.priority_score.toFixed(2)}</div><div className="metric-label">Priority score</div><div className="metric-note">{analytics?.priority_level ?? "Required inputs unavailable"}</div></article>
          </section>
          <section className="panel service-detail-panel">
            <div className="section-heading"><div><div className="section-eyebrow">SERVICE SNAPSHOT</div><h2>Coverage by service area</h2><p>Values are shown only when present in the active record.</p></div></div>
            <div className="coverage-bars detail-service-bars">
              {services.map((service, index) => (
                <div className="coverage-row" key={service.name}>
                  <div className="coverage-label"><span>{service.name}</span><strong>{service.coverage === null ? "Unavailable" : `${service.coverage}%`}</strong></div>
                  <div className="progress-track" role="progressbar" aria-label={`${service.name} coverage`} aria-valuenow={service.coverage ?? undefined} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${service.coverage ?? 0}%`, backgroundColor: serviceColors[index] }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
