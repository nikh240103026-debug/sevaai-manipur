"""Deterministic, population-wide anomaly signals for synthetic demo data.

Isolation Forest is an unsupervised anomaly detector. An unusual result is not
evidence of fraud or wrongdoing; it is a decision-support signal only.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from threading import RLock
from typing import Protocol

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.village import Village
from app.schemas.anomaly import AnomalyReasonCode, AnomalyStatus, VillageAnomaly

N_ESTIMATORS = 200
CONTAMINATION = "auto"
RANDOM_STATE = 42
LOW_COVERAGE_PERCENTILE = 10
HIGH_PENDING_PERCENTILE = 90
HIGH_DECLINE_PERCENTILE = 90
MEDIAN_PERCENTILE = 50

SERVICE_NAMES = ("housing", "health", "water", "welfare")
BASE_FEATURE_NAMES = (
    "housing_coverage",
    "health_coverage",
    "water_coverage",
    "welfare_coverage",
    "pending_rate",
    "historical_housing_coverage",
    "historical_health_coverage",
    "historical_water_coverage",
    "historical_welfare_coverage",
)
DECLINE_FEATURE_NAMES = tuple(f"{name}_decline" for name in SERVICE_NAMES)
FEATURE_NAMES = BASE_FEATURE_NAMES + DECLINE_FEATURE_NAMES
SERVICE_REASON_CODES = {
    "housing": AnomalyReasonCode.LOW_HOUSING_COVERAGE,
    "health": AnomalyReasonCode.LOW_HEALTH_COVERAGE,
    "water": AnomalyReasonCode.LOW_WATER_COVERAGE,
    "welfare": AnomalyReasonCode.LOW_WELFARE_COVERAGE,
}
REASON_PHRASES = {
    AnomalyReasonCode.LOW_HOUSING_COVERAGE: "low housing coverage",
    AnomalyReasonCode.LOW_HEALTH_COVERAGE: "low health coverage",
    AnomalyReasonCode.LOW_WATER_COVERAGE: "low water coverage",
    AnomalyReasonCode.LOW_WELFARE_COVERAGE: "low welfare coverage",
    AnomalyReasonCode.HIGH_PENDING_RATE: "elevated pending cases",
    AnomalyReasonCode.SERVICE_COVERAGE_DECLINE: "a marked decline in service coverage",
    AnomalyReasonCode.MULTI_SERVICE_GAP: "multiple service gaps",
    AnomalyReasonCode.UNUSUAL_COMBINATION: (
        "an unusual combination of service coverage and pending patterns"
    ),
}
NORMAL_EXPLANATION = (
    "Service and pending patterns are within the usual range of the available "
    "village dataset."
)


class AnomalySource(Protocol):
    @property
    def village_id(self) -> str: ...

    @property
    def village(self) -> str: ...

    @property
    def district(self) -> str: ...

    @property
    def block(self) -> str | None: ...

    @property
    def housing_coverage(self) -> Decimal | float | None: ...

    @property
    def health_coverage(self) -> Decimal | float | None: ...

    @property
    def water_coverage(self) -> Decimal | float | None: ...

    @property
    def welfare_coverage(self) -> Decimal | float | None: ...

    @property
    def pending_rate(self) -> Decimal | float | None: ...

    @property
    def historical_housing_coverage(self) -> Decimal | float | None: ...

    @property
    def historical_health_coverage(self) -> Decimal | float | None: ...

    @property
    def historical_water_coverage(self) -> Decimal | float | None: ...

    @property
    def historical_welfare_coverage(self) -> Decimal | float | None: ...


@dataclass(frozen=True)
class VillageAnomalySource:
    village_id: str
    village: str
    district: str
    block: str
    housing_coverage: float
    health_coverage: float
    water_coverage: float
    welfare_coverage: float
    pending_rate: float
    historical_housing_coverage: float
    historical_health_coverage: float
    historical_water_coverage: float
    historical_welfare_coverage: float


_cache_lock = RLock()
_cached_fingerprint: tuple[tuple[str, str, str, str, tuple[float, ...]], ...] | None = None
_cached_results: tuple[VillageAnomaly, ...] = ()


def _value(value: Decimal | float | None) -> float:
    if value is None:
        raise ValueError("Anomaly feature values must be available.")
    return float(value)


def _snapshot_village(village: AnomalySource) -> VillageAnomalySource:
    return VillageAnomalySource(
        village_id=str(village.village_id),
        village=str(village.village),
        district=str(village.district),
        block=village.block or "",
        housing_coverage=float(village.housing_coverage),
        health_coverage=float(village.health_coverage),
        water_coverage=float(village.water_coverage),
        welfare_coverage=float(village.welfare_coverage),
        pending_rate=float(village.pending_rate),
        historical_housing_coverage=float(village.historical_housing_coverage),
        historical_health_coverage=float(village.historical_health_coverage),
        historical_water_coverage=float(village.historical_water_coverage),
        historical_welfare_coverage=float(village.historical_welfare_coverage),
    )


def _feature_values(village: AnomalySource) -> tuple[float, ...]:
    current = tuple(_value(getattr(village, f"{name}_coverage")) for name in SERVICE_NAMES)
    historical = tuple(
        _value(getattr(village, f"historical_{name}_coverage"))
        for name in SERVICE_NAMES
    )
    declines = tuple(
        max(previous - current_value, 0.0)
        for current_value, previous in zip(current, historical, strict=True)
    )
    return (
        *current,
        _value(village.pending_rate),
        *historical,
        *declines,
    )


def build_feature_matrix(villages: Sequence[AnomalySource]) -> np.ndarray:
    """Build current, historical, pending, and positive-deterioration features."""
    if not villages:
        return np.empty((0, len(FEATURE_NAMES)), dtype=float)
    return np.asarray([_feature_values(village) for village in villages], dtype=float)


def _reason_codes(
    village: AnomalySource,
    population: Sequence[AnomalySource],
) -> list[AnomalyReasonCode]:
    current_values = {
        name: np.asarray(
            [_value(getattr(item, f"{name}_coverage")) for item in population],
            dtype=float,
        )
        for name in SERVICE_NAMES
    }
    reasons: list[AnomalyReasonCode] = []
    below_median_services = 0

    for name in SERVICE_NAMES:
        value = _value(getattr(village, f"{name}_coverage"))
        values = current_values[name]
        low_threshold = float(np.percentile(values, LOW_COVERAGE_PERCENTILE))
        median_threshold = float(np.percentile(values, MEDIAN_PERCENTILE))
        if value <= low_threshold and value < median_threshold:
            reasons.append(SERVICE_REASON_CODES[name])
        if value < median_threshold:
            below_median_services += 1

    pending_values = np.asarray(
        [_value(item.pending_rate) for item in population],
        dtype=float,
    )
    pending_rate = _value(village.pending_rate)
    if (
        pending_rate >= float(np.percentile(pending_values, HIGH_PENDING_PERCENTILE))
        and pending_rate > float(np.percentile(pending_values, MEDIAN_PERCENTILE))
    ):
        reasons.append(AnomalyReasonCode.HIGH_PENDING_RATE)

    declines = _feature_values(village)[-len(SERVICE_NAMES) :]
    population_declines = np.asarray(
        [_feature_values(item)[-len(SERVICE_NAMES) :] for item in population],
        dtype=float,
    )
    decline_threshold = float(
        np.percentile(population_declines, HIGH_DECLINE_PERCENTILE)
    )
    if max(declines) > 0 and max(declines) >= decline_threshold:
        reasons.append(AnomalyReasonCode.SERVICE_COVERAGE_DECLINE)

    if below_median_services >= 2:
        reasons.append(AnomalyReasonCode.MULTI_SERVICE_GAP)

    return reasons


def _explanation(
    anomaly_status: AnomalyStatus,
    reason_codes: Sequence[AnomalyReasonCode],
) -> str:
    if not reason_codes:
        if anomaly_status == AnomalyStatus.NORMAL:
            return NORMAL_EXPLANATION
        return (
            "Statistically unusual service and pending pattern; no individual "
            "threshold-based driver was identified."
        )

    phrases = [REASON_PHRASES[code] for code in reason_codes]
    if len(phrases) == 1:
        drivers = phrases[0]
    elif len(phrases) == 2:
        drivers = f"{phrases[0]} and {phrases[1]}"
    else:
        drivers = f"{', '.join(phrases[:-1])} and {phrases[-1]}"
    if anomaly_status == AnomalyStatus.NORMAL:
        return (
            "Overall service and pending patterns are not statistically "
            f"unusual, but the village has {drivers}."
        )
    return f"Statistically unusual service and pending pattern driven by {drivers}."


def _fingerprint(
    villages: Sequence[AnomalySource],
) -> tuple[tuple[str, str, str, str, tuple[float, ...]], ...]:
    return tuple(
        (
            village.village_id,
            village.village,
            village.district,
            village.block,
            _feature_values(village),
        )
        for village in villages
    )


def _evaluate_population(
    villages: Sequence[AnomalySource],
) -> tuple[VillageAnomaly, ...]:
    ordered_villages = sorted(villages, key=lambda village: village.village_id)
    if not ordered_villages:
        return ()

    fingerprint = _fingerprint(ordered_villages)
    global _cached_fingerprint, _cached_results
    with _cache_lock:
        if fingerprint == _cached_fingerprint:
            return _cached_results

        features = build_feature_matrix(ordered_villages)
        if len(ordered_villages) < 2:
            statuses = np.zeros(len(ordered_villages), dtype=int)
            normalized_scores = np.zeros(len(ordered_villages), dtype=float)
        else:
            scaled_features = StandardScaler().fit_transform(features)
            model = IsolationForest(
                n_estimators=N_ESTIMATORS,
                contamination=CONTAMINATION,
                random_state=RANDOM_STATE,
            )
            statuses = model.fit_predict(scaled_features)
            raw_scores = model.decision_function(scaled_features)
            normalized_scores = np.asarray(
                [
                    (
                        np.count_nonzero(raw_scores > score)
                        + 0.5 * np.count_nonzero(raw_scores == score)
                    )
                    / len(raw_scores)
                    for score in raw_scores
                ],
                dtype=float,
            )

        results: list[VillageAnomaly] = []
        for village, model_status, score in zip(
            ordered_villages,
            statuses,
            normalized_scores,
            strict=True,
        ):
            anomaly_status = (
                AnomalyStatus.UNUSUAL
                if model_status == -1
                else AnomalyStatus.NORMAL
            )
            reasons = _reason_codes(village, ordered_villages)
            if anomaly_status == AnomalyStatus.UNUSUAL and not reasons:
                reasons.append(AnomalyReasonCode.UNUSUAL_COMBINATION)
            results.append(
                VillageAnomaly(
                    village_id=village.village_id,
                    village=village.village,
                    district=village.district,
                    block=village.block,
                    anomaly_score=round(float(score), 6),
                    anomaly_status=anomaly_status,
                    reason_codes=reasons,
                    explanation=_explanation(anomaly_status, reasons),
                )
            )

        _cached_fingerprint = fingerprint
        _cached_results = tuple(results)
        return _cached_results


def list_village_anomalies(
    db: Session,
    *,
    villages: Sequence[AnomalySource] | None = None,
    district: str | None = None,
    anomaly_only: bool = False,
    limit: int | None = 50,
    minimum_population: int = 1,
) -> list[VillageAnomaly]:
    """Evaluate all villages, then apply response filters and the result limit."""
    population = list(villages) if villages is not None else [
        _snapshot_village(village)
        for village in db.scalars(select(Village).order_by(Village.village_id)).all()
    ]
    available_population = [
        village for village in population
        if all(getattr(village, field, None) is not None for field in FEATURE_INPUT_FIELDS)
    ]
    insufficient_population = len(available_population) < minimum_population
    results = (
        []
        if insufficient_population
        else list(_evaluate_population(available_population))
    )
    if villages is not None:
        available_ids = {result.village_id for result in results}
        results.extend(
            VillageAnomaly(
                village_id=village.village_id,
                village=village.village,
                district=village.district,
                block=village.block or "",
                anomaly_score=None,
                anomaly_status=AnomalyStatus.UNAVAILABLE,
                reason_codes=[],
                explanation=(
                    "Anomaly analysis is unavailable because fewer than two "
                    "records contain all required analytical inputs."
                    if insufficient_population
                    else "Anomaly analysis is unavailable because this record lacks "
                    "current, historical, or pending-rate data."
                ),
                available=False,
            )
            for village in population
            if village.village_id not in available_ids
        )
    if district is not None:
        target_district = district.strip().casefold()
        results = [
            result for result in results
            if result.district.casefold() == target_district
        ]
    results.sort(key=lambda result: result.village_id)
    if anomaly_only:
        results = [
            result
            for result in results
            if result.anomaly_status == AnomalyStatus.UNUSUAL
        ]
    return list(results if limit is None else results[:limit])


FEATURE_INPUT_FIELDS = BASE_FEATURE_NAMES


def get_village_anomaly(
    db: Session,
    village_id: str,
    *,
    villages: Sequence[AnomalySource] | None = None,
    minimum_population: int = 1,
) -> VillageAnomaly | None:
    """Return one village's result after comparing it with the full population."""
    population = list(villages) if villages is not None else [
        _snapshot_village(village)
        for village in db.scalars(select(Village).order_by(Village.village_id)).all()
    ]
    return next(
        (
            result
            for result in list_village_anomalies(
                db,
                villages=population,
                limit=None,
                minimum_population=minimum_population,
            )
            if result.village_id == village_id
        ),
        None,
    )
