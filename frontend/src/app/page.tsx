"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, apiRequest } from "@/lib/api/client";
import { getActiveDataset } from "@/lib/api/data-upload";
import type { ActiveDataset } from "@/types/data-upload";
import type {
  DashboardPriorityVillage,
  DashboardSummary,
  PriorityLevel,
} from "@/types/dashboard";

type IconName =
  | "activity"
  | "chevron-down"
  | "download"
  | "grid"
  | "layers"
  | "map"
  | "menu"
  | "pin"
  | "shield"
  | "users"
  | "x";

const iconPaths: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  "chevron-down": <path d="m7 10 5 5 5-5" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
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

const navigation = [
  { label: "Dashboard", icon: "grid" as const, href: "/dashboard" },
  { label: "Map", icon: "map" as const, href: "/map" },
  { label: "Analytics", icon: "activity" as const, href: "/analytics" },
  { label: "Villages", icon: "users" as const, href: "/villages" },
  { label: "Data Upload", icon: "layers" as const, href: "/data-upload" },
];

const management = [
  { label: "Alerts", icon: "activity" as const, href: "/alerts" },
  { label: "Interventions", icon: "layers" as const, href: "/interventions" },
];

const serviceDisplay = [
  { key: "housing", label: "Housing", color: "var(--chart-indigo)" },
  { key: "health", label: "Health", color: "var(--chart-blue)" },
  { key: "water", label: "Water", color: "var(--chart-teal)" },
  { key: "welfare", label: "Welfare", color: "var(--chart-violet)" },
] as const;

