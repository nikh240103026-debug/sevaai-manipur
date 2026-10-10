"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { getVillages } from "@/lib/api/villages";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { DashboardSummary } from "@/types/dashboard";
import type { Village } from "@/types/village";

const services = [
  { key: "housing_coverage", label: "Housing", color: "var(--chart-indigo)" },
  { key: "health_coverage", label: "Health", color: "var(--chart-blue)" },
  { key: "water_coverage", label: "Water", color: "var(--chart-teal)" },
  { key: "welfare_coverage", label: "Welfare", color: "var(--chart-violet)" },
] as const;

type DistrictSummary = {
  name: string;
  records: number;
  coverage: number | null;
  scored: number;
  highPriority: number;
};

function villageCoverage(village: Village): number | null {
  const values = services.map(({ key }) => village[key]);
  return values.every((value): value is number => value !== null)
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function displayPercent(value: number | null): string {
  return value === null ? "Unavailable" : `${value.toFixed(1)}%`;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    async function load() {
      try {
        const dashboard = await apiRequest<DashboardSummary>("/api/v1/dashboard/summary");
        const firstPage = await getVillages({ page: 1, limit: 100 });
        const all = [...firstPage.items];
        for (let page = 2; page <= firstPage.pages; page += 1) {
          const next = await getVillages({ page, limit: 100 });
          all.push(...next.items);
        }
        if (current) {
          setSummary(dashboard);
          setVillages(all);
        }
      } catch (requestError) {
        if (current) {
          setError(requestError instanceof ApiError && requestError.status === 401
            ? "Your session has expired. Sign in again to view analytics."
            : "Active dataset analytics could not be loaded. Check your connection and try again.");
        }
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => { current = false; };
  }, []);

  const districts = useMemo<DistrictSummary[]>(() => {
    const grouped = new Map<string, Village[]>();
    for (const village of villages) {
      const items = grouped.get(village.district) ?? [];
      items.push(village);
      grouped.set(village.district, items);
    }
    return Array.from(grouped, ([name, records]) => {
      const coverages = records.flatMap((village) => {
        const value = villageCoverage(village);
        return value === null ? [] : [value];
      });
      return {
        name,
        records: records.length,
        coverage: coverages.length
          ? coverages.reduce((total, value) => total + value, 0) / coverages.length
          : null,
        scored: records.filter((record) => record.analytics_available).length,
        highPriority: records.filter((record) => record.priority_level === "HIGH").length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [villages]);

  const coverageItems = summary ? services.map((service) => ({
    label: service.label,
    color: service.color,
    value: summary.service_coverage[service.key.replace("_coverage", "") as keyof DashboardSummary["service_coverage"]],
  })) : [];

  const overallCoverage = coverageItems.every((item) => item.value !== null)
    ? coverageItems.reduce((total, item) => total + (item.value ?? 0), 0) / coverageItems.length
    : null;
  const historicalRecords = villages.flatMap((village) => {
    const current = villageCoverage(village);
    const history = [
      village.historical_housing_coverage,
      village.historical_health_coverage,
      village.historical_water_coverage,
      village.historical_welfare_coverage,
    ];
    const historicalValues = history.filter(
      (value): value is number => value !== null,
    );
    if (current === null || historicalValues.length !== services.length) return [];
    return [{
      current,
      historical: historicalValues.reduce((total, value) => total + value, 0) / historicalValues.length,
    }];
  });
  const historicalChange = historicalRecords.length
    ? historicalRecords.reduce((total, row) => total + row.current - row.historical, 0) / historicalRecords.length
    : null;

  return (
    <AppShell title="Analytics">
      <PageHeading
        eyebrow="DECISION SUPPORT"
        title="Service analytics"
        detail="Coverage and priority insights calculated from your active dataset."
      />
      {loading ? (
        <div className="dashboard-state" role="status"><span className="loading-indicator" /> Loading dataset analytics…</div>
      ) : error ? (
        <div className="dashboard-state dashboard-state-error" role="alert"><p>{error}</p></div>
      ) : summary ? (
        <>
          {!summary.analytics_available && (
            <div className="dashboard-state dashboard-state-empty" role="status">
              Priority scoring is unavailable because required coverage, historical, or pending fields are missing in the active dataset.
            </div>
          )}
          <section className="metrics-grid analytics-metrics">
            <article className="metric-card"><div className="metric-icon metric-icon-indigo">◷</div><div className="metric-value">{displayPercent(overallCoverage)}</div><div className="metric-label">Average service coverage</div><div className="metric-note">Across available active records</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-teal">♧</div><div className="metric-value">{summary.total_villages.toLocaleString()}</div><div className="metric-label">Active records reviewed</div><div className="metric-note">{districts.length} districts in your scope</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-amber">◇</div><div className="metric-value">{summary.analytics_available ? ((summary.priority.high ?? 0) + (summary.priority.medium ?? 0)).toLocaleString() : "Unavailable"}</div><div className="metric-label">High and medium priority</div><div className="metric-note">Based on existing priority scoring</div></article>
            <article className="metric-card"><div className="metric-icon metric-icon-rose">!</div><div className="metric-value">{summary.unusual_villages?.toLocaleString() ?? "Unavailable"}</div><div className="metric-label">Unusual patterns</div><div className="metric-note">Isolation Forest signals only</div></article>
          </section>
          <section className="analytics-grid">
            <article className="panel analytics-chart-panel">
              <div className="section-heading"><div><div className="section-eyebrow">SERVICE COVERAGE</div><h2>Coverage by service</h2><p>Available values from the active records</p></div></div>
              <div className="coverage-bars analytics-coverage-bars">
                {coverageItems.map((item) => (
                  <div className="coverage-row" key={item.label}>
                    <div className="coverage-label"><span>{item.label}</span><strong>{displayPercent(item.value)}</strong></div>
                    <div className="progress-track" role="progressbar" aria-label={`${item.label} coverage`} aria-valuenow={item.value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${item.value ?? 0}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel analytics-chart-panel">
              <div className="section-heading"><div><div className="section-eyebrow">HISTORICAL COMPARISON</div><h2>Current vs. historical coverage</h2><p>Calculated only for records with both values</p></div></div>
              <div className="chartSummary">
                <strong>{historicalChange === null ? "Unavailable" : `${historicalChange > 0 ? "+" : ""}${historicalChange.toFixed(1)}%`}</strong>
                <span>current change from historical average</span>
                <small>{historicalRecords.length.toLocaleString()} records with complete values</small>
              </div>
            </article>
          </section>
          <section className="panel analytics-district-panel">
            <div className="section-heading"><div><div className="section-eyebrow">DISTRICT COMPARISON</div><h2>Coverage and priority signals</h2><p>Aggregated from active village records</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>DISTRICT</th><th>AVG. COVERAGE</th><th>RECORDS</th><th>HIGH PRIORITY</th><th>ANALYTICS</th></tr></thead><tbody>
              {districts.map((district) => <tr key={district.name}><td><div className="district-name">{district.name}</div></td><td>{displayPercent(district.coverage)}</td><td>{district.records.toLocaleString()}</td><td>{district.scored ? district.highPriority.toLocaleString() : "Unavailable"}</td><td>{district.scored.toLocaleString()} / {district.records.toLocaleString()} available</td></tr>)}
              {districts.length === 0 && <tr><td className="empty-state" colSpan={5}>No active village records are available.</td></tr>}
            </tbody></table></div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
