from decimal import Decimal
from dataclasses import dataclass
from typing import Any

import numpy as np
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import require_authenticated_user
from app.api.routes.anomaly import get_db
from app.main import app
from app.models.user import User, UserRole
from app.schemas.anomaly import AnomalyReasonCode, AnomalyStatus, VillageAnomaly
from app.services import anomaly as anomaly_service


@dataclass
class FakeVillage:
    village_id: str
    village: str
    district: str
    block: str
    pending_rate: Decimal
    housing_coverage: Decimal
    health_coverage: Decimal
    water_coverage: Decimal
    welfare_coverage: Decimal
    historical_housing_coverage: Decimal
    historical_health_coverage: Decimal
    historical_water_coverage: Decimal
    historical_welfare_coverage: Decimal


def make_village(
    village_id: str,
    *,
    district: str = "Tamenglong",
    coverage: float = 80.0,
    historical: float = 82.0,
    pending_rate: float = 10.0,
) -> FakeVillage:
    values: dict[str, Any] = {
        "village_id": village_id,
        "village": f"Demo Village {village_id}",
        "district": district,
        "block": "Demo Block",
        "pending_rate": Decimal(str(pending_rate)),
    }
    for service in ("housing", "health", "water", "welfare"):
        values[f"{service}_coverage"] = Decimal(str(coverage))
        values[f"historical_{service}_coverage"] = Decimal(str(historical))
    return FakeVillage(**values)


def make_population() -> list[FakeVillage]:
    population = [
        make_village(
            f"MAN-TAM-01-{index:03}",
            district="Tamenglong" if index <= 12 else "Bishnupur",
        )
        for index in range(1, 25)
    ]
    unusual = make_village(
        "MAN-TAM-01-027",
        coverage=3.0,
        historical=95.0,
        pending_rate=90.0,
    )
    unusual.water_coverage = Decimal("3")
    unusual.housing_coverage = Decimal("76")
    unusual.health_coverage = Decimal("78")
    unusual.welfare_coverage = Decimal("79")
    population.append(unusual)
    return population


class ScalarResult:
    def __init__(self, values: list[FakeVillage]):
        self.values = values

    def all(self) -> list[FakeVillage]:
        return self.values


class AnomalySession:
    def __init__(self, villages: list[FakeVillage] | None = None):
        self.villages = villages if villages is not None else make_population()
        self.fail = False

    def scalars(self, statement: Any) -> ScalarResult:
        assert statement is not None
        if self.fail:
            raise SQLAlchemyError("simulated database query failure")
        return ScalarResult(self.villages)


@pytest.fixture(autouse=True)
def clear_service_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(anomaly_service, "_cached_fingerprint", None)
    monkeypatch.setattr(anomaly_service, "_cached_results", ())


@pytest.fixture
def anomaly_client() -> Any:
    session = AnomalySession()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_authenticated_user] = lambda: User(
        id=1,
        username="test-admin",
        password_hash="not-used",
        full_name="Test Admin",
        role=UserRole.STATE_ADMIN,
        district=None,
        block=None,
        is_active=True,
    )
    with TestClient(app) as test_client:
        yield test_client, session
    app.dependency_overrides.clear()


def test_feature_construction_includes_current_historical_and_decline_values() -> None:
    village = make_village(
        "MAN-TAM-01-001",
        coverage=75.0,
        historical=80.0,
        pending_rate=12.5,
    )

    features = anomaly_service.build_feature_matrix([village])

    assert anomaly_service.FEATURE_NAMES == (
        "housing_coverage",
        "health_coverage",
        "water_coverage",
        "welfare_coverage",
        "pending_rate",
        "historical_housing_coverage",
        "historical_health_coverage",
        "historical_water_coverage",
        "historical_welfare_coverage",
        "housing_decline",
        "health_decline",
        "water_decline",
        "welfare_decline",
    )
    np.testing.assert_array_equal(
        features,
        [[75, 75, 75, 75, 12.5, 80, 80, 80, 80, 5, 5, 5, 5]],
    )


