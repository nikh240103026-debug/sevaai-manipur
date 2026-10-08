"""Deterministic prototype analytics, not official government classifications."""

from decimal import Decimal, ROUND_HALF_UP
from typing import Protocol

from app.schemas.analytics import PriorityLevel, VillageAnalytics

HUNDRED = Decimal("100")
FOUR = Decimal("4")
TWO_DECIMAL_PLACES = Decimal("0.01")

AVERAGE_GAP_WEIGHT = Decimal("0.25")
MAXIMUM_GAP_WEIGHT = Decimal("0.35")
PENDING_RATE_WEIGHT = Decimal("0.15")
HISTORICAL_DETERIORATION_WEIGHT = Decimal("0.15")
MULTI_SERVICE_PRESSURE_WEIGHT = Decimal("0.10")
MULTI_SERVICE_GAP_THRESHOLD = Decimal("20")
HIGH_GAP_GUARDRAIL = Decimal("60")
MEDIUM_GAP_GUARDRAIL = Decimal("40")
HIGH_PRIORITY_THRESHOLD = Decimal("70")
MEDIUM_PRIORITY_THRESHOLD = Decimal("40")


def _score_based_priority_level(score: Decimal) -> PriorityLevel:
    if score >= HIGH_PRIORITY_THRESHOLD:
        return PriorityLevel.HIGH
    if score >= MEDIUM_PRIORITY_THRESHOLD:
        return PriorityLevel.MEDIUM
    return PriorityLevel.LOW


def _priority_level(score: Decimal, gaps: tuple[Decimal, ...]) -> PriorityLevel:
    """Apply prototype severity guardrails after score-based classification."""
    level = _score_based_priority_level(score)
    maximum_gap = max(gaps)

    if maximum_gap >= HIGH_GAP_GUARDRAIL:
        return PriorityLevel.HIGH
    if maximum_gap >= MEDIUM_GAP_GUARDRAIL and level == PriorityLevel.LOW:
        return PriorityLevel.MEDIUM
    return level


def _clamp_score(score: Decimal) -> Decimal:
    return min(HUNDRED, max(Decimal("0"), score)).quantize(
        TWO_DECIMAL_PLACES,
        rounding=ROUND_HALF_UP,
    )


class VillageAnalyticsSource(Protocol):
    village_id: str
    village: str
    district: str
    block: str
    housing_coverage: Decimal
    health_coverage: Decimal
    water_coverage: Decimal
    welfare_coverage: Decimal
    historical_housing_coverage: Decimal
    historical_health_coverage: Decimal
    historical_water_coverage: Decimal
    historical_welfare_coverage: Decimal
    pending_rate: Decimal


def build_village_analytics(village: VillageAnalyticsSource) -> VillageAnalytics:
    """Calculate a transparent prototype score and guardrailed priority level.

    These analytical rules support SW-4 prototype exploration and are not
    official government classifications or operational determinations.
    """
    service_values = (
        (
            "housing",
            village.housing_coverage,
            village.historical_housing_coverage,
        ),
        (
            "health",
            village.health_coverage,
            village.historical_health_coverage,
        ),
        (
            "water",
            village.water_coverage,
            village.historical_water_coverage,
        ),
        (
            "welfare",
            village.welfare_coverage,
            village.historical_welfare_coverage,
        ),
    )
    gaps = {service: HUNDRED - current for service, current, _ in service_values}
    historical_deterioration = sum(
        (
            max(historical - current, Decimal("0"))
            for _, current, historical in service_values
        ),
        start=Decimal("0"),
    ) / FOUR
    multi_service_pressure = (
        Decimal(
            sum(gap >= MULTI_SERVICE_GAP_THRESHOLD for gap in gaps.values())
        )
        / FOUR
        * HUNDRED
    )

    average_gap = sum(gaps.values(), start=Decimal("0")) / FOUR
    maximum_gap = max(gaps.values())
    score = (
        average_gap * AVERAGE_GAP_WEIGHT
        + maximum_gap * MAXIMUM_GAP_WEIGHT
        + village.pending_rate * PENDING_RATE_WEIGHT
        + historical_deterioration * HISTORICAL_DETERIORATION_WEIGHT
        + multi_service_pressure * MULTI_SERVICE_PRESSURE_WEIGHT
    )
    score = _clamp_score(score)
    priority_level = _priority_level(score, tuple(gaps.values()))

    return VillageAnalytics(
        village_id=village.village_id,
        village=village.village,
        district=village.district,
        block=village.block,
        housing_gap=gaps["housing"],
        health_gap=gaps["health"],
        water_gap=gaps["water"],
        welfare_gap=gaps["welfare"],
        pending_rate=village.pending_rate,
        priority_score=score,
        priority_level=priority_level,
    )
