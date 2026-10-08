import csv
from pathlib import Path
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.villages import get_db
from app.db import database
from app import main as main_module
from app.main import app
from app.models.village import Village


def make_village() -> SimpleNamespace:
    values: dict[str, Any] = {
        "village_id": "MAN-BIS-01-001",
        "state": "Manipur",
        "district": "Bishnupur",
        "block": "Bishnupur",
        "gram_panchayat": "Bishnupur Local Council Group 01",
        "village": "Bishnupur Demo Village 001",
        "population": 371,
        "households": 61,
        "eligible_households": 48,
        "pending_cases": 5,
        "pending_rate": Decimal("10.42"),
        "latitude": 24.560263,
        "longitude": 93.867276,
        "data_date": date(2025, 3, 31),
    }
    for service in ("housing", "health", "water", "welfare"):
        values[f"{service}_eligible"] = 40
        values[f"{service}_covered"] = 35
        values[f"{service}_coverage"] = Decimal("87.50")
        values[f"historical_{service}_coverage"] = Decimal("85.00")
    return SimpleNamespace(**values)


class ScalarResult:
    def __init__(self, values: list[Any]):
        self.values = values

    def all(self) -> list[Any]:
        return self.values


class MapResult:
    def __init__(self, village: SimpleNamespace):
        self.village = village

    def all(self) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(
                _mapping={
                    field: getattr(self.village, field)
                    for field in (
                        "village_id",
                        "village",
                        "district",
                        "block",
                        "latitude",
                        "longitude",
                    )
                }
            )
        ]


class FakeSession:
    def __init__(self):
        self.village = make_village()
        self.statements: list[str] = []
        self.fail_queries = False

    def scalar(self, statement: Any) -> int:
        self._record(statement)
        return 1

    def scalars(self, statement: Any) -> ScalarResult:
        sql = self._record(statement)
        if "DISTINCT" in sql:
            return ScalarResult(["Bishnupur"])
        return ScalarResult([self.village])

    def execute(self, statement: Any) -> MapResult:
        self._record(statement)
        return MapResult(self.village)

    def get(self, _model: Any, village_id: str) -> SimpleNamespace | None:
        self._record("get village")
        return self.village if village_id == self.village.village_id else None

    def close(self) -> None:
        pass

    def _record(self, statement: Any) -> str:
        sql = str(statement)
        self.statements.append(sql)
        if self.fail_queries:
            raise SQLAlchemyError("simulated database query failure")
        return sql


@pytest.fixture
def client() -> Any:
    session = FakeSession()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, session
    app.dependency_overrides.clear()


def test_root_and_openapi(client: Any) -> None:
    test_client, _ = client
    response = test_client.get("/")
    assert response.status_code == 200
    assert "synthetic demonstration data" in response.json()["data_notice"]
    assert test_client.get("/openapi.json").status_code == 200
    assert test_client.get("/docs").status_code == 200


def test_health_reports_database_and_postgis(monkeypatch: pytest.MonkeyPatch) -> None:
    class Result:
        def scalar(self) -> bool:
            return True

    class Connection:
        def __enter__(self) -> "Connection":
            return self

        def __exit__(self, *_args: Any) -> None:
            return None

        def execute(self, _statement: Any) -> Result:
            return Result()

        def scalar(self, _statement: Any) -> bool:
            return True

    class Engine:
        def connect(self) -> Connection:
            return Connection()

    monkeypatch.setattr(main_module, "get_engine", lambda: Engine())
    with TestClient(app) as test_client:
        response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected", "postgis": True}


def test_health_reports_database_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def missing_database_url():
        raise RuntimeError("DATABASE_URL is not configured")

    monkeypatch.setattr(main_module, "get_engine", missing_database_url)
    with TestClient(app) as test_client:
        response = test_client.get("/health")
    assert response.status_code == 503
    assert response.json()["detail"] == "Database is not configured"


def test_list_villages_and_filters(client: Any) -> None:
    test_client, session = client
    response = test_client.get(
        "/api/v1/villages?page=1&limit=500&district=Bishnupur&block=Bishnupur"
    )
    assert response.status_code == 200
    assert response.json()["items"][0]["village_id"] == "MAN-BIS-01-001"
    assert response.json()["limit"] == 500
    assert response.json()["total"] == 1
    assert isinstance(response.json()["items"][0]["housing_coverage"], float)
    assert isinstance(response.json()["items"][0]["pending_rate"], float)
    assert isinstance(response.json()["items"][0]["historical_housing_coverage"], float)
    assert "lower(villages.district)" in session.statements[0]
    assert "lower(villages.block)" in session.statements[0]
    assert "geom" not in response.json()["items"][0]


@pytest.mark.parametrize("query", ["page=0", "limit=0", "limit=501"])
def test_invalid_pagination_returns_422(client: Any, query: str) -> None:
    test_client, _ = client
    assert test_client.get(f"/api/v1/villages?{query}").status_code == 422


def test_get_village_and_not_found(client: Any) -> None:
    test_client, _ = client
    response = test_client.get("/api/v1/villages/MAN-BIS-01-001")
    assert response.status_code == 200
    assert response.json()["data_date"] == "2025-03-31"
    assert test_client.get("/api/v1/villages/does-not-exist").status_code == 404


def test_districts(client: Any) -> None:
    test_client, _ = client
    assert test_client.get("/api/v1/districts").json() == {
        "districts": ["Bishnupur"]
    }


def test_map_returns_only_geographic_fields(client: Any) -> None:
    test_client, _ = client
    response = test_client.get("/api/v1/map/villages")
    assert response.status_code == 200
    assert response.json() == [
        {
            "village_id": "MAN-BIS-01-001",
            "village": "Bishnupur Demo Village 001",
            "district": "Bishnupur",
            "block": "Bishnupur",
            "latitude": 24.560263,
            "longitude": 93.867276,
        }
    ]


def test_query_failure_returns_service_unavailable(client: Any) -> None:
    test_client, session = client
    session.fail_queries = True
    response = test_client.get("/api/v1/districts")
    assert response.status_code == 503
    assert response.json()["detail"] == "Database query failed"


def test_village_model_matches_dataset_columns() -> None:
    csv_path = Path(__file__).resolve().parents[2] / "data" / "raw" / "sevaai_demo_data.csv"
    with csv_path.open(encoding="utf-8", newline="") as source:
        csv_columns = next(csv.reader(source))

    model_columns = [column.name for column in Village.__table__.columns if column.name != "geom"]
    assert model_columns == csv_columns
    geometry = Village.__table__.columns["geom"].type
    assert geometry.geometry_type == "POINT"
    assert geometry.srid == 4326