def test_isolation_forest_configuration_is_fixed_and_results_are_cached(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configurations: list[dict[str, Any]] = []

    class StubIsolationForest:
        def __init__(self, **kwargs: Any):
            configurations.append(kwargs)

        def fit_predict(self, features: np.ndarray) -> np.ndarray:
            return np.zeros(len(features), dtype=int)

        def decision_function(self, features: np.ndarray) -> np.ndarray:
            return np.arange(len(features), dtype=float)

    monkeypatch.setattr(anomaly_service, "IsolationForest", StubIsolationForest)
    population = make_population()
    first = anomaly_service._evaluate_population(population)
    second = anomaly_service._evaluate_population(population)

    assert configurations == [
        {"n_estimators": 200, "contamination": "auto", "random_state": 42}
    ]
    assert first == second


def test_anomaly_response_schema_validates_score_and_classification() -> None:
    response = VillageAnomaly(
        village_id="MAN-TAM-01-001",
        village="Demo Village",
        district="Tamenglong",
        block="Demo Block",
        anomaly_score=0.75,
        anomaly_status=AnomalyStatus.UNUSUAL,
        reason_codes=[AnomalyReasonCode.LOW_WATER_COVERAGE],
        explanation="Unusual service pattern driven by low water coverage.",
    )

    assert response.anomaly_status == AnomalyStatus.UNUSUAL
    with pytest.raises(ValidationError):
        VillageAnomaly(
            village_id="MAN-TAM-01-001",
            village="Demo Village",
            district="Tamenglong",
            block="Demo Block",
            anomaly_score=1.5,
            anomaly_status=AnomalyStatus.UNUSUAL,
            reason_codes=[],
            explanation="",
        )


def test_population_classifies_normal_and_unusual_deterministically() -> None:
    results = anomaly_service._evaluate_population(make_population())
    by_id = {result.village_id: result for result in results}

    assert by_id["MAN-TAM-01-027"].anomaly_status == AnomalyStatus.UNUSUAL
    assert by_id["MAN-TAM-01-027"].reason_codes
    assert by_id["MAN-TAM-01-027"].explanation.startswith(
        "Statistically unusual service and pending pattern"
    )
    assert by_id["MAN-TAM-01-001"].anomaly_status == AnomalyStatus.NORMAL
    assert anomaly_service._evaluate_population(make_population()) == results


def test_normal_village_retains_threshold_reasons_and_statistical_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class AllNormalIsolationForest:
        def __init__(self, **kwargs: Any):
            assert kwargs == {
                "n_estimators": 200,
                "contamination": "auto",
                "random_state": 42,
            }

        def fit_predict(self, features: np.ndarray) -> np.ndarray:
            return np.ones(len(features), dtype=int)

        def decision_function(self, features: np.ndarray) -> np.ndarray:
            return np.arange(len(features), dtype=float)

    monkeypatch.setattr(
        anomaly_service,
        "IsolationForest",
        AllNormalIsolationForest,
    )
    population = [
        make_village(f"MAN-TAM-01-{index:03}", coverage=80, historical=82)
        for index in range(1, 11)
    ]
    target = make_village(
        "MAN-TAM-01-027",
        coverage=80,
        historical=82,
        pending_rate=90,
    )
    target.water_coverage = Decimal("3")
    target.historical_water_coverage = Decimal("95")
    population.append(target)

    result = next(
        item
        for item in anomaly_service._evaluate_population(population)
        if item.village_id == target.village_id
    )

    assert result.anomaly_status == AnomalyStatus.NORMAL
    assert result.reason_codes == [
        AnomalyReasonCode.LOW_WATER_COVERAGE,
        AnomalyReasonCode.HIGH_PENDING_RATE,
        AnomalyReasonCode.SERVICE_COVERAGE_DECLINE,
    ]
    assert result.explanation == (
        "Overall service and pending patterns are not statistically unusual, "
        "but the village has low water coverage, elevated pending cases and a "
        "marked decline in service coverage."
    )
    assert result.anomaly_score == 0.045455


def test_normal_village_without_threshold_reasons_has_empty_reason_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class AllNormalIsolationForest:
        def __init__(self, **kwargs: Any):
            assert kwargs == {
                "n_estimators": 200,
                "contamination": "auto",
                "random_state": 42,
            }

        def fit_predict(self, features: np.ndarray) -> np.ndarray:
            return np.ones(len(features), dtype=int)

        def decision_function(self, features: np.ndarray) -> np.ndarray:
            return np.arange(len(features), dtype=float)

    monkeypatch.setattr(
        anomaly_service,
        "IsolationForest",
        AllNormalIsolationForest,
    )
    population = [
        make_village(f"MAN-TAM-01-{index:03}", coverage=80, historical=80)
        for index in range(1, 11)
    ]

    results = anomaly_service._evaluate_population(population)

    assert all(result.anomaly_status == AnomalyStatus.NORMAL for result in results)
    assert all(result.reason_codes == [] for result in results)
    assert all(
        result.explanation == anomaly_service.NORMAL_EXPLANATION
        for result in results
    )


def test_explanations_distinguish_status_from_threshold_reasons() -> None:
    reasons = [
        AnomalyReasonCode.LOW_HEALTH_COVERAGE,
        AnomalyReasonCode.MULTI_SERVICE_GAP,
    ]

    normal_explanation = anomaly_service._explanation(
        AnomalyStatus.NORMAL,
        reasons,
    )
    unusual_explanation = anomaly_service._explanation(
        AnomalyStatus.UNUSUAL,
        reasons,
    )

    assert normal_explanation == (
        "Overall service and pending patterns are not statistically unusual, "
        "but the village has low health coverage and multiple service gaps."
    )
    assert unusual_explanation == (
        "Statistically unusual service and pending pattern driven by low health "
        "coverage and multiple service gaps."
    )
    assert "safe" not in normal_explanation.lower()
    assert "fraudulent" not in unusual_explanation.lower()
    assert "suspicious" not in unusual_explanation.lower()


def test_list_endpoint_supports_district_limit_and_anomaly_only(
    anomaly_client: Any,
) -> None:
    client, _ = anomaly_client

    response = client.get(
        "/api/v1/ai/anomalies?district=Tamenglong&limit=5"
    )
    assert response.status_code == 200
    assert len(response.json()) == 5
    assert all(item["district"] == "Tamenglong" for item in response.json())

    limited = client.get("/api/v1/ai/anomalies?limit=3")
    assert limited.status_code == 200
    assert len(limited.json()) == 3

    unusual = client.get("/api/v1/ai/anomalies?anomaly_only=true")
    assert unusual.status_code == 200
    assert unusual.json()
    assert all(item["anomaly_status"] == "UNUSUAL" for item in unusual.json())
    assert "MAN-TAM-01-027" in {
        item["village_id"] for item in unusual.json()
    }


def test_village_endpoint_matches_population_evaluation(anomaly_client: Any) -> None:
    client, _ = anomaly_client

    response = client.get("/api/v1/ai/anomalies/MAN-TAM-01-027")
    listed = client.get("/api/v1/ai/anomalies?limit=100")
    expected = next(
        item for item in listed.json() if item["village_id"] == "MAN-TAM-01-027"
    )

    assert response.status_code == 200
    assert response.json() == expected
    assert response.json()["anomaly_status"] == "UNUSUAL"


def test_missing_village_returns_404(anomaly_client: Any) -> None:
    client, _ = anomaly_client

    response = client.get("/api/v1/ai/anomalies/does-not-exist")

    assert response.status_code == 404
    assert response.json()["detail"] == "Village not found"


def test_database_failure_returns_503(anomaly_client: Any) -> None:
    client, session = anomaly_client
    session.fail = True

    response = client.get("/api/v1/ai/anomalies?limit=10")

    assert response.status_code == 503
    assert response.json()["detail"] == "Database query failed"


@pytest.mark.parametrize("query", ["limit=0", "limit=101"])
def test_invalid_limit_returns_422(anomaly_client: Any, query: str) -> None:
    client, _ = anomaly_client

    assert client.get(f"/api/v1/ai/anomalies?{query}").status_code == 422
