import logging
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.village import Village
from app.schemas.village import (
    DistrictList,
    VillageMapPoint,
    VillagePage,
    VillageResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _database_error() -> HTTPException:
    logger.exception("Database query failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database query failed",
    )


@router.get("/villages", response_model=VillagePage)
def list_villages(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    district: str | None = Query(default=None, min_length=1, max_length=100),
    block: str | None = Query(default=None, min_length=1, max_length=100),
    db: Session = Depends(get_db),
) -> VillagePage:
    filters = []
    if district is not None:
        filters.append(func.lower(Village.district) == district.strip().lower())
    if block is not None:
        filters.append(func.lower(Village.block) == block.strip().lower())

    try:
        total = db.scalar(select(func.count()).select_from(Village).where(*filters)) or 0
        items = db.scalars(
            select(Village)
            .where(*filters)
            .order_by(Village.village_id)
            .offset((page - 1) * limit)
            .limit(limit)
        ).all()
    except SQLAlchemyError as exc:
        raise _database_error() from exc

    return VillagePage(
        items=items,
        page=page,
        limit=limit,
        total=total,
        pages=ceil(total / limit),
    )


@router.get("/villages/{village_id}", response_model=VillageResponse)
def get_village(village_id: str, db: Session = Depends(get_db)) -> Village:
    try:
        village = db.get(Village, village_id)
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    if village is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Village not found",
        )
    return village


@router.get("/districts", response_model=DistrictList)
def list_districts(db: Session = Depends(get_db)) -> DistrictList:
    try:
        districts = db.scalars(
            select(Village.district).distinct().order_by(Village.district)
        ).all()
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    return DistrictList(districts=districts)


@router.get("/map/villages", response_model=list[VillageMapPoint])
def list_village_map_points(db: Session = Depends(get_db)) -> list[VillageMapPoint]:
    try:
        rows = db.execute(
            select(
                Village.village_id,
                Village.village,
                Village.district,
                Village.block,
                Village.latitude,
                Village.longitude,
            ).order_by(Village.village_id)
        ).all()
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    return [VillageMapPoint.model_validate(row._mapping) for row in rows]
