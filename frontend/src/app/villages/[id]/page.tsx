import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, PageHeading } from "@/components/app-shell";
import { villages } from "@/lib/demo-data";

export function generateStaticParams() {
  return villages.map((village) => ({ id: village.id }));
}

export default async function VillageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const village = villages.find((item) => item.id === id);
  if (!village) notFound();

  return (
    <AppShell title="Villages">
      <Link className="back-link" href="/villages">← Back to village directory</Link>
      <PageHeading
        eyebrow={`${village.district.toUpperCase()} · ${village.block.toUpperCase()} BLOCK`}
        title={village.name}
        detail={`Village ID ${village.id} · Synthetic sample record`}
        action={<span className={`priority-badge priority-badge-${village.priority.toLowerCase()}`}><i />{village.priority} priority</span>}
      />
      <div className="demo-notice">
        <span className="notice-icon" aria-hidden="true">ⓘ</span>
        <span><strong>Demo environment</strong> · This village profile contains synthetic data and is not an official record.</span>
      </div>
      <section className="metrics-grid village-detail-metrics">
        <article className="metric-card"><div className="metric-icon metric-icon-indigo">◷</div><div className="metric-value">{village.coverage}%</div><div className="metric-label">Overall service coverage</div><div className="metric-note">Synthetic average across four services</div></article>
        <article className="metric-card"><div className="metric-icon metric-icon-amber">◇</div><div className="metric-value">{village.pending}</div><div className="metric-label">Pending cases</div><div className="metric-note">Sample cases for exploration</div></article>
        <article className="metric-card"><div className="metric-icon metric-icon-teal">⌖</div><div className="metric-value">{village.district}</div><div className="metric-label">District</div><div className="metric-note">{village.block} block</div></article>
        <article className="metric-card"><div className="metric-icon metric-icon-rose">!</div><div className="metric-value">{village.priority}</div><div className="metric-label">Review priority</div><div className="metric-note">Based on synthetic service signals</div></article>
      </section>
      <section className="panel service-detail-panel">
        <div className="section-heading"><div><div className="section-eyebrow">SERVICE SNAPSHOT</div><h2>Coverage by service area</h2><p>Illustrative household coverage for this sample village</p></div></div>
        <div className="coverage-bars detail-service-bars">{village.services.map((service, index) => (
          <div className="coverage-row" key={service.name}><div className="coverage-label"><span>{service.name}</span><strong>{service.coverage}%</strong></div><div className="progress-track"><span style={{ width: `${service.coverage}%`, backgroundColor: ["#6274ed", "#54a1eb", "#3fb6a4", "#9a7be7"][index] }} /></div></div>
        ))}</div>
      </section>
    </AppShell>
  );
}
