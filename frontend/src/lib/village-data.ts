import { apiRequest, hasApiConfiguration } from "@/lib/client";
import { isLocalDemoSession } from "@/lib/local-passkey";
import { villages as localDemoRecords } from "@/lib/demo-data";
import type { Village, VillageMapPoint, VillagePage } from "@/types/village";

export const services = [
  {
    key: "housing",
    label: "Housing",
    eligible: "housing_eligible",
    covered: "housing_covered",
    coverage: "housing_coverage",
    historical: "historical_housing_coverage",
    color: "#6274ed",
  },
  {
    key: "health",
    label: "Health",
    eligible: "health_eligible",
    covered: "health_covered",
    coverage: "health_coverage",
    historical: "historical_health_coverage",
    color: "#54a1eb",
  },
  {
    key: "water",
    label: "Water",
    eligible: "water_eligible",
    covered: "water_covered",
    coverage: "water_coverage",
    historical: "historical_water_coverage",
    color: "#3fb6a4",
  },
  {
    key: "welfare",
    label: "Welfare",
    eligible: "welfare_eligible",
    covered: "welfare_covered",
    coverage: "welfare_coverage",
    historical: "historical_welfare_coverage",
    color: "#9a7be7",
  },
] as const;

export type ServiceKey = (typeof services)[number]["key"];

export const localDemoVillages: Village[] = localDemoRecords.map((record, index) => {
  const eligibleHouseholds = 90 + index * 5;
  const serviceValues = services.map((service, serviceIndex) => {
    const source = record.services[serviceIndex];
    const eligible = eligibleHouseholds;
    const covered = Math.round(eligible * (source?.coverage ?? record.coverage) / 100);
    return {
      eligible,
      covered,
      coverage: covered / eligible * 100,
      historical: Math.max(0, covered / eligible * 100 - 3),
    };
  });
  const pendingCases = Math.min(record.pending, eligibleHouseholds);

  return {
    village_id: record.id,
    state: "Manipur",
    district: record.district,
    block: record.block,
    gram_panchayat: `${record.block} Demo Council`,
    village: record.name,
    population: 400 + index * 20,
    households: eligibleHouseholds,
    eligible_households: eligibleHouseholds,
    housing_eligible: serviceValues[0].eligible,
    housing_covered: serviceValues[0].covered,
    housing_coverage: serviceValues[0].coverage,
    health_eligible: serviceValues[1].eligible,
    health_covered: serviceValues[1].covered,
    health_coverage: serviceValues[1].coverage,
    water_eligible: serviceValues[2].eligible,
    water_covered: serviceValues[2].covered,
    water_coverage: serviceValues[2].coverage,
    welfare_eligible: serviceValues[3].eligible,
    welfare_covered: serviceValues[3].covered,
    welfare_coverage: serviceValues[3].coverage,
    pending_cases: pendingCases,
    pending_rate: pendingCases / eligibleHouseholds * 100,
    historical_water_coverage: serviceValues[2].historical,
    historical_health_coverage: serviceValues[1].historical,
    historical_housing_coverage: serviceValues[0].historical,
    historical_welfare_coverage: serviceValues[3].historical,
    latitude: record.latitude,
    longitude: record.longitude,
    data_date: "2025-03-31",
  };
});

const PAGE_SIZE = 500;
const CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const VILLAGES_CACHE_KEY = "sevaai:villages:v1";
const MAP_POINTS_CACHE_KEY = "sevaai:map-points:v1";

const villageTextFields = [
  "village_id",
  "state",
  "district",
  "block",
  "gram_panchayat",
  "village",
  "data_date",
] as const;
const villageNumberFields = [
  "population",
  "households",
  "eligible_households",
  "housing_eligible",
  "housing_covered",
  "housing_coverage",
  "health_eligible",
  "health_covered",
  "health_coverage",
  "water_eligible",
  "water_covered",
  "water_coverage",
  "welfare_eligible",
  "welfare_covered",
  "welfare_coverage",
  "pending_cases",
  "pending_rate",
  "historical_water_coverage",
  "historical_health_coverage",
  "historical_housing_coverage",
  "historical_welfare_coverage",
  "latitude",
  "longitude",
] as const;

function isVillageArray(value: unknown): value is Village[] {
  return Array.isArray(value) && value.every((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    return villageTextFields.every((field) => typeof record[field] === "string") &&
      villageNumberFields.every(
        (field) => typeof record[field] === "number" && Number.isFinite(record[field]),
      );
  });
}

function isMapPointArray(value: unknown): value is VillageMapPoint[] {
  return Array.isArray(value) && value.every((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    return typeof record.village_id === "string" &&
      typeof record.village === "string" &&
      typeof record.district === "string" &&
      typeof record.block === "string" &&
      typeof record.latitude === "number" &&
      Number.isFinite(record.latitude) &&
      typeof record.longitude === "number" &&
      Number.isFinite(record.longitude);
  });
}

