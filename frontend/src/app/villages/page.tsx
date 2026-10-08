"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { districts, villages } from "@/lib/demo-data";

export default function VillagesPage() {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("All districts");
  const [priority, setPriority] = useState("All priorities");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return villages.filter((village) => {
      const matchesQuery = !query || `${village.id} ${village.name} ${village.district} ${village.block}`.toLowerCase().includes(query);
      return matchesQuery &&
        (district === "All districts" || village.district === district) &&
        (priority === "All priorities" || village.priority === priority);
    });
  }, [district, priority, search]);

  return (
    <AppShell title="Villages">
      <PageHeading
        eyebrow="FIELD INTELLIGENCE"
        title="Village directory"
        detail="Search and compare service coverage in the synthetic village dataset."
        action={<span className="priority-period">{filtered.length} demo records</span>}
      />
      <div className="demo-notice">
        <span className="notice-icon" aria-hidden="true">ⓘ</span>
        <span><strong>Demo environment</strong> · All village details and service coverage are synthetic sample data.</span>
      </div>
      <section className="panel village-panel directory-panel">
        <div className="village-panel-header">
          <div className="section-heading"><div><div className="section-eyebrow">MANIPUR · SAMPLE RECORDS</div><h2>Monitored villages</h2><p>{filtered.length} {filtered.length === 1 ? "village" : "villages"} match your filters</p></div></div>
          <div className="table-tools">
            <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search villages" onChange={(event) => setSearch(event.target.value)} placeholder="Search villages..." type="search" value={search} /></label>
            <label className="filter-select-label"><span className="sr-only">Filter by district</span><select className="filter-select" onChange={(event) => setDistrict(event.target.value)} value={district}><option>All districts</option>{districts.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
            <label className="filter-select-label"><span className="sr-only">Filter by priority</span><select className="filter-select" onChange={(event) => setPriority(event.target.value)} value={priority}><option>All priorities</option><option>High</option><option>Medium</option></select></label>
          </div>
        </div>
        <div className="table-scroll"><table><thead><tr><th>VILLAGE</th><th>DISTRICT / BLOCK</th><th>SERVICE COVERAGE</th><th>PENDING CASES</th><th>PRIORITY</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>
          {filtered.map((village) => (
            <tr key={village.id}>
              <td><div className="village-name">{village.name}</div><div className="village-id">{village.id}</div></td>
              <td><div className="district-name">{village.district}</div><div className="village-id">{village.block} block</div></td>
              <td><div className="table-coverage"><div className="table-progress"><span style={{ width: `${village.coverage}%` }} /></div><strong>{village.coverage}%</strong></div></td>
              <td><span className="pending-number">{village.pending}</span></td>
              <td><span className={`priority-badge priority-badge-${village.priority.toLowerCase()}`}><i />{village.priority}</span></td>
              <td><Link className="row-link" href={`/villages/${village.id}`} aria-label={`View ${village.name}`}>↗</Link></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td className="empty-state" colSpan={6}>No demo villages match these filters.</td></tr>}
        </tbody></table></div>
        <div className="table-footer"><span>Showing <strong>{filtered.length}</strong> synthetic demo records</span><span>Coverage values are illustrative</span></div>
      </section>
    </AppShell>
  );
}
