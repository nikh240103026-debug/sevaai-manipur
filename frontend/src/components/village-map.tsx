"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { DataState } from "@/components/data-state";
import {
  fetchAllVillages,
  fetchMapVillages,
  formatPercent,
  overallCoverage,
  services,
} from "@/lib/village-data";
import type { Village, VillageMapPoint } from "@/types/village";

const bandColors = {
  high: "#bd494c",
  medium: "#ad761c",
  low: "#318d78",
  unknown: "#68758a",
};

function coverageBand(village: Village | undefined) {
  if (!village) return "unknown";
  const coverage = overallCoverage(village);
  if (coverage < 50) return "high";
  if (coverage < 75) return "medium";
  return "low";
}

function FitVillageBounds({ points }: { points: VillageMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = points.map((point) => [point.latitude, point.longitude] as [number, number]);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 });
  }, [map, points]);
  return null;
}

export default function VillageMap() {
  const [mapPoints, setMapPoints] = useState<VillageMapPoint[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchMapVillages(controller.signal),
      fetchAllVillages(controller.signal),
    ])
      .then(([points, records]) => {
        setMapPoints(points.filter((point) =>
          Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
        ));
        setVillages(records);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load map data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const villagesById = useMemo(
    () => new Map(villages.map((village) => [village.village_id, village])),
    [villages],
  );

  if (loading || error || mapPoints.length === 0) {
    return <DataState loading={loading} error={error} empty={!loading && !error ? "The map API returned no village locations." : undefined} />;
  }

  return (
    <MapContainer
      center={[24.78, 93.88]}
      zoom={8}
      scrollWheelZoom={false}
      className="leaflet-map"
      style={{ display: "block", width: "100%", height: "min(58vh, 600px)", minHeight: 360, marginTop: 16, borderRadius: 8 }}
      aria-label="Map of villages using backend coordinates"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitVillageBounds points={mapPoints} />
      {mapPoints.map((point) => {
        const village = villagesById.get(point.village_id);
        const band = coverageBand(village);
        const metrics = village
          ? services.map((service) => ({
              label: service.label,
              gap: 100 - village[service.coverage],
            })).sort((a, b) => b.gap - a.gap)
          : [];
        return (
          <CircleMarker
            key={point.village_id}
            center={[point.latitude, point.longitude]}
            radius={band === "high" ? 8 : band === "medium" ? 6 : 5}
            pathOptions={{ color: "#fff", weight: 1.5, fillColor: bandColors[band], fillOpacity: 0.95 }}
          >
            <Popup>
              <strong>{point.village}</strong>
              <br />{point.district} · {point.block}
              {village ? (
                <>
                  <br />{band.toUpperCase()} coverage band · {formatPercent(overallCoverage(village))}
                  <br />Pending cases: {village.pending_cases.toLocaleString()} ({formatPercent(village.pending_rate)})
                  <br />Largest service gap: {metrics[0]?.label ?? "Not available"} ({metrics[0] ? formatPercent(metrics[0].gap) : "—"})
                  <br /><span>Priority score: not provided by API</span>
                  <br /><Link href={`/villages/${point.village_id}`}>View village details →</Link>
                </>
              ) : (
                <><br />Service and pending details are unavailable for this map point.</>
              )}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