const priorityDisplay: {
  key: keyof DashboardSummary["priority"];
  label: string;
  tone: string;
}[] = [
  { key: "high", label: "High", tone: "rose" },
  { key: "medium", label: "Medium", tone: "amber" },
  { key: "low", label: "Low", tone: "teal" },
];

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatRole(role: string): string {
  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Sidebar({
  open,
  onClose,
  fullName,
  role,
  activeDataset,
  datasetLoadError,
}: {
  open: boolean;
  onClose: () => void;
  fullName: string;
  role: string;
  activeDataset: ActiveDataset | null;
  datasetLoadError: boolean;
}) {
  const pathname = usePathname();
  const navGroups = [navigation, management];

  return (
    <>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={onClose}
          type="button"
        />
      )}
      <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
        <Link className="brand" href="/dashboard" onClick={onClose}>
          <span className="brand-mark">
            <Icon name="activity" size={21} />
          </span>
          <span className="brand-copy">
            <strong>
              seva<span>ai</span>
            </strong>
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

        {navGroups.map((group, index) => (
          <div key={index}>
            <div className={`workspace-label${index ? " management-label" : ""}`}>
              {index ? "MANAGEMENT" : "WORKSPACE"}
            </div>
            <nav
              className="side-nav"
              aria-label={index ? "Management navigation" : "Main navigation"}
            >
              {group.map((item) => (
                <Link
                  className={`nav-link${pathname === item.href || (item.href === "/dashboard" && pathname === "/") ? " nav-link-active" : ""}`}
                  href={item.href}
                  key={item.label}
                  onClick={onClose}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <Icon name="shield" size={18} />
            </div>
            <strong>Built for better decisions</strong>
            <p>
              {activeDataset?.mode === "GOVERNMENT_UPLOAD"
                ? `Insights use validated government-upload records${activeDataset.filename ? ` from ${activeDataset.filename}` : ""}.`
                : activeDataset
                  ? "Insights use synthetic demo records for decision support."
                  : datasetLoadError
                    ? "The active dataset status could not be loaded."
                    : "Checking the active dataset."}
            </p>
            <a href="#data-notice">
              About this data <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="profile">
            <div className="avatar">{getInitials(fullName)}</div>
            <div className="profile-copy">
              <strong>{fullName}</strong>
              <span>{formatRole(role)}</span>
            </div>
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
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  note: string;
  tone: "indigo" | "teal" | "amber" | "rose";
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <div className={`metric-icon metric-icon-${tone}`}>
          <Icon name={icon} size={19} />
        </div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function formatCount(value: number | null): string {
  return value === null ? "Data unavailable" : numberFormatter.format(value);
}

function formatPercent(value: number | null): string {
  return value === null ? "Data unavailable" : `${percentFormatter.format(value)}%`;
}

function serviceGaps(village: DashboardPriorityVillage): {
  label: string;
  value: number;
}[] {
  return [
    { label: "Housing", value: village.housing_gap },
    { label: "Health", value: village.health_gap },
    { label: "Water", value: village.water_gap },
    { label: "Welfare", value: village.welfare_gap },
  ]
    .filter((gap) => gap.value > 0)
    .sort((a, b) => b.value - a.value);
}

function exportPriorityVillages(rows: DashboardPriorityVillage[]): void {
  const header = [
    "Village ID",
    "Village",
    "District",
    "Block",
    "Priority Score",
    "Priority Level",
    "Housing Gap",
    "Health Gap",
    "Water Gap",
    "Welfare Gap",
  ];
  const lines = rows.map((row) => [
    row.village_id,
    row.village,
    row.district,
    row.block,
    row.priority_score,
    row.priority_level,
    row.housing_gap,
    row.health_gap,
    row.water_gap,
    row.welfare_gap,
  ]);
  const csv = [header, ...lines]
    .map((line) =>
      line
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "sevaai-priority-villages.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return "Your session may have expired. Please sign in again.";
  }
  return "We couldn’t load the dashboard right now. Check your connection and try again.";
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDataset, setActiveDataset] = useState<ActiveDataset | null>(null);
  const [datasetLoadError, setDatasetLoadError] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    let isCurrentRequest = true;
    getActiveDataset()
      .then((result) => {
        if (isCurrentRequest) setActiveDataset(result);
      })
      .catch(() => {
        if (isCurrentRequest) setDatasetLoadError(true);
      });
    return () => {
      isCurrentRequest = false;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      return;
    }

    let isCurrentRequest = true;

    apiRequest<DashboardSummary>("/api/v1/dashboard/summary")
      .then((result) => {
        if (isCurrentRequest) {
          setSummary(result);
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrentRequest) {
          setError(getLoadErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [authLoading, reloadKey, user]);

  const isLoading = authLoading || (Boolean(user) && loading);
  const coverageValues = summary
    ? Object.values(summary.service_coverage)
    : [];
  const averageCoverage = coverageValues.length === 4 &&
      coverageValues.every((value): value is number => value !== null)
    ? coverageValues.reduce((total, value) => total + value, 0) / 4
    : null;

  return (
    <div className="dashboard-shell" id="dashboard">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        fullName={user?.full_name ?? ""}
        role={user?.role ?? ""}
        activeDataset={activeDataset}
        datasetLoadError={datasetLoadError}
      />

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
            <span className="topbar-date">
              Data scope <strong>{user ? formatRole(user.role) : "Loading"}</strong>
            </span>
            <span className="demo-topbar-badge" title={activeDataset?.filename ?? undefined}>
              {activeDataset?.mode === "GOVERNMENT_UPLOAD"
                ? `GOVERNMENT DATA${activeDataset.filename ? ` · ${activeDataset.filename}` : ""}`
                : activeDataset
                  ? "DEMO DATA"
                  : datasetLoadError
                    ? "DATASET STATUS UNAVAILABLE"
                    : "LOADING DATASET"}
            </span>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row">
            <div>
              <div className="welcome-overline">
                <span className="live-dot" />
                MANIPUR · SERVICE OVERVIEW
              </div>
              <h1>
                Welcome{user?.full_name ? `, ${user.full_name}` : ""}
                <span aria-hidden="true"> ✳</span>
              </h1>
              <p>
                Current service coverage, pending cases, and priority signals in
                your permitted scope.
              </p>
            </div>
            {summary && summary.top_priority_villages.length > 0 && (
              <button
                className="button button-secondary export-button"
                onClick={() =>
                  exportPriorityVillages(summary.top_priority_villages)
                }
                type="button"
              >
                <Icon name="download" size={16} />
                Export priority villages
              </button>
            )}
          </section>

          <div className="demo-notice" id="data-notice">
            <span className="notice-icon">
              <Icon name="shield" size={16} />
            </span>
            <span>
              <strong>
                {activeDataset?.mode === "GOVERNMENT_UPLOAD"
                  ? `Government dataset${activeDataset.filename ? ` · ${activeDataset.filename}` : ""}`
                  : activeDataset
                    ? "Synthetic/demo dataset"
                    : "Dataset selection"}
              </strong>
              {" · "}
              {activeDataset?.mode === "GOVERNMENT_UPLOAD"
                ? "Dashboard metrics reflect the active uploaded records."
                : "When no eligible upload is available, the synthetic demo dataset is used."}
            </span>
          </div>
          {summary && !summary.analytics_available && summary.total_villages > 0 && (
            <div className="dashboard-state dashboard-state-empty" role="status">
              Priority scoring and some service metrics are unavailable because the active records do not contain all required fields.
            </div>
          )}

          {isLoading ? (
            <div className="dashboard-state" role="status" aria-live="polite">
              <span className="loading-indicator" />
              Loading dashboard summary…
            </div>
          ) : error ? (
            <div className="dashboard-state dashboard-state-error" role="alert">
              <p>{error}</p>
              <button
                className="button button-secondary"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  setReloadKey((key) => key + 1);
                }}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : !user ? (
            <div className="dashboard-state" role="status">
              Redirecting to sign in…
            </div>
          ) : summary ? (
            <>
              {summary.total_villages === 0 && (
                <div
                  className="dashboard-state dashboard-state-empty"
                  role="status"
                >
                  No village records are available in your permitted scope.
                </div>
              )}

              <section
                className="metrics-grid"
                aria-label="Dashboard summary metrics"
              >
                <MetricCard
                  icon="users"
                  label="Villages monitored"
                  value={formatCount(summary.total_villages)}
                  note="In your permitted scope"
                  tone="indigo"
                />
                <MetricCard
                  icon="activity"
                  label="Total population"
                  value={formatCount(summary.total_population)}
                  note="Across available village records"
                  tone="teal"
                />
                <MetricCard
                  icon="layers"
                  label="Pending cases"
                  value={formatCount(summary.total_pending_cases)}
                  note="Across available village records"
                  tone="amber"
                />
                <MetricCard
                  icon="pin"
                  label="Unusual villages"
                  value={formatCount(summary.unusual_villages)}
                  note="Statistical decision-support signals"
                  tone="rose"
                />
              </section>

              <section
                className="insight-grid"
                aria-label="Coverage and priority analysis"
              >
                <article className="panel coverage-panel" id="analytics">
                  <SectionHeading
                    eyebrow="SERVICE DELIVERY"
                    title="Service coverage"
                    detail="Average village coverage by service area"
                  />
                  <div className="coverage-summary">
                    <div>
                      <strong>
                        {formatPercent(averageCoverage)}
                      </strong>
                      <span className="summary-caption">overall average</span>
                    </div>
                    <div className="coverage-summary-note">
                      <span>Across four service areas</span>
                    </div>
                  </div>
                  <div className="coverage-bars">
                    {serviceDisplay.map((service) => {
                      const value = summary.service_coverage[service.key];
                      return (
                        <div className="coverage-row" key={service.key}>
                          <div className="coverage-label">
                            <span>{service.label}</span>
                            <strong>{formatPercent(value)}</strong>
                          </div>
                          <div
                            className="progress-track"
                            role="progressbar"
                            aria-label={`${service.label} coverage`}
                            aria-valuenow={value ?? undefined}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <span
                              style={{
                                width: `${value ?? 0}%`,
                                backgroundColor: service.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="coverage-footer">
                    <span>
                      <i className="coverage-legend" /> Current coverage
                    </span>
                    <span className="small-muted">
                      Aggregated from available village records
                    </span>
                  </div>
                </article>

                <article className="panel priority-panel" id="priority">
                  <SectionHeading
                    eyebrow="DECISION SUPPORT"
                    title="Priority distribution"
                    detail="Village counts by backend analytics priority level"
                  />
                  <div className="priority-count-list">
                    {priorityDisplay.map((item) => (
                      <div className="priority-count-row" key={item.key}>
                        <span
                          className={`priority-badge priority-badge-${item.label.toLowerCase()}`}
                        >
                          <i />
                          {item.label}
                        </span>
                        <strong>{formatCount(summary.priority[item.key])}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="priority-callout">
                    <div className="callout-icon">
                      <Icon name="activity" size={17} />
                    </div>
                    <div>
                      <strong>
                        {formatCount(summary.unusual_villages)} unusual
                        {summary.unusual_villages === 1 ? " village" : " villages"}
                      </strong>
                      <span>
                        Isolation Forest signals for decision support only;
                        unusual does not mean wrongdoing.
                      </span>
                    </div>
                  </div>
                </article>
              </section>

              <section className="panel village-panel" id="villages">
                <div className="village-panel-header">
                  <SectionHeading
                    eyebrow="FIELD INTELLIGENCE"
                    title="Top priority villages"
                    detail={`${formatCount(summary.top_priority_villages.length)} highest priority records returned by the dashboard API`}
                  />
                  {summary.top_priority_villages.length > 0 && (
                    <button
                      className="button button-secondary table-export"
                      onClick={() =>
                        exportPriorityVillages(summary.top_priority_villages)
                      }
                      type="button"
                    >
                      <Icon name="download" size={15} />
                      Export
                    </button>
                  )}
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>VILLAGE</th>
                        <th>DISTRICT / BLOCK</th>
                        <th>PRIORITY SCORE</th>
                        <th>LEVEL</th>
                        <th>MAJOR SERVICE GAPS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.top_priority_villages.map((village) => (
                        <tr key={village.village_id}>
                          <td>
                            <div className="village-name">
                              {village.village}
                            </div>
                            <div className="village-id">
                              {village.village_id}
                            </div>
                          </td>
                          <td>
                            <div className="district-name">
                              {village.district}
                            </div>
                            <div className="village-id">{village.block}</div>
                          </td>
                          <td>
                            <span className="pending-number">
                              {percentFormatter.format(village.priority_score)}
                            </span>
                          </td>
                          <td>
                            <PriorityBadge level={village.priority_level} />
                          </td>
                          <td className="service-gap-cell">
                            {serviceGaps(village).length > 0 ? (
                              serviceGaps(village).map((gap) => (
                                <span
                                  className="service-gap-chip"
                                  key={gap.label}
                                >
                                  {gap.label} {formatPercent(gap.value)}
                                </span>
                              ))
                            ) : (
                              <span className="small-muted">
                                No service coverage gaps
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {summary.top_priority_villages.length === 0 && (
                        <tr>
                          <td className="empty-state" colSpan={5}>
                            {summary.total_villages === 0
                              ? "No villages are available in your permitted scope."
                              : "No top-priority villages were returned."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">
                  <span>
                    Showing{" "}
                    <strong>
                      {formatCount(summary.top_priority_villages.length)}
                    </strong>{" "}
                    villages
                  </span>
                  <Link href="/villages">
                    Explore villages <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </section>

              <section className="intervention-placeholder" id="interventions">
                <span className="intervention-icon">
                  <Icon name="layers" size={17} />
                </span>
                <div>
                  <strong>Intervention tracking is coming next</strong>
                  <p>
                    Intervention management will be connected when its API is
                    available.
                  </p>
                </div>
                <span className="preview-pill">PREVIEW</span>
              </section>
            </>
          ) : null}

          <footer className="dashboard-footer">
            <span>
              SevaAI Manipur <span aria-hidden="true">·</span> Decision support
              for public services
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function PriorityBadge({ level }: { level: PriorityLevel }) {
  return (
    <span className={`priority-badge priority-badge-${level.toLowerCase()}`}>
      <i />
      {level}
    </span>
  );
}
