import { AppShell, PageHeading } from "@/components/app-shell";
import MapCanvas from "@/components/map-canvas";

export default function MapPage() {
  return (
    <AppShell title="Map">
      <PageHeading
        eyebrow="GEOGRAPHIC INTELLIGENCE"
        title="Village locations"
        detail="Explore the locations and available priority signals in your active dataset."
      />
      <section className="panel standalone-map-panel">
        <div className="map-panel-header">
          <div className="section-heading">
            <div>
              <div className="section-eyebrow">MANIPUR · ACTIVE DATASET</div>
              <h2>Village map</h2>
              <p>Markers are shown only for records with supplied coordinates.</p>
            </div>
          </div>
          <div className="map-legend">
            <span><i className="legend-dot legend-high" /> High priority</span>
            <span><i className="legend-dot legend-medium" /> Medium priority</span>
            <span><i className="legend-dot legend-low" /> Low priority</span>
          </div>
        </div>
        <MapCanvas />
        <div className="map-attribution-note">
          District boundaries: geoBoundaries India ADM2 (2021), ODbL 1.0; state outline: geoBoundaries India ADM1 (2011), CC BY 2.5 IN. Map tiles © OpenStreetMap contributors. Village records and available indicators come from the active dataset.
        </div>
      </section>
    </AppShell>
  );
}
