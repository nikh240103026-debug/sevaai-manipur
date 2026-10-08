"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

type IconName =
  | "activity"
  | "arrow-down"
  | "arrow-up"
  | "bell"
  | "chevron-down"
  | "download"
  | "filter"
  | "grid"
  | "layers"
  | "map"
  | "menu"
  | "pin"
  | "search"
  | "shield"
  | "users"
  | "water"
  | "x";

type Village = {
  id: string;
  name: string;
  district: string;
  block: string;
  coverage: number;
  pending: number;
  priority: "High" | "Medium";
};

const iconPaths: Record<IconName, ReactNode> = {
  activity: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  "arrow-down": (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  "arrow-up": (
    <>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  "chevron-down": <path d="m7 10 5 5 5-5" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  filter: (
    <>
      <path d="M4 7h16" />
      <path d="M7 12h10" />
      <path d="M10 17h4" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  water: (
    <>
      <path d="M12 3s7 8 7 12a7 7 0 1 1-14 0c0-4 7-12 7-12Z" />
      <path d="M9 16a3 3 0 0 0 3 3" />
    </>
  ),
  x: (
    <>
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </>
  ),
};

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

const villages: Village[] = [
  {
    id: "MAN-BIS-01-002",
    name: "Bishnupur Demo Village 002",
    district: "Bishnupur",
    block: "Bishnupur",
    coverage: 67,
    pending: 5,
    priority: "High",
  },
  {
    id: "MAN-BIS-01-004",
    name: "Bishnupur Demo Village 004",
    district: "Bishnupur",
    block: "Bishnupur",
    coverage: 78,
    pending: 36,
    priority: "High",
  },
  {
    id: "MAN-CCP-02-018",
    name: "Churachandpur Demo Village 018",
    district: "Churachandpur",
    block: "Churachandpur",
    coverage: 61,
    pending: 29,
    priority: "High",
  },
  {
    id: "MAN-IE-03-007",
    name: "Imphal East Demo Village 007",
    district: "Imphal East",
    block: "Keirao",
    coverage: 73,
    pending: 14,
    priority: "Medium",
  },
  {
    id: "MAN-SNP-04-021",
    name: "Senapati Demo Village 021",
    district: "Senapati",
    block: "Saitu",
    coverage: 69,
    pending: 22,
    priority: "Medium",
  },
];

const coverage = [
  { label: "Housing", value: 76, color: "var(--chart-indigo)" },
  { label: "Healthcare", value: 68, color: "var(--chart-blue)" },
  { label: "Drinking water", value: 59, color: "var(--chart-teal)" },
  { label: "Welfare", value: 82, color: "var(--chart-violet)" },
];

const priorityDistricts = [
  { name: "Churachandpur", villages: 42, gap: 38, tone: "rose" },
  { name: "Senapati", villages: 36, gap: 32, tone: "amber" },
  { name: "Bishnupur", villages: 31, gap: 28, tone: "blue" },
  { name: "Imphal East", villages: 24, gap: 21, tone: "teal" },
];

const navigation = [
  { label: "Dashboard", icon: "grid" as const, href: "/dashboard" },
  { label: "Map", icon: "map" as const, href: "/map" },
  { label: "Analytics", icon: "activity" as const, href: "/analytics" },
  { label: "Villages", icon: "users" as const, href: "/villages" },
];

const management = [
  { label: "Alerts", icon: "bell" as const, href: "/alerts" },
  { label: "Interventions", icon: "layers" as const, href: "/interventions" },
];

function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}
      <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
        <Link className="brand" href="/dashboard" onClick={onClose}>
          <span className="brand-mark">
            <Icon name="activity" size={21} />
          </span>
          <span className="brand-copy">
            <strong>seva<span>ai</span></strong>
            <small>MANIPUR · INTELLIGENCE</small>
          </span>
        </Link>
        <button
          className="icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={onClose}
          type="button"
        >
          <Icon name="x" />
        </button>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map((item, index) => (
            <Link
              className={`nav-link${pathname === item.href || (index === 0 && pathname === "/") ? " nav-link-active" : ""}`}
              href={item.href}
              key={item.label}
              onClick={onClose}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "Alerts" && <span className="nav-count">08</span>}
            </Link>
          ))}
        </nav>

        <div className="workspace-label management-label">MANAGEMENT</div>
        <nav className="side-nav" aria-label="Management navigation">
          {management.map((item) => (
            <Link
              className={`nav-link${pathname === item.href ? " nav-link-active" : ""}`}
              href={item.href}
              key={item.label}
              onClick={onClose}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "Alerts" && <span className="nav-count">08</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <Icon name="shield" size={18} />
            </div>
            <strong>Built for better decisions</strong>
            <p>Demo insights are synthetic and for exploration only.</p>
            <a href="#data-notice">About this data <span aria-hidden="true">↗</span></a>
          </div>
          <div className="profile">
            <div className="avatar">AD</div>
            <div className="profile-copy">
              <strong>Admin Demo</strong>
              <span>State administrator</span>
            </div>
            <button
              className="icon-button profile-menu"
              aria-label="Profile options"
              title="Profile options"
              type="button"
            >
              <Icon name="chevron-down" size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  change,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  note: string;
  change: string;
  tone: "indigo" | "teal" | "amber" | "rose";
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <div className={`metric-icon metric-icon-${tone}`}>
          <Icon name={icon} size={19} />
        </div>
        <span className={`metric-change metric-change-${tone}`}>
          {tone === "rose" ? (
            <Icon name="arrow-up" size={13} />
          ) : (
            <Icon name="arrow-up" size={13} />
          )}
          {change}
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function MapIllustration() {
  return (
    <div className="map-illustration">
      <div className="map-grid" />
      <svg
        className="manipur-map"
        viewBox="0 0 470 330"
        role="img"
        aria-label="Schematic illustration of Manipur with sample village markers"
      >
        <defs>
          <linearGradient id="landFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e5edff" />
            <stop offset="100%" stopColor="#dce8f7" />
          </linearGradient>
          <pattern
            id="landPattern"
            width="8"
            height="8"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              x2="0"
              y1="0"
              y2="8"
              stroke="#ffffff"
              strokeOpacity=".45"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <path
          className="map-land-shadow"
          d="m227 18 34 19 36-4 23 23 35 8 5 32 29 15-8 34 23 30-9 31 21 22-17 32-36 8-19 29-39 7-25-22-35 15-29-18-36 2-22-27-35-8-11-34-27-18 9-34-16-27 16-26-9-34 31-7 18-31 39-4 19-26 30 7Z"
          transform="translate(0 7)"
        />
        <path
          className="map-land"
          d="m227 18 34 19 36-4 23 23 35 8 5 32 29 15-8 34 23 30-9 31 21 22-17 32-36 8-19 29-39 7-25-22-35 15-29-18-36 2-22-27-35-8-11-34-27-18 9-34-16-27 16-26-9-34 31-7 18-31 39-4 19-26 30 7Z"
        />
        <path
          className="map-land-pattern"
          d="m227 18 34 19 36-4 23 23 35 8 5 32 29 15-8 34 23 30-9 31 21 22-17 32-36 8-19 29-39 7-25-22-35 15-29-18-36 2-22-27-35-8-11-34-27-18 9-34-16-27 16-26-9-34 31-7 18-31 39-4 19-26 30 7Z"
        />
        <path className="map-boundary" d="m217 93 61-13 28 25-12 40 42 28-21 38 8 49" />
        <path className="map-boundary" d="m155 163 52 9 22 43 57-13" />
        <path className="map-boundary" d="m203 44 15 49-11 79-9 56" />
        <path className="map-boundary" d="m306 105 50-9m-73 54 67 23m-127 39 29 54" />
        <text className="map-district" x="245" y="127">Kangpokpi</text>
        <text className="map-district" x="273" y="188">Imphal East</text>
        <text className="map-district" x="214" y="205">Imphal West</text>
        <text className="map-district" x="280" y="235">Bishnupur</text>
        <text className="map-district" x="143" y="161">Tamenglong</text>
        <text className="map-district" x="182" y="269">Churachandpur</text>
        <g className="map-marker marker-high" transform="translate(301 225)">
          <circle className="marker-pulse" r="15" />
          <circle className="marker-core" r="6" />
        </g>
        <g className="map-marker marker-medium" transform="translate(284 185)">
          <circle className="marker-pulse" r="12" />
          <circle className="marker-core" r="5" />
        </g>
        <g className="map-marker marker-high" transform="translate(222 249)">
          <circle className="marker-pulse" r="14" />
          <circle className="marker-core" r="5.5" />
        </g>
        <g className="map-marker marker-medium" transform="translate(328 123)">
          <circle className="marker-pulse" r="12" />
          <circle className="marker-core" r="5" />
        </g>
        <g className="map-marker marker-medium" transform="translate(182 125)">
          <circle className="marker-pulse" r="11" />
          <circle className="marker-core" r="4.5" />
        </g>
        <g className="map-marker marker-high" transform="translate(254 174)">
          <circle className="marker-pulse" r="14" />
          <circle className="marker-core" r="5.5" />
        </g>
      </svg>
      <div className="map-caption">
        <span><i className="legend-dot legend-high" /> High priority</span>
        <span><i className="legend-dot legend-medium" /> Medium priority</span>
        <span className="map-caption-note">Schematic · not for navigation</span>
      </div>
    </div>
  );
}

function exportVillageSnapshot(rows: Village[]) {
  const header = ["Village ID", "Village", "District", "Block", "Coverage %", "Pending", "Priority"];
  const lines = rows.map((row) => [
    row.id,
    row.name,
    row.district,
    row.block,
    row.coverage,
    row.pending,
    row.priority,
  ]);
  const csv = [header, ...lines]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "sevaai-demo-villages.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("All districts");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredVillages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return villages.filter((village) => {
      const matchesSearch =
        !query ||
        `${village.id} ${village.name} ${village.district} ${village.block}`
          .toLowerCase()
          .includes(query);
      const matchesDistrict =
        district === "All districts" || village.district === district;
      return matchesSearch && matchesDistrict;
    });
  }, [district, search]);

  return (
    <div className="dashboard-shell" id="dashboard">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              type="button"
            >
              <Icon name={sidebarOpen ? "x" : "menu"} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-slash">/</span>
              <strong>Dashboard</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="topbar-date">Reporting period <strong>Mar 2025</strong></span>
            <a
              className="api-link"
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noreferrer"
              title="Open the FastAPI documentation"
            >
              API docs <span aria-hidden="true">↗</span>
            </a>
            <button
              className="icon-button notification-button"
              aria-label="Notifications (demo)"
              title="Notifications are not connected yet"
              type="button"
            >
              <Icon name="bell" />
              <span className="notification-dot" />
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row">
            <div>
              <div className="welcome-overline">
                <span className="live-dot" />
                MANIPUR · STATE OVERVIEW
              </div>
              <h1>Good morning, Admin <span aria-hidden="true">✳</span></h1>
              <p>Here&apos;s what&apos;s happening across your service landscape.</p>
            </div>
            <button
              className="button button-secondary export-button"
              onClick={() => exportVillageSnapshot(filteredVillages)}
              type="button"
            >
              <Icon name="download" size={16} />
              Export snapshot
            </button>
          </section>

          <div className="demo-notice" id="data-notice">
            <span className="notice-icon"><Icon name="shield" size={16} /></span>
            <span><strong>Demo environment</strong> · All figures and map markers are synthetic sample data, not official statistics.</span>
            <span className="notice-period">Reporting date: 31 Mar 2025</span>
          </div>

          <section className="metrics-grid" aria-label="Dashboard summary metrics">
            <MetricCard
              icon="users"
              label="Villages monitored"
              value="2,000"
              note="Across 16 districts"
              change="All districts"
              tone="indigo"
            />
            <MetricCard
              icon="activity"
              label="Average service coverage"
              value="71.3%"
              note="Across 4 service areas"
              change="+2.4%"
              tone="teal"
            />
            <MetricCard
              icon="layers"
              label="Pending cases"
              value="1,284"
              note="Across monitored villages"
              change="−8.2%"
              tone="amber"
            />
            <MetricCard
              icon="pin"
              label="Priority villages"
              value="206"
              note="Need closer review"
              change="10.3%"
              tone="rose"
            />
          </section>

          <section className="insight-grid" aria-label="Coverage and priority analysis">
            <article className="panel coverage-panel" id="analytics">
              <SectionHeading
                eyebrow="SERVICE DELIVERY"
                title="Service coverage"
                detail="Average household coverage by service area"
                action={<button className="panel-more" type="button" aria-label="Coverage options">•••</button>}
              />
              <div className="coverage-summary">
                <div>
                  <strong>71.3<span>%</span></strong>
                  <span className="summary-caption">overall average</span>
                </div>
                <div className="coverage-summary-note">
                  <span className="trend-up"><Icon name="arrow-up" size={14} /> 2.4%</span>
                  <span>vs. previous period</span>
                </div>
              </div>
              <div className="coverage-bars">
                {coverage.map((item) => (
                  <div className="coverage-row" key={item.label}>
                    <div className="coverage-label">
                      <span>{item.label}</span>
                      <strong>{item.value}%</strong>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={`${item.label} coverage`}
                      aria-valuenow={item.value}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="coverage-footer">
                <span><i className="coverage-legend" /> Current coverage</span>
                <span className="small-muted">Coverage varies by village</span>
              </div>
            </article>

            <article className="panel priority-panel" id="priority">
              <SectionHeading
                eyebrow="DECISION SUPPORT"
                title="Priority & gap analysis"
                detail="Districts with the largest combined service gaps"
                action={<span className="priority-period">This period <Icon name="chevron-down" size={14} /></span>}
              />
              <div className="priority-callout">
                <div className="callout-icon"><Icon name="activity" size={17} /></div>
                <div>
                  <strong>206 villages flagged for review</strong>
                  <span>Based on multiple service gaps in this demo snapshot</span>
                </div>
                <span className="callout-pill">10.3%</span>
              </div>
              <div className="district-list">
                {priorityDistricts.map((item, index) => (
                  <div className="district-row" key={item.name}>
                    <span className="district-rank">{String(index + 1).padStart(2, "0")}</span>
                    <div className="district-main">
                      <div className="district-label">
                        <strong>{item.name}</strong>
                        <span>{item.villages} priority villages</span>
                      </div>
                      <div className="priority-track">
                        <span
                          className={`priority-fill priority-fill-${item.tone}`}
                          style={{ width: `${item.gap * 2}%` }}
                        />
                      </div>
                    </div>
                    <span className={`gap-value gap-${item.tone}`}>{item.gap}%</span>
                  </div>
                ))}
              </div>
              <a className="text-link" href="#villages">Explore priority villages <span aria-hidden="true">→</span></a>
            </article>
          </section>

          <section className="panel map-panel" id="map">
            <div className="map-panel-header">
              <SectionHeading
                eyebrow="GEOGRAPHIC INTELLIGENCE"
                title="Village overview"
                detail="Explore sample service coverage and priority signals across Manipur"
              />
              <label className="select-wrap">
                <Icon name="filter" size={16} />
                <select
                  aria-label="Filter villages by district"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                >
                  <option>All districts</option>
                  {["Bishnupur", "Churachandpur", "Imphal East", "Senapati"].map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <Icon name="chevron-down" size={14} />
              </label>
            </div>
            <div className="map-layout">
              <MapIllustration />
              <div className="map-side">
                <div className="map-stat-card">
                  <div className="map-stat-heading"><span>AT A GLANCE</span><Icon name="pin" size={16} /></div>
                  <div className="map-stat"><strong>16</strong><span>districts included</span></div>
                  <div className="map-stat-divider" />
                  <div className="map-stat"><strong>2,000</strong><span>sample villages</span></div>
                </div>
                <div className="map-alert-card">
                  <div className="alert-accent" />
                  <div>
                    <strong>Areas to explore</strong>
                    <p>Churachandpur and Senapati show higher sample service gaps.</p>
                    <a href="#priority">View priority analysis <span aria-hidden="true">→</span></a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel village-panel" id="villages">
            <div className="village-panel-header">
              <SectionHeading
                eyebrow="FIELD INTELLIGENCE"
                title="Priority villages"
                detail={`${filteredVillages.length} sample ${filteredVillages.length === 1 ? "village" : "villages"} shown · sorted by review priority`}
              />
              <div className="table-tools">
                <label className="search-box">
                  <Icon name="search" size={17} />
                  <input
                    aria-label="Search sample villages"
                    placeholder="Search villages..."
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Clear search"
                      className="clear-search"
                      onClick={() => setSearch("")}
                      type="button"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                </label>
                <button
                  className="button button-secondary table-export"
                  onClick={() => exportVillageSnapshot(filteredVillages)}
                  type="button"
                >
                  <Icon name="download" size={15} />
                  Export
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>VILLAGE</th>
                    <th>DISTRICT / BLOCK</th>
                    <th>SERVICE COVERAGE</th>
                    <th>PENDING CASES</th>
                    <th>PRIORITY</th>
                    <th><span className="sr-only">Open village</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVillages.map((village) => (
                    <tr key={village.id}>
                      <td>
                        <div className="village-name">{village.name}</div>
                        <div className="village-id">{village.id}</div>
                      </td>
                      <td>
                        <div className="district-name">{village.district}</div>
                        <div className="village-id">{village.block} block</div>
                      </td>
                      <td>
                        <div className="table-coverage">
                          <div className="table-progress"><span style={{ width: `${village.coverage}%` }} /></div>
                          <strong>{village.coverage}%</strong>
                        </div>
                      </td>
                      <td><span className="pending-number">{village.pending}</span></td>
                      <td>
                        <span className={`priority-badge priority-badge-${village.priority.toLowerCase()}`}>
                          <i />
                          {village.priority}
                        </span>
                      </td>
                      <td><Link className="row-link" href={`/villages/${village.id}`} aria-label={`View details for ${village.name}`}>↗</Link></td>
                    </tr>
                  ))}
                  {filteredVillages.length === 0 && (
                    <tr>
                      <td className="empty-state" colSpan={6}>No sample villages match your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>Showing <strong>{filteredVillages.length}</strong> demo records</span>
              <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">Connect to village API <span aria-hidden="true">↗</span></a>
            </div>
          </section>

          <section className="intervention-placeholder" id="interventions">
            <span className="intervention-icon"><Icon name="layers" size={17} /></span>
            <div>
              <strong>Intervention tracking is coming next</strong>
              <p>This dashboard preview is ready to connect when the intervention API is available.</p>
            </div>
            <span className="preview-pill">PREVIEW</span>
          </section>

          <footer className="dashboard-footer">
            <span>SevaAI Manipur <span aria-hidden="true">·</span> Decision support for public services</span>
            <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">FastAPI documentation <span aria-hidden="true">↗</span></a>
          </footer>
        </div>
      </main>
    </div>
  );
}
