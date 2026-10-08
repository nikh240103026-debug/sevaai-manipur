export type UploadStatus = "COMPLETED" | "PARTIAL" | "FAILED";

export interface DataUploadSummary {
  upload_id: string;
  dataset_type: string;
  status: UploadStatus;
  filename: string;
  file_type: string;
  row_count: number;
  detected_columns: string[];
  mapped_columns: Record<string, string>;
  unmapped_columns: string[];
  validation_errors: string[];
  warnings: string[];
  valid_rows: number;
  rejected_rows: number;
  created_at: string | null;
}

export interface ActiveDataset {
  mode: "GOVERNMENT_UPLOAD" | "DEMO_DATA";
  upload_id: string | null;
  filename: string | null;
  status: UploadStatus | null;
  created_at: string | null;
  village_count: number;
  available_fields: string[];
  map_available: boolean;
  analytics_available: boolean;
  anomalies_available: boolean;
}

export type NormalizedData = Record<string, unknown>;

export interface ImportedDataRow {
  row_number: number;
  normalized_data: NormalizedData;
  analytics: {
    village_id: string;
    village: string;
    district: string;
    block: string;
    housing_gap: number;
    health_gap: number;
    water_gap: number;
    welfare_gap: number;
    pending_rate: number;
    priority_score: number;
    priority_level: "HIGH" | "MEDIUM" | "LOW";
  } | null;
}

export interface ImportedDataRowsResponse {
  upload_id: string;
  dataset_type: string;
  total: number;
  offset: number;
  limit: number;
  items: ImportedDataRow[];
}
