import { apiRequest } from "@/lib/client";
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

export async function fetchAllVillages(signal?: AbortSignal): Promise<Village[]> {
  const firstPage = await apiRequest<VillagePage>(
    "/api/v1/villages?page=1&limit=100",
    { signal },
  );
  if (firstPage.pages <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pages - 1 }, (_, index) =>
      apiRequest<VillagePage>(
        `/api/v1/villages?page=${index + 2}&limit=100`,
        { signal },
      ),
    ),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export async function fetchMapVillages(
  signal?: AbortSignal,
): Promise<VillageMapPoint[]> {
  return apiRequest<VillageMapPoint[]>("/api/v1/map/villages", { signal });
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
