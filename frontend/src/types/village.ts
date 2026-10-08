export interface Village {
  village_id: string;
  state: string | null;
  district: string;
  block: string | null;
  gram_panchayat: string | null;
  village: string;

  population: number | null;
  households: number | null;
  eligible_households: number | null;

  housing_eligible: number | null;
  housing_covered: number | null;
  housing_coverage: number | null;

  health_eligible: number | null;
  health_covered: number | null;
  health_coverage: number | null;

  water_eligible: number | null;
  water_covered: number | null;
  water_coverage: number | null;

  welfare_eligible: number | null;
  welfare_covered: number | null;
  welfare_coverage: number | null;

  pending_cases: number | null;
  pending_rate: number | null;

  historical_water_coverage: number | null;
  historical_health_coverage: number | null;
  historical_housing_coverage: number | null;
  historical_welfare_coverage: number | null;

  latitude: number | null;
  longitude: number | null;

  data_date: string | null;
  priority_score: number | null;
  priority_level: "HIGH" | "MEDIUM" | "LOW" | null;
  major_service_gap: string | null;
  analytics_available: boolean;
  analytics_unavailable_reason: string | null;
}

export interface VillagePage {
  items: Village[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface DistrictList {
  districts: string[];
}

export interface VillageMapPoint {
  village_id: string;
  village: string;
  district: string;
  block: string | null;
  latitude: number;
  longitude: number;
  priority_score: number | null;
  priority_level: "HIGH" | "MEDIUM" | "LOW" | null;
  major_service_gap: string | null;
  anomaly_status: "NORMAL" | "UNUSUAL" | "UNAVAILABLE" | null;
}

export interface VillageAnalytics {
  village_id: string;
  village: string;
  district: string;
  block: string | null;
  housing_gap: number | null;
  health_gap: number | null;
  water_gap: number | null;
  welfare_gap: number | null;
  pending_rate: number | null;
  priority_score: number | null;
  priority_level: "HIGH" | "MEDIUM" | "LOW" | null;
  available: boolean;
  unavailable_reason: string | null;
}

export interface HealthResponse {
  status: string;
  database: string;
  postgis: boolean;
}

export interface VillageQuery {
  page?: number;
  limit?: number;
  district?: string;
  block?: string;
}