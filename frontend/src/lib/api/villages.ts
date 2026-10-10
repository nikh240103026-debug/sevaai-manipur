import { apiRequest } from "@/lib/api/client";
import type {
  DistrictList,
  Village,
  VillageAnalytics,
  VillageMapPoint,
  VillagePage,
  VillageQuery,
} from "@/types/village";

const API_PREFIX = "/api/v1";

function buildQueryString(query: VillageQuery = {}): string {
  const params = new URLSearchParams();

  if (query.page !== undefined) {
    params.set("page", String(query.page));
  }

  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  if (query.district?.trim()) {
    params.set("district", query.district.trim());
  }

  if (query.block?.trim()) {
    params.set("block", query.block.trim());
  }

  const queryString = params.toString();

  return queryString ? `?${queryString}` : "";
}

export async function getVillages(
  query: VillageQuery = {},
): Promise<VillagePage> {
  return apiRequest<VillagePage>(
    `${API_PREFIX}/villages${buildQueryString(query)}`,
  );
}

export async function getVillage(villageId: string): Promise<Village> {
  if (!villageId.trim()) {
    throw new Error("Village ID is required.");
  }

  return apiRequest<Village>(
    `${API_PREFIX}/villages/${encodeURIComponent(villageId.trim())}`,
  );
}

export async function getVillageAnalytics(
  villageId: string,
): Promise<VillageAnalytics> {
  if (!villageId.trim()) {
    throw new Error("Village ID is required.");
  }
  return apiRequest<VillageAnalytics>(
    `${API_PREFIX}/analytics/villages/${encodeURIComponent(villageId.trim())}`,
  );
}

export async function getDistricts(): Promise<DistrictList> {
  return apiRequest<DistrictList>(`${API_PREFIX}/districts`);
}

export async function getVillageMapPoints(): Promise<VillageMapPoint[]> {
  return apiRequest<VillageMapPoint[]>(`${API_PREFIX}/map/villages`);
}