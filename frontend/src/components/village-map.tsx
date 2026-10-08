"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { geoJSON } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { riskAreas, villages } from "@/lib/demo-data";

type BoundaryProperties = {
  shapeName?: string;
  layer?: "district" | "state-outline";
};

type BoundaryFeature = Feature<Geometry, BoundaryProperties>;
type BoundaryCollection = FeatureCollection<Geometry, BoundaryProperties>;

type DistrictDetails = {
  name: string;
  risk: "High" | "Moderate" | "Lower" | "No sample data";
  coverage?: number;
  villages?: number;
  gap?: number;
  mainGap?: string;
  pending?: number;
};

const riskColors = {
  High: { stroke: "#d85d5a", fill: "#e87872" },
  Moderate: { stroke: "#d28a2e", fill: "#edb34f" },
  Lower: { stroke: "#318d78", fill: "#53b49a" },
};

function FitManipurBounds({ feature }: { feature: BoundaryFeature }) {
  const map = useMap();

  useEffect(() => {
    const bounds = geoJSON(feature).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 8 });
    }
  }, [feature, map]);

  return null;
}

function makeTooltipContent(details: DistrictDetails) {
  const container = document.createElement("div");
  container.className = "risk-map-tooltip-content";

  const heading = document.createElement("strong");
  heading.textContent = details.name;
  container.append(heading);

  const summary = document.createElement("span");
  summary.textContent = details.coverage === undefined
    ? "No risk data in the demo snapshot"
    : `${details.risk} risk · ${details.coverage}% average coverage`;
  container.append(summary);

  if (details.coverage !== undefined) {
    const metrics = document.createElement("span");
    metrics.textContent =
      `${details.villages} priority villages · ${details.gap}% service gap`;
    container.append(metrics);

    const gap = document.createElement("span");
    gap.textContent = `Largest service gap: ${details.mainGap}`;
    container.append(gap);
  }

  const hint = document.createElement("em");
  hint.textContent = "Click district for details";
  container.append(hint);
  return container;
}

