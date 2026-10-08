import { AppShell, PageHeading } from "@/components/app-shell";
import { districts, serviceCoverage } from "@/lib/demo-data";
import "./analytics.module.css";

const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const currentCoverage = [58, 61, 60, 65, 64, 69, 67, 71.3];
const previousCoverage = [55, 57, 56, 59, 58, 62, 61, 64];
const graphPoints = currentCoverage.map((value, index) => ({
  x: 42 + index * 65,
  y: 177 - ((value - 50) / 30) * 150,
  month: months[index],
  value,
}));
const priorGraphPoints = previousCoverage.map((value, index) => ({
  x: 42 + index * 65,
  y: 177 - ((value - 50) / 30) * 150,
}));

function smoothPath(points: { x: number; y: number }[]) {
  const [first, ...remaining] = points;
  if (!first) return "";

  return remaining.reduce((path, point, index) => {
    const previous = points[index] ?? first;
    const next = points[index + 2] ?? point;
    const control1X = previous.x + (point.x - (points[index - 1] ?? previous).x) / 6;
    const control1Y = previous.y + (point.y - (points[index - 1] ?? previous).y) / 6;
    const control2X = point.x - (next.x - previous.x) / 6;
    const control2Y = point.y - (next.y - previous.y) / 6;
    return `${path} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${point.x} ${point.y}`;
  }, `M ${first.x} ${first.y}`);
}

export default function AnalyticsPage() {
  return (
    <AppShell title="Analytics">
      <PageHeading
        eyebrow="DECISION SUPPORT"
        title="Service analytics"
        detail="Compare sample service coverage and review notable district-level gaps."
        action={<span className="priority-period analytics-period">Reporting period · Mar 2025</span>}
      />
      <div className="demo-notice">
        <span className="notice-icon" aria-hidden="true">ⓘ</span>
        <span><strong>Demo environment</strong> · These sample trends are synthetic and do not represent official statistics.</span>
      </div>
      <section className="metrics-grid analytics-metrics">
        <article className="metric-card"><div className="metric-icon metric-icon-indigo">◷</div><div className="metric-value">71.3%</div><div className="metric-label">Average service coverage</div><div className="metric-note">+2.4% vs. previous period</div></article>
        <article className="metric-card"><div className="metric-icon metric-icon-teal">♧</div><div className="metric-value">1,426</div><div className="metric-label">Sample records reviewed</div><div className="metric-note">Across 16 districts</div></article>
        <article className="metric-card"><div className="metric-icon metric-icon-amber">◇</div><div className="metric-value">206</div><div className="metric-label">Priority villages</div><div className="metric-note">10.3% of monitored villages</div></article>
        <article className="metric-card"><div className="metric-icon metric-icon-rose">!</div><div className="metric-value">08</div><div className="metric-label">Open alerts</div><div className="metric-note">3 high priority</div></article>
      </section>
      <section className="analytics-grid">
        <article className="panel analytics-chart-panel trendPanel">
          <div className="section-heading trendHeader">
            <div><div className="section-eyebrow">COVERAGE TREND</div><h2>Service delivery over time</h2><p>Illustrative monthly average coverage</p></div>
            <span className="trendChange"><span aria-hidden="true">↗</span> 2.4%</span>
          </div>
          <div className="chartSummary">
            <strong>71.3%</strong>
            <span>average coverage</span>
            <small>March 2025</small>
          </div>
          <div className="chartFrame">
            <svg
              className="trendSvg"
              viewBox="0 0 510 205"
              role="img"
              aria-label="Synthetic sample service coverage trend from August through March, ending at 71.3 percent"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="coverage-area-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6274ed" stopOpacity=".23" />
                  <stop offset="100%" stopColor="#6274ed" stopOpacity=".015" />
                </linearGradient>
              </defs>
              {[50, 60, 70, 80].map((tick) => {
                const y = 177 - ((tick - 50) / 30) * 150;
                return (
                  <g key={tick}>
                    <line className="gridLine" x1="36" y1={y} x2="498" y2={y} />
                    <text className="axisLabel" x="0" y={y + 4}>{tick}%</text>
                  </g>
                );
              })}
              <path
                className="priorArea"
                d={smoothPath(priorGraphPoints)}
              />
              <path
                className="currentArea"
                d={`M ${graphPoints[0].x} 177 L ${graphPoints[0].x} ${graphPoints[0].y} ${smoothPath(graphPoints).slice(smoothPath(graphPoints).indexOf(" C"))} L ${graphPoints.at(-1)?.x} 177 Z`}
              />
              <path
                className="currentLine"
                d={smoothPath(graphPoints)}
              />
              {graphPoints.slice(0, -1).map((point) => (
                <circle
                  className="dataPoint"
                  cx={point.x}
                  cy={point.y}
                  key={point.month}
                  r="3.5"
                >
                  <title>{point.month}: {point.value}% average coverage</title>
                </circle>
              ))}
              <circle className="pointHalo" cx={497} cy={70} r="12" />
              <circle className="latestPoint" cx={497} cy={70} r="5" />
              <g transform="translate(453 37)">
                <rect width="48" height="22" rx="6" fill="#3346bb" />
                <text className="latestLabel" x="24" y="15" textAnchor="middle">71.3%</text>
              </g>
              <title>Monthly service coverage, August 2024 through March 2025</title>
            </svg>
          </div>
          <div className="monthLabels">{months.map((month) => <span key={month}>{month}</span>)}</div>
          <div className="chartLegend">
            <span className="chartLegendItem"><i className="legendCurrent" /> Current period</span>
            <span className="chartLegendItem"><i className="legendPrevious" /> Previous period</span>
          </div>
        </article>
        <article className="panel analytics-chart-panel">
          <div className="section-heading"><div><div className="section-eyebrow">SERVICE BREAKDOWN</div><h2>Coverage by service</h2><p>Sample average household coverage</p></div></div>
          <div className="coverage-bars analytics-coverage-bars">
            {serviceCoverage.map((item) => (
              <div className="coverage-row" key={item.label}>
                <div className="coverage-label"><span>{item.label}</span><strong>{item.value}%</strong></div>
                <div className="progress-track"><span style={{ width: `${item.value}%`, backgroundColor: item.color }} /></div>
              </div>
            ))}
          </div>
          <div className="analytics-insight"><strong>Largest sample gap</strong><span>Drinking water · 59% coverage</span></div>
        </article>
      </section>
      <section className="panel analytics-district-panel">
        <div className="section-heading"><div><div className="section-eyebrow">DISTRICT COMPARISON</div><h2>Coverage and priority signals</h2><p>Selected districts in the synthetic demo snapshot</p></div></div>
        <div className="table-scroll"><table><thead><tr><th>DISTRICT</th><th>AVG. COVERAGE</th><th>PRIORITY VILLAGES</th><th>EST. SERVICE GAP</th><th>FLAG</th></tr></thead><tbody>
          {districts.map((district) => <tr key={district.name}><td><div className="district-name">{district.name}</div></td><td>{district.coverage}%</td><td>{district.villages}</td><td>{district.gap}%</td><td><span className={`priority-badge ${district.gap > 30 ? "priority-badge-high" : "priority-badge-medium"}`}><i />{district.gap > 30 ? "Review" : "Monitor"}</span></td></tr>)}
        </tbody></table></div>
      </section>
    </AppShell>
  );
}
