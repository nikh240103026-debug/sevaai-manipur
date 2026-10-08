import logging
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import authorize_village_access, require_authenticated_user
from app.db.database import get_db
from app.models.user import User
from app.models.village import Village
from app.schemas.village import (
    DistrictList,
    VillageMapPoint,
    VillagePage,
    VillageResponse,
)
from app.services.anomaly import list_village_anomalies
from app.services.dataset import (
    DatasetVillage,
    dataset_row_values,
    filter_dataset_villages,
    get_active_dataset,
    major_service_gap,
    village_analytics,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _database_error() -> HTTPException:
    logger.exception("Database query failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database query failed",
    )


def _village_response(village: DatasetVillage) -> VillageResponse:
    analytics = village_analytics(village)
    return VillageResponse(
        **dataset_row_values(village),
        priority_score=analytics.priority_score,
        priority_level=analytics.priority_level,
        major_service_gap=major_service_gap(village),
        analytics_available=analytics.available,
        analytics_unavailable_reason=analytics.unavailable_reason,
    )


@router.get("/villages", response_model=VillagePage)
def list_villages(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    district: str | None = Query(default=None, min_length=1, max_length=100),
    block: str | None = Query(default=None, min_length=1, max_length=100),
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> VillagePage:
    try:
        dataset = get_active_dataset(db, user)
        villages = filter_dataset_villages(
            dataset.villages,
            user,
            district=district,
            block=block,
        )
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    total = len(villages)
    start = (page - 1) * limit
    return VillagePage(
        items=[_village_response(village) for village in villages[start : start + limit]],
        page=page,
        limit=limit,
        total=total,
        pages=ceil(total / limit),
    )


@router.get("/villages/{village_id}", response_model=VillageResponse)
def get_village(
    village_id: str,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> VillageResponse:
    try:
        dataset = get_active_dataset(db, user)
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    village = next(
        (item for item in dataset.villages if item.village_id == village_id),
        None,
    )
    if village is None:
        if dataset.mode == "DEMO_DATA":
            try:
                existing = db.get(Village, village_id)
            except SQLAlchemyError as exc:
                raise _database_error() from exc
            if existing is not None:
                authorize_village_access(user, existing)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Village not found",
        )
    return _village_response(village)


@router.get("/districts", response_model=DistrictList)
def list_districts(
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> DistrictList:
    try:
        dataset = get_active_dataset(db, user)
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    return DistrictList(
        districts=sorted({village.district for village in dataset.villages})
    )


@router.get("/map/villages", response_model=list[VillageMapPoint])
def list_village_map_points(
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> list[VillageMapPoint]:
    try:
        dataset = get_active_dataset(db, user)
        anomalies = list_village_anomalies(
            db,
            villages=dataset.villages,
            limit=None,
            minimum_population=(
                2 if dataset.mode == "GOVERNMENT_UPLOAD" else 1
            ),
        )
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    anomaly_by_id = {item.village_id: item for item in anomalies}
    result: list[VillageMapPoint] = []
    for village in dataset.villages:
        if village.latitude is None or village.longitude is None:
            continue
        analytics = village_analytics(village)
        major_gap = major_service_gap(village)
        anomaly = anomaly_by_id.get(village.village_id)
        result.append(
            VillageMapPoint(
                village_id=village.village_id,
                village=village.village,
                district=village.district,
                block=village.block,
                latitude=village.latitude,
                longitude=village.longitude,
                priority_score=(
                    float(analytics.priority_score)
                    if analytics.available and analytics.priority_score is not None
                    else None
                ),
                priority_level=(
                    analytics.priority_level.value
                    if analytics.priority_level is not None
                    else None
                ),
                major_service_gap=major_gap,
                anomaly_status=anomaly.anomaly_status.value if anomaly else None,
            )
        )
    return result
