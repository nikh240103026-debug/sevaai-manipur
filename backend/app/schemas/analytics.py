from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field


class PriorityLevel(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class VillageAnalytics(BaseModel):
    village_id: str
    village: str
    district: str
    block: str
    housing_gap: Decimal = Field(ge=0, le=100)
    health_gap: Decimal = Field(ge=0, le=100)
    water_gap: Decimal = Field(ge=0, le=100)
    welfare_gap: Decimal = Field(ge=0, le=100)
    pending_rate: Decimal = Field(ge=0, le=100)
    priority_score: Decimal = Field(ge=0, le=100)
    priority_level: PriorityLevel