function readCache<T>(
  key: string,
  isCachedValue: (value: unknown) => value is T,
): T | null {
  if (typeof window === "undefined") return null;

  try {
    const serialized = window.localStorage.getItem(key);
    if (!serialized) return null;

    const cached: unknown = JSON.parse(serialized);
    if (typeof cached !== "object" || cached === null) return null;
    const entry = cached as Record<string, unknown>;
    if (
      typeof entry.savedAt !== "number" ||
      Date.now() - entry.savedAt < 0 ||
      Date.now() - entry.savedAt > CACHE_MAX_AGE_MS ||
      !isCachedValue(entry.value)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch (error) {
    console.warn("Unable to read cached SevaAI data; requesting fresh data.", error);
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), value }),
    );
  } catch (error) {
    console.warn("Unable to cache SevaAI data; continuing with live data.", error);
  }
}

export async function fetchAllVillages(signal?: AbortSignal): Promise<Village[]> {
  if (!hasApiConfiguration || isLocalDemoSession()) return localDemoVillages;

  const cachedVillages = readCache(VILLAGES_CACHE_KEY, isVillageArray);
  if (cachedVillages) return cachedVillages;

  const firstPage = await apiRequest<VillagePage>(
    `/api/v1/villages?page=1&limit=${PAGE_SIZE}`,
    { signal },
  );
  if (firstPage.pages <= 1) {
    writeCache(VILLAGES_CACHE_KEY, firstPage.items);
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pages - 1 }, (_, index) =>
      apiRequest<VillagePage>(
        `/api/v1/villages?page=${index + 2}&limit=${PAGE_SIZE}`,
        { signal },
      ),
    ),
  );
  const villages = [firstPage, ...remainingPages].flatMap((page) => page.items);
  writeCache(VILLAGES_CACHE_KEY, villages);
  return villages;
}

export async function fetchMapVillages(
  signal?: AbortSignal,
): Promise<VillageMapPoint[]> {
  if (!hasApiConfiguration || isLocalDemoSession()) {
    return localDemoVillages.map((village) => ({
      village_id: village.village_id,
      village: village.village,
      district: village.district,
      block: village.block,
      latitude: village.latitude,
      longitude: village.longitude,
    }));
  }

  const cachedPoints = readCache(MAP_POINTS_CACHE_KEY, isMapPointArray);
  if (cachedPoints) return cachedPoints;

  const points = await apiRequest<VillageMapPoint[]>("/api/v1/map/villages", {
    signal,
  });
  writeCache(MAP_POINTS_CACHE_KEY, points);
  return points;
}

export function serviceCoverage(village: Village, key: ServiceKey): number {
  const service = services.find((item) => item.key === key);
  if (!service) return 0;
  return village[service.coverage];
}

export function serviceGap(village: Village, key: ServiceKey): number {
  return 100 - serviceCoverage(village, key);
}

export function overallCoverage(village: Village): number {
  const eligible = services.reduce((total, item) => total + village[item.eligible], 0);
  const covered = services.reduce((total, item) => total + village[item.covered], 0);
  return eligible === 0 ? 0 : (covered / eligible) * 100;
}

export function overallHistoricalCoverage(village: Village): number {
  const eligible = services.reduce((total, item) => total + village[item.eligible], 0);
  const covered = services.reduce(
    (total, item) => total + village[item.eligible] * village[item.historical] / 100,
    0,
  );
  return eligible === 0 ? 0 : (covered / eligible) * 100;
}

export function villageGapCount(village: Village): number {
  return services.filter((item) => village[item.covered] < village[item.eligible]).length;
}

export function serviceAggregates(villages: Village[]) {
  return services.map((service) => {
    const eligible = villages.reduce((total, village) => total + village[service.eligible], 0);
    const covered = villages.reduce((total, village) => total + village[service.covered], 0);
    const historical = villages.reduce(
      (total, village) => total + village[service.eligible] * village[service.historical],
      0,
    );
    const coverage = eligible === 0 ? 0 : (covered / eligible) * 100;
    return {
      ...service,
      eligible,
      covered,
      coverage,
      gap: 100 - coverage,
      historicalCoverage: eligible === 0 ? 0 : historical / eligible,
      gapHouseholds: eligible - covered,
    };
  });
}

export function totalPending(villages: Village[]): number {
  return villages.reduce((total, village) => total + village.pending_cases, 0);
}

export function overallPendingRate(villages: Village[]): number {
  const eligible = villages.reduce((total, village) => total + village.eligible_households, 0);
  return eligible === 0 ? 0 : (totalPending(villages) / eligible) * 100;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
