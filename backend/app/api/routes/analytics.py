import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.village import Village
from app.schemas.analytics import VillageAnalytics
from app.services.analytics import build_village_analytics

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/analytics/villages/{village_id}",
    response_model=VillageAnalytics,
    description=(
        "Returns a transparent analytical prototype score, not an official "
        "government classification. The 0-100 score weights average service "
        "gap at 30%, maximum service gap at 25%, pending rate at 20%, average "
        "positive historical deterioration at 15%, and the share of services "
        "with a gap of at least 20% at 10%."
    ),
)
def get_village_analytics(
    village_id: str,
    db: Session = Depends(get_db),
) -> VillageAnalytics:
    try:
        village = db.get(Village, village_id)
    except SQLAlchemyError as exc:
        logger.exception("Village analytics query failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database query failed",
        ) from exc

    if village is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Village not found",
        )

    return build_village_analytics(village)