export default function VillageMap() {
  const [boundaries, setBoundaries] = useState<BoundaryCollection | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictDetails | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBoundaries() {
      try {
        const response = await fetch("/manipur-districts.geojson", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Boundary data request failed (${response.status}).`);
        }
        const data = await response.json() as BoundaryCollection;
        const hasManipur = data.features.some(
          (feature) => feature.properties?.layer === "state-outline",
        );
        const districtCount = data.features.filter(
          (feature) => feature.properties?.layer === "district",
        ).length;
        if (!hasManipur || districtCount !== 16) {
          throw new Error("The Manipur boundary dataset is incomplete.");
        }
        setBoundaries(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBoundaryError(
          error instanceof Error
            ? error.message
            : "Unable to load Manipur boundary data.",
        );
      }
    }

    void loadBoundaries();
    return () => controller.abort();
  }, []);

  const districtFeatures = useMemo<BoundaryCollection | null>(() => {
    if (!boundaries) return null;
    return {
      ...boundaries,
      features: boundaries.features.filter(
        (feature) => feature.properties?.layer === "district",
      ),
    };
  }, [boundaries]);

  const stateFeature = useMemo<BoundaryFeature | null>(() => {
    if (!boundaries) return null;
    return boundaries.features.find(
      (feature) => feature.properties?.layer === "state-outline",
    ) ?? null;
  }, [boundaries]);

  function districtDetails(feature: BoundaryFeature): DistrictDetails {
    const name = feature.properties?.shapeName ?? "Unknown district";
    const sample = riskAreas.find((area) => area.name === name);
    return sample
      ? { ...sample }
      : { name, risk: "No sample data" };
  }

  function styleDistrict(feature?: BoundaryFeature): PathOptions {
    if (feature?.properties?.layer === "state-outline") {
      return {
        color: "#435776",
        weight: 3,
        fill: false,
        interactive: false,
      };
    }

    const sample = riskAreas.find(
      (area) => area.name === feature?.properties?.shapeName,
    );
    if (!sample) {
      return {
        color: "#8998aa",
        weight: 1,
        fillColor: "#dce3eb",
        fillOpacity: 0.55,
      };
    }

    const colors = riskColors[sample.risk];
    return {
      color: colors.stroke,
      weight: selectedDistrict?.name === sample.name ? 3 : 1.5,
      fillColor: colors.fill,
      fillOpacity: selectedDistrict?.name === sample.name ? 0.78 : 0.62,
    };
  }

  function bindDistrictEvents(feature: BoundaryFeature, layer: Layer) {
    if (feature.properties?.layer !== "district") return;

    const details = districtDetails(feature);
    layer.bindTooltip(() => makeTooltipContent(details), {
      sticky: true,
      direction: "top",
      opacity: 1,
      className: "risk-map-tooltip",
    });
    layer.on({
      click: () => setSelectedDistrict(details),
      mouseover: () => {
        if ("setStyle" in layer && typeof layer.setStyle === "function") {
          layer.setStyle({ weight: 3, fillOpacity: details.coverage ? 0.78 : 0.75 });
        }
      },
      mouseout: () => {
        if ("setStyle" in layer && typeof layer.setStyle === "function") {
          layer.setStyle(styleDistrict(feature));
        }
      },
    });
  }

  return (
    <>
      <MapContainer
        center={[24.78, 93.88]}
        zoom={8}
        scrollWheelZoom={false}
        className="leaflet-map"
        style={{
          display: "block",
          width: "100%",
          height: "min(58vh, 540px)",
          minHeight: 330,
          marginTop: 16,
          borderRadius: 8,
        }}
        aria-label="Map showing actual Manipur district boundaries and sample service risk zones"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districtFeatures && (
          <GeoJSON
            key={selectedDistrict?.name ?? "districts"}
            data={districtFeatures}
            style={(feature) => styleDistrict(feature as BoundaryFeature)}
            onEachFeature={(feature, layer) =>
              bindDistrictEvents(feature as BoundaryFeature, layer)
            }
          />
        )}
        {stateFeature && (
          <>
            <GeoJSON
              data={stateFeature}
              style={(feature) => styleDistrict(feature as BoundaryFeature)}
            />
            <FitManipurBounds feature={stateFeature} />
          </>
        )}
        {villages.map((village) => (
          <CircleMarker
            key={village.id}
            center={[village.latitude, village.longitude]}
            radius={village.priority === "High" ? 7 : 5}
            pathOptions={{
              color: "#fff",
              weight: 1.5,
              fillColor: village.priority === "High" ? "#bd494c" : "#ad761c",
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <strong>{village.name}</strong>
              <br />
              {village.district} · {village.coverage}% coverage
              <br />
              {village.pending} pending cases · {village.priority} priority
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {boundaryError && (
        <p className="map-boundary-error" role="alert">
          {boundaryError} Refresh the page to try again.
        </p>
      )}
      {selectedDistrict ? (
        <section className="risk-area-details" aria-live="polite">
          <div className="risk-area-details-main">
            <div className="section-eyebrow">SELECTED DISTRICT</div>
            <h3>{selectedDistrict.name}</h3>
            <p>
              {selectedDistrict.coverage === undefined
                ? "This district has no sample risk metrics in the demo snapshot."
                : `${selectedDistrict.risk} risk · ${selectedDistrict.villages} priority villages · largest service gap: ${selectedDistrict.mainGap}`}
            </p>
          </div>
          {selectedDistrict.coverage !== undefined && (
            <>
              <div className="risk-area-stat">
                <span>Avg. coverage</span>
                <strong>{selectedDistrict.coverage}%</strong>
              </div>
              <div className="risk-area-stat">
                <span>Service gap</span>
                <strong>{selectedDistrict.gap}%</strong>
              </div>
              <div className="risk-area-stat">
                <span>Pending cases</span>
                <strong>{selectedDistrict.pending}</strong>
              </div>
            </>
          )}
          <button
            aria-label="Close selected district details"
            className="icon-button risk-area-close"
            onClick={() => setSelectedDistrict(null)}
            type="button"
          >
            ×
          </button>
        </section>
      ) : (
        <p className="map-interaction-hint">
          Hover over a district to see its risk summary; click a district for
          more details. Grey areas have no sample risk metrics.
        </p>
      )}
    </>
  );
}
