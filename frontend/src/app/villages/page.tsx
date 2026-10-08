"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { DataState } from "@/components/data-state";
import { useVillages } from "@/hooks/use-villages";
import { formatPercent, overallCoverage, villageGapCount } from "@/lib/village-data";

export default function VillagesPage() {
  const { villages, loading, error } = useVillages();
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("All districts");
  const districts = useMemo(
    () => [...new Set(villages.map((village) => village.district))].sort(),
    [villages],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return villages.filter((village) => {
      const matchesQuery = !query ||
        `${village.village_id} ${village.village} ${village.district} ${village.block}`
          .toLowerCase().includes(query);
      return matchesQuery && (district === "All districts" || village.district === district);
    }).sort((a, b) => overallCoverage(a) - overallCoverage(b));
  }, [district, search, villages]);

  return (
    <AppShell title="Villages">
      <PageHeading eyebrow="FIELD INTELLIGENCE" title="Village directory" detail="Search live village records and identify the largest service gaps." action={!loading && !error ? <span className="priority-period">{villages.length.toLocaleString()} records</span> : undefined} />
      <DataState loading={loading} error={error} empty={villages.length === 0 ? "No village records are available." : undefined} />
      {!loading && !error && villages.length > 0 && (
        <section className="panel village-panel directory-panel">
          <div className="village-panel-header">
            <div className="section-heading"><div><div className="section-eyebrow">LIVE VILLAGE REGISTER</div><h2>Monitored villages</h2><p>{filtered.length} villages match your filters; sorted by lowest overall coverage</p></div></div>
            <div className="table-tools">
              <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search villages" onChange={(event) => setSearch(event.target.value)} placeholder="Search villages..." type="search" value={search} /></label>
              <label className="filter-select-label"><span className="sr-only">Filter by district</span><select className="filter-select" onChange={(event) => setDistrict(event.target.value)} value={district}><option>All districts</option>{districts.map((name) => <option key={name}>{name}</option>)}</select></label>
            </div>
          </div>
          <div className="table-scroll"><table><thead><tr><th>VILLAGE</th><th>DISTRICT / BLOCK</th><th>SERVICE COVERAGE</th><th>PENDING CASES</th><th>SERVICE GAPS</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>
            {filtered.map((village) => (
              <tr key={village.village_id}>
                <td><div className="village-name">{village.village}</div><div className="village-id">{village.village_id}</div></td>
                <td><div className="district-name">{village.district}</div><div className="village-id">{village.block} block</div></td>
                <td><div className="table-coverage"><div className="table-progress"><span style={{ width: `${overallCoverage(village)}%` }} /></div><strong>{formatPercent(overallCoverage(village))}</strong></div></td>
                <td><span className="pending-number">{village.pending_cases}</span></td>
                <td>{villageGapCount(village)} of 4</td>
                <td><Link className="row-link" href={`/villages/${village.village_id}`} aria-label={`View ${village.village}`}>↗</Link></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td className="empty-state" colSpan={6}>No villages match these filters.</td></tr>}
          </tbody></table></div>
          <div className="table-footer"><span>Showing <strong>{filtered.length}</strong> of <strong>{villages.length}</strong> live records</span><span>Priority scores are not included in the village API</span></div>
        </section>
      )}
    </AppShell>
  );
}
