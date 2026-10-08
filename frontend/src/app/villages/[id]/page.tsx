"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell, PageHeading } from "@/components/app-shell";
import { DataState } from "@/components/data-state";
import { apiRequest } from "@/lib/client";
import {
  formatPercent,
  overallCoverage,
  overallHistoricalCoverage,
  services,
  serviceGap,
} from "@/lib/village-data";
import type { Village } from "@/types/village";

export default function VillageDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [result, setResult] = useState<{
    id: string;
    village: Village | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Village>(`/api/v1/villages/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((village) => setResult({ id, village, error: null }))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          id,
          village: null,
          error: requestError instanceof Error ? requestError.message : "Unable to load village.",
        });
      });
    return () => controller.abort();
  }, [id]);

  const loading = result?.id !== id;
  const village = result?.id === id ? result.village : null;
  const error = result?.id === id ? result.error : null;
  const largestGap = village
    ? services.map((service) => ({ ...service, gap: serviceGap(village, service.key) }))
        .sort((a, b) => b.gap - a.gap)[0]
    : undefined;

  return (
    <AppShell title="Villages">
      <Link className="back-link" href="/villages">← Back to village directory</Link>
      {loading || error || !village ? (
        <DataState loading={loading} error={error} empty={!loading && !error ? "Village not found." : undefined} />
      ) : (
        <>
          <PageHeading eyebrow={`${village.district.toUpperCase()} · ${village.block.toUpperCase()} BLOCK`} title={village.village} detail={`Village ID ${village.village_id} · Data date ${village.data_date}`} action={<span className="priority-period">Backend priority: not provided</span>} />
          <section className="metrics-grid village-detail-metrics">
            <article className="metric-card"><div className="metric-icon metric-icon-indigo">◷</div><div className="metric-value">{formatPercent(overallCoverage(village))}</div><div className="metric-label">Overall service coverage</div><div className="metric-note">Weighted by eligible households</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-amber">◇</div><div className="metric-value">{village.pending_cases.toLocaleString()}</div><div className="metric-label">Pending cases</div><div className="metric-note">{formatPercent(village.pending_rate)} pending rate</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-teal">↗</div><div className="metric-value">{formatPercent(overallHistoricalCoverage(village))}</div><div className="metric-label">Historical average coverage</div><div className="metric-note">Current change {overallCoverage(village) - overallHistoricalCoverage(village) >= 0 ? "+" : ""}{formatPercent(overallCoverage(village) - overallHistoricalCoverage(village))}</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-rose">!</div><div className="metric-value">{largestGap?.label ?? "—"}</div><div className="metric-label">Largest service gap</div><div className="metric-note">{largestGap ? `${formatPercent(largestGap.gap)} of eligible households uncovered` : "No service data"}</div></article>
          </section>
          <section className="panel service-detail-panel">
            <div className="section-heading"><div><div className="section-eyebrow">SERVICE COVERAGE</div><h2>Eligible, covered and uncovered households</h2><p>Coverage and gap percentages are from this village&apos;s API record.</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>SERVICE</th><th>ELIGIBLE</th><th>COVERED</th><th>COVERAGE</th><th>GAP</th><th>HISTORICAL COVERAGE</th></tr></thead><tbody>
              {services.map((service) => (
                <tr key={service.key}><td><strong>{service.label}</strong></td><td>{village[service.eligible].toLocaleString()}</td><td>{village[service.covered].toLocaleString()}</td><td>{formatPercent(village[service.coverage])}</td><td>{formatPercent(serviceGap(village, service.key))}</td><td>{formatPercent(village[service.historical])}</td></tr>
              ))}
            </tbody></table></div>
            <div className="coverage-bars detail-service-bars">{services.map((service) => (
              <div className="coverage-row" key={service.key}><div className="coverage-label"><span>{service.label}</span><strong>{formatPercent(village[service.coverage])}</strong></div><div className="progress-track" role="progressbar" aria-label={`${service.label} coverage`} aria-valuenow={village[service.coverage]} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${village[service.coverage]}%`, backgroundColor: service.color }} /></div></div>
            ))}</div>
          </section>
          <p className="data-note">No priority score/level is returned for this village. Priority rank should be supplied by the backend; service gaps above are calculated directly from eligible and covered counts.</p>
        </>
      )}
    </AppShell>
  );
}
