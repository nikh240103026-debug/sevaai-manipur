"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { getDistricts, getVillages } from "@/lib/api/villages";
import { ApiError } from "@/lib/api/client";
import type { Village } from "@/types/village";

const PAGE_SIZE = 50;

function coverageAverage(village: Village): number | null {
  const values = [
    village.housing_coverage,
    village.health_coverage,
    village.water_coverage,
    village.welfare_coverage,
  ];
  return values.every((value): value is number => value !== null)
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function requestError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return "Your session has expired. Sign in again to view village records.";
  }
  if (error instanceof ApiError && error.status === 403) {
    return "You do not have permission to view these village records.";
  }
  return "Village records could not be loaded. Check your connection and try again.";
}

export default function VillagesPage() {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [villages, setVillages] = useState<Village[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    getDistricts()
      .then((result) => {
        if (current) setDistricts(result.districts);
      })
      .catch(() => {
        if (current) setDistricts([]);
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    getVillages({
      page,
      limit: PAGE_SIZE,
      ...(district ? { district } : {}),
    })
      .then((result) => {
        if (!current) return;
        setVillages(result.items);
        setTotal(result.total);
        setPages(result.pages);
        setError("");
      })
      .catch((requestFailure: unknown) => {
        if (current) setError(requestError(requestFailure));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [district, page]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return villages.filter((village) => {
      const matchesQuery = !query || [
        village.village_id,
        village.village,
        village.district,
        village.block ?? "",
      ].join(" ").toLowerCase().includes(query);
      const level = village.priority_level?.toLowerCase() ?? "";
      return matchesQuery && (!priority || level === priority.toLowerCase());
    });
  }, [priority, search, villages]);

  return (
    <AppShell title="Villages">
      <PageHeading
        eyebrow="FIELD INTELLIGENCE"
        title="Village directory"
        detail="Explore village records and service indicators from the active dataset."
        action={<span className="priority-period">{total.toLocaleString()} records</span>}
      />
      <section className="panel village-panel directory-panel">
        <div className="village-panel-header">
          <div className="section-heading">
            <div>
              <div className="section-eyebrow">ACTIVE DATASET</div>
              <h2>Monitored villages</h2>
              <p>{filtered.length} records on this page match your filters</p>
            </div>
          </div>
          <div className="table-tools">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search villages on this page"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search villages..."
                type="search"
                value={search}
              />
            </label>
            <label className="filter-select-label">
              <span className="sr-only">Filter by district</span>
              <select
                className="filter-select"
                onChange={(event) => { setDistrict(event.target.value); setPage(1); }}
                value={district}
              >
                <option value="">All districts</option>
                {districts.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-select-label">
              <span className="sr-only">Filter by priority</span>
              <select
                className="filter-select"
                onChange={(event) => setPriority(event.target.value)}
                value={priority}
              >
                <option value="">All priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
          </div>
        </div>
        {error && <div className="upload-feedback upload-feedback-error" role="alert">{error}</div>}
        {loading ? (
          <div className="dashboard-state" role="status"><span className="loading-indicator" /> Loading village records…</div>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead><tr><th>VILLAGE</th><th>DISTRICT / BLOCK</th><th>SERVICE COVERAGE</th><th>PENDING CASES</th><th>PRIORITY</th><th><span className="sr-only">Details</span></th></tr></thead>
                <tbody>
                  {filtered.map((village) => {
                    const average = coverageAverage(village);
                    return (
                      <tr key={village.village_id}>
                        <td><div className="village-name">{village.village}</div><div className="village-id">{village.village_id}</div></td>
                        <td><div className="district-name">{village.district}</div><div className="village-id">{village.block ?? "Block unavailable"}</div></td>
                        <td>
                          {average === null ? <span className="small-muted">Data unavailable</span> : (
                            <div className="table-coverage"><div className="table-progress"><span style={{ width: `${average}%` }} /></div><strong>{average.toFixed(1)}%</strong></div>
                          )}
                        </td>
                        <td>{village.pending_cases === null ? <span className="small-muted">—</span> : <span className="pending-number">{village.pending_cases.toLocaleString()}</span>}</td>
                        <td>
                          {village.priority_level ? (
                            <span className={`priority-badge priority-badge-${village.priority_level.toLowerCase()}`}><i />{village.priority_level}</span>
                          ) : <span className="small-muted">Unavailable</span>}
                        </td>
                        <td><Link className="row-link" href={`/villages/${encodeURIComponent(village.village_id)}`} aria-label={`View ${village.village}`}>↗</Link></td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td className="empty-state" colSpan={6}>{error ? "Village records are unavailable." : "No village records match these filters."}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>Showing <strong>{filtered.length}</strong> of <strong>{total.toLocaleString()}</strong> records</span>
              <span className="village-pagination">
                <button className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} type="button">Previous</button>
                <span>Page {pages === 0 ? 0 : page} of {pages}</span>
                <button className="button button-secondary" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
              </span>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
