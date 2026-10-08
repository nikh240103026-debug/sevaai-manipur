from enum import StrEnum

from pydantic import BaseModel, Field


class AnomalyStatus(StrEnum):
    NORMAL = "NORMAL"
    UNUSUAL = "UNUSUAL"
    UNAVAILABLE = "UNAVAILABLE"


class AnomalyReasonCode(StrEnum):
    LOW_HOUSING_COVERAGE = "LOW_HOUSING_COVERAGE"
    LOW_HEALTH_COVERAGE = "LOW_HEALTH_COVERAGE"
    LOW_WATER_COVERAGE = "LOW_WATER_COVERAGE"
    LOW_WELFARE_COVERAGE = "LOW_WELFARE_COVERAGE"
    HIGH_PENDING_RATE = "HIGH_PENDING_RATE"
    SERVICE_COVERAGE_DECLINE = "SERVICE_COVERAGE_DECLINE"
    MULTI_SERVICE_GAP = "MULTI_SERVICE_GAP"
    UNUSUAL_COMBINATION = "UNUSUAL_COMBINATION"


class VillageAnomaly(BaseModel):
    village_id: str
    village: str
    district: str
    block: str
    anomaly_score: float | None = Field(default=None, ge=0, le=1)
    anomaly_status: AnomalyStatus
    reason_codes: list[AnomalyReasonCode]
    explanation: str
    available: bool = True
