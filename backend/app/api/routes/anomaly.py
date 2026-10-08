import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import (
    authorize_district_access,
    require_authenticated_user,
)
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.anomaly import VillageAnomaly
from app.services.anomaly import get_village_anomaly, list_village_anomalies
from app.services.dataset import get_active_dataset

logger = logging.getLogger(__name__)
router = APIRouter()


def _database_error() -> HTTPException:
    logger.exception("Village anomaly query failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database query failed",
    )


@router.get(
    "/ai/anomalies",
    response_model=list[VillageAnomaly],
    description=(
        "Unsupervised Isolation Forest signals from the active dataset. "
        "Unavailable inputs are explicitly marked. Unusual does not mean "
        "fraud or wrongdoing; results are for decision support only."
    ),
)
def list_anomalies(
    limit: int = Query(default=50, ge=1, le=100),
    district: str | None = Query(default=None, min_length=1, max_length=100),
    anomaly_only: bool = Query(default=False),
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> list[VillageAnomaly]:
    effective_district = district
    if user.role != UserRole.STATE_ADMIN:
        if district is not None:
            authorize_district_access(user, district)
        effective_district = user.district
    try:
        dataset = get_active_dataset(db, user)
        results = list_village_anomalies(
            db,
            villages=dataset.villages,
            district=effective_district,
            anomaly_only=anomaly_only,
            limit=None,
            minimum_population=(
                2 if dataset.mode == "GOVERNMENT_UPLOAD" else 1
            ),
        )
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    if user.role == UserRole.BLOCK_OFFICER:
        results = [
            result
            for result in results
            if result.block.casefold() == (user.block or "").casefold()
        ]
    return results[:limit]


@router.get("/ai/anomalies/{village_id}", response_model=VillageAnomaly)
def village_anomaly(
    village_id: str,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> VillageAnomaly:
    try:
        dataset = get_active_dataset(db, user)
        result = get_village_anomaly(
            db,
            village_id,
            villages=dataset.villages,
            minimum_population=(
                2 if dataset.mode == "GOVERNMENT_UPLOAD" else 1
            ),
        )
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Village not found",
        )
    return result
