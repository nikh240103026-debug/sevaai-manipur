"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { DataState } from "@/components/data-state";
import { useVillages } from "@/hooks/use-villages";
import {
  formatPercent,
  overallCoverage,
  serviceAggregates,
  services,
  villageGapCount,
} from "@/lib/village-data";
import type { Village } from "@/types/village";

function uncoveredHouseholds(village: Village): number {
  return services.reduce(
    (total, service) => total + village[service.eligible] - village[service.covered],
    0,
  );
}

export default function AnalyticsPage() {
  const { villages, loading, error } = useVillages();
  const serviceMetrics = useMemo(() => serviceAggregates(villages), [villages]);
  const overall = serviceMetrics.reduce((total, service) => total + service.covered, 0);
  const eligible = serviceMetrics.reduce((total, service) => total + service.eligible, 0);
  const coverage = eligible === 0 ? 0 : (overall / eligible) * 100;
  const rankedVillages = useMemo(
    () => [...villages].sort((a, b) => uncoveredHouseholds(b) - uncoveredHouseholds(a)),
    [villages],
  );
  const districts = useMemo(() => {
    const groups = new Map<string, Village[]>();
    for (const village of villages) {
      groups.set(village.district, [...(groups.get(village.district) ?? []), village]);
    }
    return [...groups.entries()].map(([name, rows]) => {
      const services = serviceAggregates(rows);
      const denominator = services.reduce((sum, item) => sum + item.eligible, 0);
      const numerator = services.reduce((sum, item) => sum + item.covered, 0);
      const districtCoverage = denominator === 0 ? 0 : numerator / denominator * 100;
      const historical = services.reduce((sum, item) => sum + item.eligible * item.historicalCoverage, 0);
      return {
        name,
        villages: rows.length,
        coverage: districtCoverage,
        gapHouseholds: denominator - numerator,
        historicalCoverage: denominator === 0 ? 0 : historical / denominator,
      };
    }).sort((a, b) => a.coverage - b.coverage);
  }, [villages]);
  const deterioratedServices = serviceMetrics.filter(
    (service) => service.coverage < service.historicalCoverage,
  );

  return (
    <AppShell title="Analytics">
      <PageHeading eyebrow="DECISION SUPPORT" title="Service analytics" detail="Coverage, gaps, pending cases and historical comparison calculated from live village records." />
      <DataState loading={loading} error={error} empty={villages.length === 0 ? "No village records are available for analysis." : undefined} />
      {!loading && !error && villages.length > 0 && (
        <>
          <section className="metrics-grid analytics-metrics">
            <article className="metric-card"><div className="metric-icon metric-icon-indigo">◷</div><div className="metric-value">{formatPercent(coverage)}</div><div className="metric-label">Overall service coverage</div><div className="metric-note">Eligible-household weighted</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-teal">♧</div><div className="metric-value">{villages.length.toLocaleString()}</div><div className="metric-label">Village records</div><div className="metric-note">{districts.length} districts</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-amber">◇</div><div className="metric-value">{serviceMetrics.reduce((sum, service) => sum + service.gapHouseholds, 0).toLocaleString()}</div><div className="metric-label">Service gaps</div><div className="metric-note">Eligible households not covered</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-rose">↘</div><div className="metric-value">{deterioratedServices.length}</div><div className="metric-label">Services below historical</div><div className="metric-note">Current vs. historical coverage</div></article>
          </section>
          <section className="analytics-grid">
            <article className="panel analytics-chart-panel">
              <div className="section-heading"><div><div className="section-eyebrow">SERVICE COMPARISON</div><h2>Coverage and change</h2><p>Coverage weighted by eligible household counts; historical values are provided by the API</p></div></div>
              <div className="coverage-bars analytics-coverage-bars">{serviceMetrics.map((service) => {
                const change = service.coverage - service.historicalCoverage;
                return <div className="coverage-row" key={service.key}><div className="coverage-label"><span>{service.label} · {service.covered.toLocaleString()} / {service.eligible.toLocaleString()} covered</span><strong>{formatPercent(service.coverage)}</strong></div><div className="progress-track" role="progressbar" aria-label={`${service.label} coverage`} aria-valuenow={service.coverage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${service.coverage}%`, backgroundColor: service.color }} /></div><div className="data-note">Historical {formatPercent(service.historicalCoverage)} · {change >= 0 ? "+" : ""}{formatPercent(change)}</div></div>;
              })}</div>
            </article>
            <article className="panel analytics-chart-panel">
              <div className="section-heading"><div><div className="section-eyebrow">COVERAGE GAPS</div><h2>Largest service gaps</h2><p>Uncovered eligible households, aggregated across villages</p></div></div>
              <div className="coverage-bars analytics-coverage-bars">{serviceMetrics.slice().sort((a, b) => b.gapHouseholds - a.gapHouseholds).map((service) => (
                <div className="coverage-row" key={service.key}><div className="coverage-label"><span>{service.label} · {service.gapHouseholds.toLocaleString()} uncovered</span><strong>{formatPercent(service.gap)}</strong></div><div className="progress-track"><span style={{ width: `${service.gap}%`, backgroundColor: service.color }} /></div></div>
              ))}</div>
            </article>
          </section>
          <section className="panel analytics-district-panel">
            <div className="section-heading"><div><div className="section-eyebrow">DISTRICT COMPARISON</div><h2>District coverage</h2><p>Ranked from lowest current coverage; no priority score is supplied by this API</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>DISTRICT</th><th>VILLAGES</th><th>OVERALL COVERAGE</th><th>HISTORICAL</th><th>CHANGE</th><th>UNCOVERED COUNTS</th></tr></thead><tbody>{districts.map((district) => <tr key={district.name}><td><div className="district-name">{district.name}</div></td><td>{district.villages}</td><td>{formatPercent(district.coverage)}</td><td>{formatPercent(district.historicalCoverage)}</td><td>{district.coverage - district.historicalCoverage >= 0 ? "+" : ""}{formatPercent(district.coverage - district.historicalCoverage)}</td><td>{district.gapHouseholds.toLocaleString()}</td></tr>)}</tbody></table></div>
          </section>
          <section className="panel analytics-district-panel">
            <div className="section-heading"><div><div className="section-eyebrow">VILLAGE COMPARISON</div><h2>Villages with largest measured gaps</h2><p>Sorted by uncovered eligible household counts, not a backend priority score</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>VILLAGE</th><th>DISTRICT</th><th>OVERALL COVERAGE</th><th>SERVICE GAPS</th><th>PENDING</th><th>UNCOVERED</th></tr></thead><tbody>{rankedVillages.slice(0, 10).map((village) => <tr key={village.village_id}><td><Link className="district-name" href={`/villages/${village.village_id}`}>{village.village}</Link></td><td>{village.district}</td><td>{formatPercent(overallCoverage(village))}</td><td>{villageGapCount(village)} of 4</td><td>{village.pending_cases.toLocaleString()} ({formatPercent(village.pending_rate)})</td><td>{uncoveredHouseholds(village).toLocaleString()}</td></tr>)}</tbody></table></div>
          </section>
        </>
      )}
    </AppShell>
  );
}
