import { apiRequest } from "@/lib/client";
import type {
  DataUploadSummary,
  ActiveDataset,
  ImportedDataRowsResponse,
} from "@/types/data-upload";

const API_PREFIX = "/api/v1/data";

export async function getActiveDataset(): Promise<ActiveDataset> {
  return apiRequest<ActiveDataset>(`${API_PREFIX}/active`);
}

export async function uploadGovernmentData(
  file: File,
): Promise<DataUploadSummary> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<DataUploadSummary>(`${API_PREFIX}/upload`, {
    method: "POST",
    body: formData,
  });
}

export async function listUploads(): Promise<DataUploadSummary[]> {
  return apiRequest<DataUploadSummary[]>(`${API_PREFIX}/uploads`);
}

export async function getUpload(
  uploadId: string,
): Promise<DataUploadSummary> {
  return apiRequest<DataUploadSummary>(
    `${API_PREFIX}/uploads/${encodeURIComponent(uploadId)}`,
  );
}

export async function getUploadRows(
  uploadId: string,
  offset = 0,
  limit = 100,
): Promise<ImportedDataRowsResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  return apiRequest<ImportedDataRowsResponse>(
    `${API_PREFIX}/uploads/${encodeURIComponent(uploadId)}/rows?${params}`,
  );
}
