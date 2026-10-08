import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import authorize_village_access, require_authenticated_user
from app.db.database import get_db
from app.models.village import Village
from app.models.user import User
from app.schemas.analytics import VillageAnalytics
from app.services.analytics import VillageAnalyticsInput, build_village_analytics

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
    user: User = Depends(require_authenticated_user),
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
    authorize_village_access(user, village)

    analytics_input = VillageAnalyticsInput(
        village_id=village.village_id,
        village=village.village,
        district=village.district,
        block=village.block,
        housing_coverage=village.housing_coverage,
        health_coverage=village.health_coverage,
        water_coverage=village.water_coverage,
        welfare_coverage=village.welfare_coverage,
        historical_housing_coverage=village.historical_housing_coverage,
        historical_health_coverage=village.historical_health_coverage,
        historical_water_coverage=village.historical_water_coverage,
        historical_welfare_coverage=village.historical_welfare_coverage,
        pending_rate=village.pending_rate,
    )
    return build_village_analytics(analytics_input)
