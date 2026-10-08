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
import { getVillageMapPoints } from "@/lib/api/villages";
import type { VillageMapPoint } from "@/types/village";

type BoundaryProperties = {
  shapeName?: string;
  layer?: "district" | "state-outline";
};

type BoundaryFeature = Feature<Geometry, BoundaryProperties>;
type BoundaryCollection = FeatureCollection<Geometry, BoundaryProperties>;
type DistrictDetails = {
  name: string;
  records: VillageMapPoint[];
  averagePriority: number | null;
};

function FitManipurBounds({ feature }: { feature: BoundaryFeature }) {
  const map = useMap();
  useEffect(() => {
    const bounds = geoJSON(feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 8 });
  }, [feature, map]);
  return null;
}

function priorityColor(level: VillageMapPoint["priority_level"]): string {
  if (level === "HIGH") return "#bd494c";
  if (level === "MEDIUM") return "#ad761c";
  if (level === "LOW") return "#318d78";
  return "#64748b";
}

function makeTooltipContent(details: DistrictDetails) {
  const container = document.createElement("div");
  container.className = "risk-map-tooltip-content";
  const heading = document.createElement("strong");
  heading.textContent = details.name;
  container.append(heading);
  const summary = document.createElement("span");
  summary.textContent = details.records.length
    ? `${details.records.length} active dataset records${details.averagePriority === null ? "" : ` · ${details.averagePriority.toFixed(1)} average priority score`}`
    : "No active dataset villages with coordinates";
  container.append(summary);
  const gapNames = details.records
    .map((record) => record.major_service_gap)
    .filter((gap): gap is string => gap !== null);
  const majorGap = gapNames.sort((a, b) =>
    gapNames.filter((name) => name === b).length
    - gapNames.filter((name) => name === a).length
  )[0];
  if (majorGap) {
    const gap = document.createElement("span");
    gap.textContent = `Most common major gap: ${majorGap}`;
    container.append(gap);
  }
  return container;
}

export default function VillageMap() {
  const [boundaries, setBoundaries] = useState<BoundaryCollection | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [mapPoints, setMapPoints] = useState<VillageMapPoint[]>([]);
  const [pointsError, setPointsError] = useState("");
  const [pointsLoading, setPointsLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictDetails | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/manipur-districts.geojson", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Boundary data request failed (${response.status}).`);
        return await response.json() as BoundaryCollection;
      })
      .then((data) => {
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
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setBoundaryError(error instanceof Error ? error.message : "Unable to load Manipur boundaries.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let current = true;
    getVillageMapPoints()
      .then((points) => {
        if (current) {
          setMapPoints(points);
          setPointsError("");
        }
      })
      .catch(() => {
        if (current) setPointsError("Map data could not be loaded. Check your connection and try again.");
      })
      .finally(() => {
        if (current) setPointsLoading(false);
      });
    return () => {
      current = false;
    };
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

  function detailsFor(name: string): DistrictDetails {
    const records = mapPoints.filter(
      (point) => point.district.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    const scores = records.flatMap((record) =>
      record.priority_score === null ? [] : [record.priority_score],
    );
    return {
      name,
      records,
      averagePriority: scores.length
        ? scores.reduce((total, score) => total + score, 0) / scores.length
        : null,
    };
  }

  function styleDistrict(feature?: BoundaryFeature): PathOptions {
    if (feature?.properties?.layer === "state-outline") {
      return { color: "#435776", weight: 3, fill: false, interactive: false };
    }
    const name = feature?.properties?.shapeName ?? "";
    const details = detailsFor(name);
    const selected = selectedDistrict?.name === name;
    const color = details.records.some((item) => item.priority_level === "HIGH")
      ? { stroke: "#d85d5a", fill: "#e87872" }
      : details.records.some((item) => item.priority_level === "MEDIUM")
        ? { stroke: "#d28a2e", fill: "#edb34f" }
        : details.records.length
          ? { stroke: "#318d78", fill: "#53b49a" }
          : { stroke: "#8998aa", fill: "#dce3eb" };
    return {
      color: color.stroke,
      weight: selected ? 3 : 1.5,
      fillColor: color.fill,
      fillOpacity: selected ? 0.78 : 0.55,
    };
  }

  function bindDistrictEvents(feature: BoundaryFeature, layer: Layer) {
    if (feature.properties?.layer !== "district") return;
    const name = feature.properties.shapeName ?? "Unknown district";
    const details = detailsFor(name);
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
          layer.setStyle({ weight: 3, fillOpacity: 0.75 });
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
        aria-label="Map showing active dataset village locations in Manipur"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districtFeatures && (
          <GeoJSON
            key={`${selectedDistrict?.name ?? "districts"}-${mapPoints.length}`}
            data={districtFeatures}
            style={(feature) => styleDistrict(feature as BoundaryFeature)}
            onEachFeature={(feature, layer) => bindDistrictEvents(feature as BoundaryFeature, layer)}
          />
        )}
        {stateFeature && (
          <>
            <GeoJSON data={stateFeature} style={(feature) => styleDistrict(feature as BoundaryFeature)} />
            <FitManipurBounds feature={stateFeature} />
          </>
        )}
        {mapPoints.map((point) => (
          <CircleMarker
            key={point.village_id}
            center={[point.latitude, point.longitude]}
            radius={point.priority_level === "HIGH" ? 7 : 5}
            pathOptions={{
              color: "#fff",
              weight: 1.5,
              fillColor: priorityColor(point.priority_level),
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <strong>{point.village}</strong><br />
              {point.district}{point.block ? ` · ${point.block}` : ""}
              <br />
              {point.priority_level ? `${point.priority_level} priority` : "Priority unavailable"}
              {point.priority_score !== null ? ` · Score ${point.priority_score.toFixed(1)}` : ""}
              {point.major_service_gap ? <><br />Major gap: {point.major_service_gap}</> : null}
              {point.anomaly_status ? <><br />Anomaly: {point.anomaly_status.toLowerCase()}</> : null}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {boundaryError && <p className="map-boundary-error" role="alert">{boundaryError}</p>}
      {pointsError && <p className="upload-feedback upload-feedback-error" role="alert">{pointsError}</p>}
      {!pointsError && !pointsLoading && mapPoints.length === 0 && (
        <p className="map-interaction-hint">No village coordinates are available in the active dataset. Locations are not estimated or filled in.</p>
      )}
      {pointsLoading && <p className="map-interaction-hint" role="status">Loading active dataset locations…</p>}
      {selectedDistrict && (
        <section className="risk-area-details" aria-live="polite">
          <div className="risk-area-details-main">
            <div className="section-eyebrow">SELECTED DISTRICT</div>
            <h3>{selectedDistrict.name}</h3>
            <p>{selectedDistrict.records.length
              ? `${selectedDistrict.records.length} active dataset records with coordinates`
              : "No active dataset records with coordinates in this district."}</p>
          </div>
          <div className="risk-area-stat">
            <span>Average priority</span>
            <strong>{selectedDistrict.averagePriority === null ? "Unavailable" : selectedDistrict.averagePriority.toFixed(1)}</strong>
          </div>
          <div className="risk-area-stat">
            <span>Unusual patterns</span>
            <strong>{selectedDistrict.records.filter((record) => record.anomaly_status === "UNUSUAL").length}</strong>
          </div>
          <button
            aria-label="Close selected district details"
            className="icon-button risk-area-close"
            onClick={() => setSelectedDistrict(null)}
            type="button"
          >×</button>
        </section>
      )}
    </>
  );
}
