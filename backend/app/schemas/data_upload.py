from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.analytics import VillageAnalytics


class UploadStatus(StrEnum):
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class DataUploadSummary(BaseModel):
    upload_id: UUID
    dataset_type: str = "GOVERNMENT_UPLOAD"
    status: UploadStatus
    filename: str
    file_type: str
    row_count: int = Field(ge=0)
    detected_columns: list[str]
    mapped_columns: dict[str, str]
    unmapped_columns: list[str]
    validation_errors: list[str]
    warnings: list[str]
    valid_rows: int = Field(ge=0)
    rejected_rows: int = Field(ge=0)
    created_at: datetime | None = None


class ImportedDataRowResponse(BaseModel):
    row_number: int = Field(ge=1)
    normalized_data: dict[str, Any]
    analytics: VillageAnalytics | None = None


class ImportedDataRowsResponse(BaseModel):
    upload_id: UUID
    dataset_type: str = "GOVERNMENT_UPLOAD"
    total: int = Field(ge=0)
    offset: int = Field(ge=0)
    limit: int = Field(ge=1)
    items: list[ImportedDataRowResponse]


class ActiveDatasetResponse(BaseModel):
    mode: str
    upload_id: UUID | None = None
    filename: str | None = None
    status: UploadStatus | None = None
    created_at: datetime | None = None
    village_count: int = Field(ge=0)
    available_fields: list[str]
    map_available: bool
    analytics_available: bool
    anomalies_available: bool
