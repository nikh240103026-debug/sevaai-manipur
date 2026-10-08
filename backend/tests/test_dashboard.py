from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import require_authenticated_user
from app.db.database import get_db
from app.main import app
from app.models.user import User, UserRole
from app.schemas.anomaly import AnomalyStatus, VillageAnomaly


def make_village(
    village_id: str,
    *,
    district: str = "Bishnupur",
    block: str = "Bishnupur",
    population: int = 100,
    pending_cases: int = 10,
    coverage: str = "80.00",
) -> SimpleNamespace:
    village: dict[str, Any] = {
        "village_id": village_id,
        "village": f"Village {village_id}",
        "district": district,
        "block": block,
        "population": population,
        "pending_cases": pending_cases,
        "pending_rate": Decimal("10.00"),
        "data_date": date(2025, 3, 31),
    }
    for service in ("housing", "health", "water", "welfare"):
        village[f"{service}_coverage"] = Decimal(coverage)
        village[f"historical_{service}_coverage"] = Decimal(coverage)
    return SimpleNamespace(**village)


class FakeResult:
    def __init__(self, values: list[Any]):
        self.values = values

    def all(self) -> list[Any]:
        return self.values


class FakeSession:
    def __init__(self, villages: list[SimpleNamespace]):
        self.villages = villages
        self.fail = False
        self.statements: list[str] = []

    def scalars(self, statement: Any) -> FakeResult:
        self.statements.append(str(statement))
        if self.fail:
            raise SQLAlchemyError("simulated query failure")
        return FakeResult(self.villages)


def make_anomaly(
    village: SimpleNamespace,
    status: AnomalyStatus,
) -> VillageAnomaly:
    return VillageAnomaly(
        village_id=village.village_id,
        village=village.village,
        district=village.district,
        block=village.block,
        anomaly_score=0.8,
        anomaly_status=status,
        reason_codes=[],
        explanation="Test anomaly result",
    )


@pytest.fixture
def dashboard_client() -> Any:
    villages = [
        make_village("MAN-BIS-01-001", population=100, coverage="80.00"),
        make_village(
            "MAN-BIS-01-002",
            population=250,
            pending_cases=20,
            coverage="60.00",
            block="Nambol",
        ),
    ]
    session = FakeSession(villages)
    user = User(
        id=1,
        username="test-admin",
        password_hash="not-used",
        full_name="Test Admin",
        role=UserRole.STATE_ADMIN,
        district=None,
        block=None,
        is_active=True,
    )

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_authenticated_user] = lambda: user
    with TestClient(app) as client:
        yield client, session, villages
    app.dependency_overrides.clear()


def test_dashboard_summary_aggregates_scoped_data_and_anomalies(
    dashboard_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _, villages = dashboard_client

    def get_anomalies(
        db: Any,
        *,
        villages: Any,
        limit: int | None,
        minimum_population: int,
    ) -> list[VillageAnomaly]:
        assert db is not None
        assert villages
        assert limit is None
        assert minimum_population == 1
        return [
            make_anomaly(villages[0], AnomalyStatus.UNUSUAL),
            make_anomaly(villages[1], AnomalyStatus.NORMAL),
        ]

    monkeypatch.setattr(
        "app.api.routes.dashboard.list_village_anomalies",
        get_anomalies,
    )

    response = client.get("/api/v1/dashboard/summary?top=1")

    assert response.status_code == 200
    data = response.json()
    assert data["total_villages"] == 2
    assert data["total_population"] == 350
    assert data["total_pending_cases"] == 30
    assert data["service_coverage"] == {
        "housing": 70,
        "health": 70,
        "water": 70,
        "welfare": 70,
    }
    assert sum(data["priority"].values()) == 2
    assert data["unusual_villages"] == 1
    assert len(data["top_priority_villages"]) == 1
    assert data["top_priority_villages"][0]["village_id"] == "MAN-BIS-01-002"


def test_dashboard_summary_empty_scope_returns_zero_values(
    dashboard_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session, _ = dashboard_client
    session.villages = []
    monkeypatch.setattr(
        "app.api.routes.dashboard.list_village_anomalies",
        lambda *args, **kwargs: pytest.fail(
            "Anomaly service called for empty scope: "
            f"args={args!r}, kwargs={kwargs!r}"
        ),
    )

    response = client.get("/api/v1/dashboard/summary")

    assert response.status_code == 200
    assert response.json() == {
        "total_villages": 0,
        "total_population": 0,
        "total_pending_cases": 0,
        "service_coverage": {
            "housing": 0,
            "health": 0,
            "water": 0,
            "welfare": 0,
        },
        "priority": {"high": 0, "medium": 0, "low": 0},
        "unusual_villages": 0,
        "top_priority_villages": [],
        "analytics_available": False,
        "anomalies_available": False,
    }


def test_dashboard_summary_limits_block_officer_anomaly_count(
    dashboard_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session, villages = dashboard_client
    session.villages = [villages[0]]
    app.dependency_overrides[require_authenticated_user] = lambda: User(
        id=2,
        username="test-block-officer",
        password_hash="not-used",
        full_name="Test Block Officer",
        role=UserRole.BLOCK_OFFICER,
        district="Bishnupur",
        block="Bishnupur",
        is_active=True,
    )

    def get_anomalies(
        _db: Any,
        *,
        villages: Any,
        limit: int | None,
        minimum_population: int,
    ) -> list[VillageAnomaly]:
        assert _db is not None
        assert villages
        assert limit is None
        assert minimum_population == 1
        return [
            make_anomaly(villages[0], AnomalyStatus.UNUSUAL),
        ]

    monkeypatch.setattr(
        "app.api.routes.dashboard.list_village_anomalies",
        get_anomalies,
    )

    response = client.get("/api/v1/dashboard/summary")

    assert response.status_code == 200
    assert response.json()["total_villages"] == 1
    assert response.json()["unusual_villages"] == 1


def test_dashboard_summary_database_failure_returns_503(
    dashboard_client: Any,
) -> None:
    client, session, _ = dashboard_client
    session.fail = True

    response = client.get("/api/v1/dashboard/summary")

    assert response.status_code == 503
    assert response.json()["detail"] == "Database query failed"


def test_dashboard_summary_requires_authentication(
    dashboard_client: Any,
) -> None:
    client, _, _ = dashboard_client
    app.dependency_overrides.pop(require_authenticated_user)

    response = client.get("/api/v1/dashboard/summary")

    assert response.status_code == 401


@pytest.mark.parametrize("top", ["0", "51"])
def test_dashboard_top_limit_validation(
    dashboard_client: Any,
    top: str,
) -> None:
    client, _, _ = dashboard_client

    assert client.get(f"/api/v1/dashboard/summary?top={top}").status_code == 422
