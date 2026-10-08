export interface Village {
  village_id: string;
  state: string;
  district: string;
  block: string;
  gram_panchayat: string;
  village: string;

  population: number;
  households: number;
  eligible_households: number;

  housing_eligible: number;
  housing_covered: number;
  housing_coverage: number;

  health_eligible: number;
  health_covered: number;
  health_coverage: number;

  water_eligible: number;
  water_covered: number;
  water_coverage: number;

  welfare_eligible: number;
  welfare_covered: number;
  welfare_coverage: number;

  pending_cases: number;
  pending_rate: number;

  historical_water_coverage: number;
  historical_health_coverage: number;
  historical_housing_coverage: number;
  historical_welfare_coverage: number;

  latitude: number;
  longitude: number;

  data_date: string;
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
  block: string;
  latitude: number;
  longitude: number;
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