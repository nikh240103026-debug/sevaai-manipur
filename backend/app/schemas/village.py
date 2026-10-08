from datetime import date

from pydantic import BaseModel, ConfigDict


class VillageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    village_id: str
    state: str
    district: str
    block: str
    gram_panchayat: str
    village: str
    population: int
    households: int
    eligible_households: int
    housing_eligible: int
    housing_covered: int
    housing_coverage: float
    health_eligible: int
    health_covered: int
    health_coverage: float
    water_eligible: int
    water_covered: int
    water_coverage: float
    welfare_eligible: int
    welfare_covered: int
    welfare_coverage: float
    pending_cases: int
    pending_rate: float
    historical_water_coverage: float
    historical_health_coverage: float
    historical_housing_coverage: float
    historical_welfare_coverage: float
    latitude: float
    longitude: float
    data_date: date


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
    block: str
    latitude: float
    longitude: float


class HealthResponse(BaseModel):
    status: str
    database: str
    postgis: bool
