from pydantic import BaseModel, Field

from app.schemas.analytics import PriorityLevel


class ServiceCoverageSummary(BaseModel):
    housing: float | None = Field(default=None, ge=0, le=100)
    health: float | None = Field(default=None, ge=0, le=100)
    water: float | None = Field(default=None, ge=0, le=100)
    welfare: float | None = Field(default=None, ge=0, le=100)


class PrioritySummary(BaseModel):
    high: int | None = Field(default=None, ge=0)
    medium: int | None = Field(default=None, ge=0)
    low: int | None = Field(default=None, ge=0)


class PriorityVillage(BaseModel):
    village_id: str
    village: str
    district: str
    block: str | None
    priority_score: float = Field(ge=0, le=100)
    priority_level: PriorityLevel
    housing_gap: float = Field(ge=0, le=100)
    health_gap: float = Field(ge=0, le=100)
    water_gap: float = Field(ge=0, le=100)
    welfare_gap: float = Field(ge=0, le=100)


class DashboardSummary(BaseModel):
    total_villages: int = Field(ge=0)
    total_population: int | None = Field(default=None, ge=0)
    total_pending_cases: int | None = Field(default=None, ge=0)

    service_coverage: ServiceCoverageSummary
    priority: PrioritySummary

    unusual_villages: int | None = Field(default=None, ge=0)

    top_priority_villages: list[PriorityVillage]
    analytics_available: bool = True
    anomalies_available: bool = True