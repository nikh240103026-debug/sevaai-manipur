import { AppShell } from "@/components/layout/app-shell";

const metrics = [
  {
    label: "Villages monitored",
    value: "—",
    description: "Awaiting live API data",
  },
  {
    label: "Service coverage",
    value: "—",
    description: "Calculated from village indicators",
  },
  {
    label: "Priority gaps",
    value: "—",
    description: "Detected from service coverage",
  },
  {
    label: "Pending cases",
    value: "—",
    description: "Awaiting live API data",
  },
];

const pipeline = [
  ["01", "Village data", "Population and service indicators"],
  ["02", "Gap detection", "Identify coverage shortfalls"],
  ["03", "Prioritization", "Rank areas requiring attention"],
  ["04", "Decision support", "Present clear actionable insight"],
];

export default function Home() {
  return (
    <AppShell>
      <div className="space-y-8">
        <section className="animate-[fadeUp_400ms_ease-out]">
          <div className="max-w-3xl">
            <p className="mb-2 text-sm font-semibold text-primary">
              Welfare Intelligence
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              See where public services are reaching communities — and where
              gaps remain.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              SevaAI brings village-level service indicators together to help
              administrators identify coverage gaps, prioritize areas, and
              make data-driven decisions.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
              style={{
                animation: `fadeUp 400ms ease-out ${index * 70}ms both`,
              }}
            >
              <p className="text-sm font-medium text-muted">
                {metric.label}
              </p>

              <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">
                {metric.value}
              </p>

              <p className="mt-2 text-xs leading-5 text-muted">
                {metric.description}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Service coverage overview
                </p>

                <p className="mt-1 text-xs text-muted">
                  Coverage analytics will be calculated from the FastAPI
                  village dataset.
                </p>
              </div>

              <span className="mt-2 w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:mt-0">
                Data-driven
              </span>
            </div>

            <div className="mt-6 flex min-h-64 items-center justify-center rounded-xl bg-surface-muted p-6">
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3v18h18" />
                    <path d="m7 16 4-5 3 3 5-7" />
                  </svg>
                </div>

                <p className="mt-4 text-sm font-semibold text-foreground">
                  Analytics layer ready
                </p>

                <p className="mt-2 text-xs leading-5 text-muted">
                  Once the dashboard connects to village data, this area will
                  show service coverage trends and gap distribution.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-card)]">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Intelligence pipeline
              </p>

              <p className="mt-1 text-xs text-muted">
                From raw indicators to actionable administrative insight.
              </p>
            </div>

            <div className="mt-6 space-y-5">
              {pipeline.map(([number, title, description]) => (
                <div key={number} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                    {number}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {title}
                    </p>

                    <p className="mt-0.5 text-xs leading-5 text-muted">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Village intelligence
            </p>

            <p className="mt-1 text-xs text-muted">
              Village-level insights will appear here once the API data layer
              is connected.
            </p>
          </div>

          <div className="mt-5 rounded-xl bg-surface-muted p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">Geographic coverage</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  District → Block → Village
                </p>
              </div>

              <div>
                <p className="text-xs text-muted">Service indicators</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Health · Housing · Water · Welfare
                </p>
              </div>

              <div>
                <p className="text-xs text-muted">Decision layer</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Gaps → Priority → Action
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </AppShell>
  );
}