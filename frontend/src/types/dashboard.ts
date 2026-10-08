export type PriorityLevel = "HIGH" | "MEDIUM" | "LOW";

export interface DashboardPriorityVillage {
  village_id: string;
  village: string;
  district: string;
  block: string | null;
  priority_score: number;
  priority_level: PriorityLevel;
  housing_gap: number;
  health_gap: number;
  water_gap: number;
  welfare_gap: number;
}

export interface DashboardSummary {
  total_villages: number;
  total_population: number | null;
  total_pending_cases: number | null;
  service_coverage: {
    housing: number | null;
    health: number | null;
    water: number | null;
    welfare: number | null;
  };
  priority: {
    high: number | null;
    medium: number | null;
    low: number | null;
  };
  unusual_villages: number | null;
  top_priority_villages: DashboardPriorityVillage[];
  analytics_available: boolean;
  anomalies_available: boolean;
}
