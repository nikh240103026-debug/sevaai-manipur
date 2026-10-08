import Link from "next/link";

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 15 3-4 3 2 5-7" />
      <path d="M15 6h3v3" />
    </svg>
  );
}

function VillageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <path d="M3 21h18" />
      <path d="M5 21V10l7-5 7 5v11" />
      <path d="M9 21v-5h6v5" />
      <path d="M9 11h.01" />
      <path d="M15 11h.01" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.4v-.2a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.56-1.03H6.6v-2.4h.24A1.7 1.7 0 0 0 8.4 10a1.7 1.7 0 0 0-.34-1.88L8 8.06l1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56V5h2.4v.2a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1.03h.24v2.4h-.24A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

const primaryNavigation = [
  {
    label: "Dashboard",
    href: "/",
    icon: DashboardIcon,
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: AnalyticsIcon,
    disabled: true,
  },
  {
    label: "Villages",
    href: "/villages",
    icon: VillageIcon,
    disabled: true,
  },
  {
    label: "Map",
    href: "/map",
    icon: MapIcon,
    disabled: true,
  },
];

const secondaryNavigation = [
  {
    label: "Settings",
    href: "/settings",
    icon: SettingsIcon,
    disabled: true,
  },
];

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  return (
    <aside
      className={[
        "flex h-full w-64 flex-col bg-surface",
        mobile ? "border-r border-border" : "border-r border-border",
      ].join(" ")}
    >
      <div className="flex h-20 items-center px-6">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3"
          aria-label="SevaAI Manipur dashboard"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <span className="text-lg font-bold">S</span>
          </span>

          <span className="min-w-0">
            <span className="block truncate text-base font-bold tracking-tight text-foreground">
              SevaAI
            </span>
            <span className="block text-xs font-medium text-muted">
              Manipur Intelligence
            </span>
          </span>
        </Link>
      </div>

      <div className="px-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Overview
        </p>

        <nav aria-label="Primary navigation" className="space-y-1">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <span
                  key={item.label}
                  className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground opacity-60"
                  title={`${item.label} is coming next`}
                >
                  <Icon />
                  <span>{item.label}</span>
                </span>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                className="group flex h-11 items-center gap-3 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md"
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto px-4 pb-5">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          System
        </p>

        <nav aria-label="System navigation" className="space-y-1">
          {secondaryNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <span
                key={item.label}
                className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground opacity-60"
              >
                <Icon />
                <span>{item.label}</span>
              </span>
            );
          })}
        </nav>

        <div className="mt-5 rounded-2xl bg-surface-muted p-4">
          <p className="text-xs font-semibold text-foreground">
            SevaAI Manipur
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            Welfare & public service gap intelligence platform.
          </p>
        </div>
      </div>
    </aside>
  );
}