import { AppShell, PageHeading } from "@/components/app-shell";
import MapCanvas from "@/components/map-canvas";

export default function MapPage() {
  return (
    <AppShell title="Map">
      <PageHeading
        eyebrow="MANIPUR · GEOGRAPHIC INTELLIGENCE"
        title="Village attention map"
        detail="Locate villages and inspect service coverage gaps and pending cases."
      />
      <section className="panel standalone-map-panel">
        <div className="map-panel-header">
          <div className="section-heading"><div><div className="section-eyebrow">VILLAGE LOCATIONS</div><h2>Coverage-based attention bands</h2><p>Marker bands use live overall coverage only; they are not backend priority scores.</p></div></div>
          <div className="map-legend">
            <span><i className="legend-dot legend-high" /> High attention · &lt;50% coverage</span>
            <span><i className="legend-dot legend-medium" /> Medium · 50–&lt;75%</span>
            <span><i className="legend-dot legend-low" /> Low · ≥75%</span>
          </div>
        </div>
        <MapCanvas />
        <p className="data-note">Village locations come from GET /api/v1/map/villages. Service metrics are joined from the paginated village API. Backend priority fields are not currently returned.</p>
      </section>
    </AppShell>
  );
}
