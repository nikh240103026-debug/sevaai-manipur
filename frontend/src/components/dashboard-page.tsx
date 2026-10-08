"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { DataState } from "@/components/data-state";
import { useVillages } from "@/hooks/use-villages";
import {
  formatPercent,
  overallCoverage,
  overallPendingRate,
  serviceAggregates,
  totalPending,
  villageGapCount,
} from "@/lib/village-data";

export default function DashboardPage() {
  const { villages, loading, error } = useVillages();
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("All districts");
  const districts = useMemo(
    () => [...new Set(villages.map((village) => village.district))].sort(),
    [villages],
  );
  const serviceMetrics = useMemo(() => serviceAggregates(villages), [villages]);
  const sortedByGap = useMemo(
    () => [...villages].sort((a, b) => overallCoverage(a) - overallCoverage(b)),
    [villages],
  );
  const topGapService = [...serviceMetrics].sort((a, b) => b.gap - a.gap)[0];
  const query = search.trim().toLowerCase();
  const visibleVillages = sortedByGap.filter((village) => {
    const matchesQuery = !query ||
      `${village.village_id} ${village.village} ${village.district} ${village.block}`
        .toLowerCase().includes(query);
    return matchesQuery && (district === "All districts" || village.district === district);
  });
  const latestDate = villages.reduce(
    (latest, village) => village.data_date > latest ? village.data_date : latest,
    "",
  );
  const overallEligible = serviceMetrics.reduce((total, service) => total + service.eligible, 0);
  const averageCoverage = overallEligible === 0
    ? 0
    : serviceMetrics.reduce((total, service) => total + service.covered, 0) / overallEligible * 100;
  const averageHistorical = overallEligible === 0
    ? 0
    : serviceMetrics.reduce((total, service) => total + service.eligible * service.historicalCoverage, 0) / overallEligible;

  return (
    <AppShell title="Dashboard">
      <PageHeading
        eyebrow="MANIPUR · STATE OVERVIEW"
        title="Service delivery overview"
        detail="Live coverage and pending-case indicators from the village register."
        action={latestDate ? <span className="priority-period">Data through {latestDate}</span> : undefined}
      />
      <DataState loading={loading} error={error} empty={villages.length === 0 ? "No village records are available." : undefined} />
      {!loading && !error && villages.length > 0 && (
        <>
          <section className="metrics-grid" aria-label="Dashboard summary metrics">
            <article className="metric-card"><div className="metric-icon metric-icon-indigo">♧</div><div className="metric-value">{villages.length.toLocaleString()}</div><div className="metric-label">Total villages</div><div className="metric-note">{districts.length} districts represented</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-teal">◷</div><div className="metric-value">{formatPercent(averageCoverage)}</div><div className="metric-label">Overall service coverage</div><div className="metric-note">Across four services</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-amber">◇</div><div className="metric-value">{totalPending(villages).toLocaleString()}</div><div className="metric-label">Pending cases</div><div className="metric-note">{formatPercent(overallPendingRate(villages))} of eligible households</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-rose">!</div><div className="metric-value">Not provided</div><div className="metric-label">High-priority villages</div><div className="metric-note">The village API has no priority field</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-indigo">↘</div><div className="metric-value">{topGapService?.gapHouseholds.toLocaleString() ?? "—"}</div><div className="metric-label">Largest service gap</div><div className="metric-note">{topGapService?.label ?? "No service data"}</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-teal">◌</div><div className="metric-value">Not provided</div><div className="metric-label">Unusual villages</div><div className="metric-note">AI anomaly endpoint is unavailable</div></article>
          </section>

          <section className="insight-grid" aria-label="Service coverage and gaps">
            <article className="panel coverage-panel">
              <div className="section-heading"><div><div className="section-eyebrow">SERVICE DELIVERY</div><h2>Coverage and service gaps</h2><p>Eligibility-weighted across all returned village records</p></div></div>
              <div className="coverage-summary"><div><strong>{formatPercent(averageCoverage)}</strong><span className="summary-caption">overall coverage</span></div><div className="coverage-summary-note"><span>{averageCoverage - averageHistorical >= 0 ? "+" : ""}{formatPercent(averageCoverage - averageHistorical)}</span><span>vs. historical average</span></div></div>
              <div className="coverage-bars">
                {serviceMetrics.map((service) => (
                  <div className="coverage-row" key={service.key}>
                    <div className="coverage-label"><span>{service.label} · {service.gapHouseholds.toLocaleString()} uncovered</span><strong>{formatPercent(service.coverage)}</strong></div>
                    <div className="progress-track" role="progressbar" aria-label={`${service.label} coverage`} aria-valuenow={service.coverage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${service.coverage}%`, backgroundColor: service.color }} /></div>
                  </div>
                ))}
              </div>
              <div className="coverage-footer"><span>Coverage is covered ÷ eligible, aggregated from API records</span></div>
            </article>
            <article className="panel priority-panel">
              <div className="section-heading"><div><div className="section-eyebrow">WHERE TO LOOK FIRST</div><h2>Largest service-delivery gaps</h2><p>Services ranked by uncovered eligible households</p></div></div>
              <div className="priority-callout"><div className="callout-icon">!</div><div><strong>{topGapService?.label ?? "No service data"} has the largest gap</strong><span>{topGapService?.gapHouseholds.toLocaleString() ?? 0} eligible households not covered</span></div></div>
              <div className="district-list">
                {serviceMetrics.slice().sort((a, b) => b.gapHouseholds - a.gapHouseholds).map((service, index) => (
                  <div className="district-row" key={service.key}><span className="district-rank">{String(index + 1).padStart(2, "0")}</span><div className="district-main"><div className="district-label"><strong>{service.label}</strong><span>{service.gapHouseholds.toLocaleString()} not covered</span></div><div className="priority-track"><span className="priority-fill priority-fill-rose" style={{ width: `${service.gap}%` }} /></div></div><span className="gap-value">{formatPercent(service.gap)}</span></div>
                ))}
              </div>
              <Link className="text-link" href="/analytics">Explore analytics <span aria-hidden="true">→</span></Link>
            </article>
          </section>

          <section className="panel village-panel">
            <div className="village-panel-header">
              <div className="section-heading"><div><div className="section-eyebrow">FIELD INTELLIGENCE</div><h2>Villages with lowest coverage</h2><p>{visibleVillages.length} records, sorted by overall service coverage</p></div></div>
              <div className="table-tools">
                <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search villages" placeholder="Search villages..." type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                <label className="filter-select-label"><span className="sr-only">Filter by district</span><select className="filter-select" value={district} onChange={(event) => setDistrict(event.target.value)}><option>All districts</option>{districts.map((name) => <option key={name}>{name}</option>)}</select></label>
              </div>
            </div>
            <div className="table-scroll"><table><thead><tr><th>VILLAGE</th><th>DISTRICT / BLOCK</th><th>OVERALL COVERAGE</th><th>PENDING</th><th>SERVICE GAPS</th><th></th></tr></thead><tbody>
              {visibleVillages.slice(0, 10).map((village) => (
                <tr key={village.village_id}><td><div className="village-name">{village.village}</div><div className="village-id">{village.village_id}</div></td><td><div className="district-name">{village.district}</div><div className="village-id">{village.block} block</div></td><td><div className="table-coverage"><div className="table-progress"><span style={{ width: `${overallCoverage(village)}%` }} /></div><strong>{formatPercent(overallCoverage(village))}</strong></div></td><td><span className="pending-number">{village.pending_cases}</span></td><td>{villageGapCount(village)} of 4</td><td><Link className="row-link" href={`/villages/${village.village_id}`} aria-label={`View ${village.village}`}>↗</Link></td></tr>
              ))}
              {visibleVillages.length === 0 && <tr><td className="empty-state" colSpan={6}>No villages match these filters.</td></tr>}
            </tbody></table></div>
            <div className="table-footer"><span>Showing <strong>{Math.min(visibleVillages.length, 10)}</strong> of <strong>{visibleVillages.length}</strong> filtered records</span><Link href="/villages">Open village directory →</Link></div>
          </section>
        </>
      )}
    </AppShell>
  );
}
