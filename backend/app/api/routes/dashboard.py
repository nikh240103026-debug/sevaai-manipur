import logging
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_authenticated_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.anomaly import AnomalyStatus
from app.schemas.dashboard import (
    DashboardSummary,
    PrioritySummary,
    PriorityVillage,
    ServiceCoverageSummary,
)
from app.services.anomaly import list_village_anomalies
from app.services.dataset import (
    DatasetVillage,
    filter_dataset_villages,
    get_active_dataset,
    village_analytics,
)

logger = logging.getLogger(__name__)
router = APIRouter()

ZERO = Decimal("0")
TWO_DECIMAL_PLACES = Decimal("0.01")
SERVICE_FIELDS = ("housing", "health", "water", "welfare")


def _database_error() -> HTTPException:
    logger.exception("Dashboard query failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database query failed",
    )


def _average(villages: tuple[DatasetVillage, ...], field: str) -> float | None:
    values = [
        Decimal(str(value))
        for village in villages
        if (value := getattr(village, field)) is not None
    ]
    if not values:
        return None
    return float(
        (sum(values, start=ZERO) / len(values)).quantize(
            TWO_DECIMAL_PLACES,
            rounding=ROUND_HALF_UP,
        )
    )


@router.get("/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    district: str | None = Query(default=None, min_length=1, max_length=100),
    block: str | None = Query(default=None, min_length=1, max_length=100),
    top: int = Query(default=10, ge=1, le=50),
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    try:
        dataset = get_active_dataset(db, user)
        villages = filter_dataset_villages(
            dataset.villages,
            user,
            district=district,
            block=block,
        )
        analytics = [village_analytics(village) for village in villages]
        anomaly_results = (
            list_village_anomalies(
                db,
                villages=dataset.villages,
                limit=None,
                minimum_population=(
                    2 if dataset.mode == "GOVERNMENT_UPLOAD" else 1
                ),
            )
            if dataset.villages
            else []
        )
    except SQLAlchemyError as exc:
        raise _database_error() from exc

    total_villages = len(villages)
    if not total_villages:
        return DashboardSummary(
            total_villages=0,
            total_population=0,
            total_pending_cases=0,
            service_coverage=ServiceCoverageSummary(
                housing=0.0,
                health=0.0,
                water=0.0,
                welfare=0.0,
            ),
            priority=PrioritySummary(high=0, medium=0, low=0),
            unusual_villages=0,
            top_priority_villages=[],
            analytics_available=False,
            anomalies_available=False,
        )

    population_values = [village.population for village in villages]
    pending_values = [village.pending_cases for village in villages]
    analytics_rows = [result for result in analytics if result.available]
    top_priority = sorted(
        analytics_rows,
        key=lambda result: (-result.priority_score, result.village_id),
    )[:top]
    scoped_ids = {village.village_id for village in villages}
    scoped_anomalies = [
        result for result in anomaly_results if result.village_id in scoped_ids
    ]
    available_anomaly_results = [
        result
        for result in scoped_anomalies
        if result.anomaly_status != AnomalyStatus.UNAVAILABLE
    ]

    return DashboardSummary(
        total_villages=total_villages,
        total_population=(
            sum(value for value in population_values if value is not None)
            if all(value is not None for value in population_values)
            else None
        ),
        total_pending_cases=(
            sum(value for value in pending_values if value is not None)
            if all(value is not None for value in pending_values)
            else None
        ),
        service_coverage=ServiceCoverageSummary(
            **{
                service: _average(villages, f"{service}_coverage")
                for service in SERVICE_FIELDS
            }
        ),
        priority=PrioritySummary(
            high=(
                sum(result.priority_level.value == "HIGH" for result in analytics_rows)
                if analytics_rows else None
            ),
            medium=(
                sum(result.priority_level.value == "MEDIUM" for result in analytics_rows)
                if analytics_rows else None
            ),
            low=(
                sum(result.priority_level.value == "LOW" for result in analytics_rows)
                if analytics_rows else None
            ),
        ),
        unusual_villages=(
            sum(
                result.anomaly_status == AnomalyStatus.UNUSUAL
                for result in available_anomaly_results
            )
            if available_anomaly_results else None
        ),
        top_priority_villages=[
            PriorityVillage(
                village_id=result.village_id,
                village=result.village,
                district=result.district,
                block=result.block or "",
                priority_score=float(result.priority_score),
                priority_level=result.priority_level,
                housing_gap=float(result.housing_gap),
                health_gap=float(result.health_gap),
                water_gap=float(result.water_gap),
                welfare_gap=float(result.welfare_gap),
            )
            for result in top_priority
        ],
        analytics_available=bool(analytics_rows),
        anomalies_available=bool(available_anomaly_results),
    )
