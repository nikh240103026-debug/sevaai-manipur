import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import authorize_village_access, require_authenticated_user
from app.db.database import get_db
from app.models.user import User
from app.models.village import Village
from app.schemas.analytics import VillageAnalytics
from app.services.dataset import get_active_dataset, village_analytics

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/analytics/villages/{village_id}",
    response_model=VillageAnalytics,
    description=(
        "Returns the existing transparent priority scoring prototype when the "
        "active record contains its required inputs, or an explicit unavailable "
        "state when those inputs are absent."
    ),
)
def get_village_analytics(
    village_id: str,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> VillageAnalytics:
    try:
        dataset = get_active_dataset(db, user)
    except SQLAlchemyError as exc:
        logger.exception("Village analytics query failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database query failed",
        ) from exc
    village = next(
        (item for item in dataset.villages if item.village_id == village_id),
        None,
    )
    if village is None:
        if dataset.mode == "DEMO_DATA":
            try:
                existing = db.get(Village, village_id)
            except SQLAlchemyError as exc:
                logger.exception("Village analytics query failed")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database query failed",
                ) from exc
            if existing is not None:
                authorize_village_access(user, existing)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Village not found",
        )
    return village_analytics(village)
