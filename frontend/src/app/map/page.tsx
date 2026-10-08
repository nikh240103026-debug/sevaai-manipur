import { AppShell, PageHeading } from "@/components/app-shell";
import MapCanvas from "@/components/map-canvas";
import { districts } from "@/lib/demo-data";

export default function MapPage() {
  return (
    <AppShell title="Map">
      <PageHeading
        eyebrow="MANIPUR · GEOGRAPHIC INTELLIGENCE"
        title="Priority areas map"
        detail="Explore Manipur’s district boundaries and the available sample service-risk data."
      />
      <div className="demo-notice map-demo-notice">
        <span className="notice-icon" aria-hidden="true">ⓘ</span>
        <span><strong>Demo environment</strong> · All markers and values are synthetic sample data, not official statistics.</span>
        <span className="notice-period">16 districts · 4 with sample scores</span>
      </div>
      <section className="panel standalone-map-panel">
        <div className="map-panel-header">
          <div className="section-heading">
            <div>
              <div className="section-eyebrow">MANIPUR · DISTRICT BOUNDARIES</div>
              <h2>District risk overview</h2>
              <p>Hover a district for its summary, or click it for details.</p>
            </div>
          </div>
          <div className="map-legend">
            <span><i className="legend-dot legend-high" /> High risk</span>
            <span><i className="legend-dot legend-medium" /> Moderate risk</span>
            <span><i className="legend-dot legend-low" /> Lower risk</span>
          </div>
        </div>
        <MapCanvas />
        <div className="map-attribution-note">
          District boundaries: geoBoundaries India ADM2 (2021), ODbL 1.0; state outline: geoBoundaries India ADM1 (2011), CC BY 2.5 IN. Map tiles © OpenStreetMap contributors. Risk metrics and village markers are synthetic demo data.
        </div>
      </section>
      <section className="standalone-district-grid">
        {districts.map((district) => (
          <article className="panel district-summary-card" key={district.name}>
            <div className="section-eyebrow">DISTRICT SNAPSHOT</div>
            <h2>{district.name}</h2>
            <div className="district-summary-value">{district.coverage}% <span>coverage</span></div>
            <div className="progress-track" role="progressbar" aria-label={`${district.name} service coverage`} aria-valuenow={district.coverage} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${district.coverage}%`, backgroundColor: "#6274ed" }} />
            </div>
            <p>{district.villages} priority villages · {district.gap}% service gap</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
