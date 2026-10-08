from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.schemas.analytics import PriorityLevel


class VillageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    village_id: str
    state: str | None
    district: str
    block: str | None
    gram_panchayat: str | None
    village: str
    population: int | None
    households: int | None
    eligible_households: int | None
    housing_eligible: int | None
    housing_covered: int | None
    housing_coverage: Decimal | None
    health_eligible: int | None
    health_covered: int | None
    health_coverage: Decimal | None
    water_eligible: int | None
    water_covered: int | None
    water_coverage: Decimal | None
    welfare_eligible: int | None
    welfare_covered: int | None
    welfare_coverage: Decimal | None
    pending_cases: int | None
    pending_rate: Decimal | None
    historical_water_coverage: Decimal | None
    historical_health_coverage: Decimal | None
    historical_housing_coverage: Decimal | None
    historical_welfare_coverage: Decimal | None
    latitude: float | None
    longitude: float | None
    data_date: date | None
    priority_score: Decimal | None = None
    priority_level: PriorityLevel | None = None
    major_service_gap: str | None = None
    analytics_available: bool = True
    analytics_unavailable_reason: str | None = None

    @field_serializer(
        "housing_coverage",
        "health_coverage",
        "water_coverage",
        "welfare_coverage",
        "pending_rate",
        "historical_water_coverage",
        "historical_health_coverage",
        "historical_housing_coverage",
        "historical_welfare_coverage",
        "priority_score",
        when_used="json",
    )
    def serialize_numeric_values(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None


class VillagePage(BaseModel):
    items: list[VillageResponse]
    page: int
    limit: int
    total: int
    pages: int


class DistrictList(BaseModel):
    districts: list[str]


class VillageMapPoint(BaseModel):
    village_id: str
    village: str
    district: str
    block: str | None
    latitude: float
    longitude: float
    priority_score: float | None = None
    priority_level: str | None = None
    major_service_gap: str | None = None
    anomaly_status: str | None = None


class HealthResponse(BaseModel):
    status: str
    database: str
    postgis: bool
