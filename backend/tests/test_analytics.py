from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.analytics import get_db
from app.main import app
from app.schemas.analytics import PriorityLevel
from app.services.analytics import (
    AVERAGE_GAP_WEIGHT,
    HISTORICAL_DETERIORATION_WEIGHT,
    MAXIMUM_GAP_WEIGHT,
    MULTI_SERVICE_PRESSURE_WEIGHT,
    PENDING_RATE_WEIGHT,
    _clamp_score,
    _priority_level,
    build_village_analytics,
)


def make_village(
    current: Decimal = Decimal("80.00"),
    historical: Decimal = Decimal("85.00"),
    pending_rate: Decimal = Decimal("10.00"),
) -> SimpleNamespace:
    values: dict[str, Any] = {
        "village_id": "MAN-BIS-01-001",
        "village": "Bishnupur Demo Village 001",
        "district": "Bishnupur",
        "block": "Bishnupur",
        "pending_rate": pending_rate,
    }
    for service in ("housing", "health", "water", "welfare"):
        values[f"{service}_coverage"] = current
        values[f"historical_{service}_coverage"] = historical
    return SimpleNamespace(**values)


def test_base_weights_total_one_hundred_percent() -> None:
    assert (
        AVERAGE_GAP_WEIGHT
        + MAXIMUM_GAP_WEIGHT
        + PENDING_RATE_WEIGHT
        + HISTORICAL_DETERIORATION_WEIGHT
        + MULTI_SERVICE_PRESSURE_WEIGHT
        == Decimal("1.00")
    )


def test_normal_low_risk_village() -> None:
    analytics = build_village_analytics(
        make_village(
            current=Decimal("95"),
            historical=Decimal("95"),
            pending_rate=Decimal("5"),
        )
    )

    assert analytics.priority_score == Decimal("3.75")
    assert analytics.priority_level == PriorityLevel.LOW


def test_severe_single_service_gap_guardrail_sets_high_without_inflating_score() -> None:
    village = make_village(current=Decimal("100"), historical=Decimal("100"))
    village.health_coverage = Decimal("30")
    village.historical_health_coverage = Decimal("30")
    village.pending_rate = Decimal("0")

    analytics = build_village_analytics(village)

    assert analytics.health_gap == Decimal("70")
    assert analytics.priority_score == Decimal("31.38")
    assert analytics.priority_level == PriorityLevel.HIGH


def test_moderate_single_service_gap_guardrail_sets_at_least_medium() -> None:
    village = make_village(current=Decimal("100"), historical=Decimal("100"))
    village.water_coverage = Decimal("55")
    village.historical_water_coverage = Decimal("55")

    analytics = build_village_analytics(village)

    assert analytics.water_gap == Decimal("45")
    assert analytics.priority_score == Decimal("22.56")
    assert analytics.priority_level == PriorityLevel.MEDIUM


def test_multiple_moderate_gaps_contribute_to_pressure_and_score() -> None:
    village = make_village(current=Decimal("70"), historical=Decimal("70"))
    village.housing_coverage = Decimal("75")
    village.health_coverage = Decimal("70")
    village.water_coverage = Decimal("65")
    village.welfare_coverage = Decimal("60")
    for service in ("housing", "health", "water", "welfare"):
        setattr(
            village,
            f"historical_{service}_coverage",
            getattr(village, f"{service}_coverage"),
        )

    analytics = build_village_analytics(village)

    assert analytics.priority_score == Decimal("33.63")
    assert analytics.priority_level == PriorityLevel.MEDIUM


def test_high_pending_rate_contributes_using_decimal_weight() -> None:
    village = make_village(
        current=Decimal("100"),
        historical=Decimal("100"),
        pending_rate=Decimal("80"),
    )

    analytics = build_village_analytics(village)

    assert analytics.priority_score == Decimal("12.00")
    assert analytics.priority_level == PriorityLevel.LOW


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (Decimal("39.99"), PriorityLevel.LOW),
        (Decimal("40"), PriorityLevel.MEDIUM),
        (Decimal("69.99"), PriorityLevel.MEDIUM),
        (Decimal("70"), PriorityLevel.HIGH),
    ],
)
def test_score_threshold_behavior(score: Decimal, expected: PriorityLevel) -> None:
    assert _priority_level(score, (Decimal("0"),) * 4) == expected


def test_severity_guardrail_raises_score_based_level() -> None:
    moderate_gaps = (Decimal("40"), Decimal("0"), Decimal("0"), Decimal("0"))
    assert _priority_level(Decimal("20"), moderate_gaps) == PriorityLevel.MEDIUM
    assert (
        _priority_level(Decimal("20"), (Decimal("60"),) * 4)
        == PriorityLevel.HIGH
    )


@pytest.mark.parametrize(
    ("score", "expected"),
    [
        (Decimal("-5"), Decimal("0.00")),
        (Decimal("105"), Decimal("100.00")),
        (Decimal("27.125"), Decimal("27.13")),
    ],
)
def test_score_clamping_and_rounding(score: Decimal, expected: Decimal) -> None:
    assert _clamp_score(score) == expected


def test_priority_score_uses_positive_historical_deterioration_and_gap_pressure() -> None:
    village = make_village(current=Decimal("75"), historical=Decimal("95"))

    analytics = build_village_analytics(village)

    assert analytics.housing_gap == Decimal("25")
    assert analytics.priority_score == Decimal("29.50")
    assert analytics.priority_level == PriorityLevel.LOW


def test_score_calculation_is_deterministic_and_decimal_based() -> None:
    village = make_village(
        current=Decimal("74.25"),
        historical=Decimal("81.75"),
        pending_rate=Decimal("23.45"),
    )

    first = build_village_analytics(village)
    second = build_village_analytics(village)

    assert first.priority_score == second.priority_score
    assert isinstance(first.priority_score, Decimal)
    assert isinstance(first.health_gap, Decimal)


class AnalyticsSession:
    def __init__(self, village: SimpleNamespace | None):
        self.village = village
        self.fail = False

    def get(self, _model: Any, village_id: str) -> SimpleNamespace | None:
        if self.fail:
            raise SQLAlchemyError("simulated database query failure")
        if self.village is not None and village_id == self.village.village_id:
            return self.village
        return None


@pytest.fixture
def analytics_client() -> Any:
    session = AnalyticsSession(make_village())

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, session
    app.dependency_overrides.clear()


def test_village_analytics_endpoint(analytics_client: Any) -> None:
    test_client, _ = analytics_client

    response = test_client.get("/api/v1/analytics/villages/MAN-BIS-01-001")

    assert response.status_code == 200
    assert response.json() == {
        "village_id": "MAN-BIS-01-001",
        "village": "Bishnupur Demo Village 001",
        "district": "Bishnupur",
        "block": "Bishnupur",
        "housing_gap": "20.00",
        "health_gap": "20.00",
        "water_gap": "20.00",
        "welfare_gap": "20.00",
        "pending_rate": "10.00",
        "priority_score": "24.25",
        "priority_level": "LOW",
    }


def test_village_analytics_not_found(analytics_client: Any) -> None:
    test_client, _ = analytics_client
    assert (
        test_client.get("/api/v1/analytics/villages/unknown").status_code == 404
    )


def test_village_analytics_database_failure(analytics_client: Any) -> None:
    test_client, session = analytics_client
    session.fail = True

    response = test_client.get("/api/v1/analytics/villages/MAN-BIS-01-001")

    assert response.status_code == 503
    assert response.json()["detail"] == "Database query failed"
