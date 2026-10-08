from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field, field_serializer


class PriorityLevel(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class VillageAnalytics(BaseModel):
    village_id: str
    village: str
    district: str
    block: str | None
    housing_gap: Decimal | None = Field(default=None, ge=0, le=100)
    health_gap: Decimal | None = Field(default=None, ge=0, le=100)
    water_gap: Decimal | None = Field(default=None, ge=0, le=100)
    welfare_gap: Decimal | None = Field(default=None, ge=0, le=100)
    pending_rate: Decimal | None = Field(default=None, ge=0, le=100)
    priority_score: Decimal | None = Field(default=None, ge=0, le=100)
    priority_level: PriorityLevel | None = None
    available: bool = True
    unavailable_reason: str | None = None

    @field_serializer(
        "housing_gap",
        "health_gap",
        "water_gap",
        "welfare_gap",
        "pending_rate",
        "priority_score",
        when_used="json",
    )
    def serialize_numeric_values(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None
