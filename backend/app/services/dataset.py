"""Select and normalize the dataset visible to an authenticated user."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import village_scope_filters
from app.models.data_upload import DataUpload, ImportedDataRow
from app.models.user import User, UserRole
from app.models.village import Village
from app.schemas.analytics import VillageAnalytics
from app.services.analytics import VillageAnalyticsInput, build_village_analytics

_ANALYTICS_FIELDS = (
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


@dataclass(frozen=True)
class DatasetVillage:
    village_id: str
    village: str
    district: str
    block: str | None
    state: str | None = None
    gram_panchayat: str | None = None
    population: int | None = None
    households: int | None = None
    eligible_households: int | None = None
    housing_eligible: int | None = None
    housing_covered: int | None = None
    housing_coverage: Decimal | float | None = None
    health_eligible: int | None = None
    health_covered: int | None = None
    health_coverage: Decimal | float | None = None
    water_eligible: int | None = None
    water_covered: int | None = None
    water_coverage: Decimal | float | None = None
    welfare_eligible: int | None = None
    welfare_covered: int | None = None
    welfare_coverage: Decimal | float | None = None
    pending_cases: int | None = None
    pending_rate: Decimal | float | None = None
    historical_housing_coverage: Decimal | float | None = None
    historical_health_coverage: Decimal | float | None = None
    historical_water_coverage: Decimal | float | None = None
    historical_welfare_coverage: Decimal | float | None = None
    latitude: float | None = None
    longitude: float | None = None
    data_date: date | None = None

    @property
    def analytics_available(self) -> bool:
        return all(getattr(self, field) is not None for field in _ANALYTICS_FIELDS)


@dataclass(frozen=True)
class ActiveDataset:
    mode: str
    villages: tuple[DatasetVillage, ...]
    upload: DataUpload | None = None


def _as_dataset_village(
    values: dict[str, Any],
    village_id: str,
) -> DatasetVillage | None:
    village = values.get("village")
    district = values.get("district")
    if not isinstance(village, str) or not isinstance(district, str):
        return None
    fields = DatasetVillage.__dataclass_fields__
    return DatasetVillage(
        village_id=village_id,
        village=village,
        district=district,
        **{
            name: values.get(name)
            for name in fields
            if name not in {"village_id", "village", "district"}
        },
    )


def _scope_upload_statement(user: User):
    statement = select(DataUpload).where(
        DataUpload.status.in_(("COMPLETED", "PARTIAL")),
        DataUpload.valid_rows > 0,
    )
    if user.role == UserRole.STATE_ADMIN:
        return statement
    if not user.district:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No district is assigned to this account",
        )
    statement = statement.where(
        func.lower(DataUpload.scope_district) == user.district.strip().lower()
    )
    if user.role == UserRole.BLOCK_OFFICER:
        if not user.block:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No block is assigned to this account",
            )
        statement = statement.where(
            func.lower(DataUpload.scope_block) == user.block.strip().lower()
        )
    return statement


def _within_scope(
    record: DatasetVillage,
    user: User,
    district: str | None,
    block: str | None,
) -> bool:
    if user.role != UserRole.STATE_ADMIN and (
        record.district.strip().casefold()
        != (user.district or "").strip().casefold()
    ):
        return False
    if user.role == UserRole.BLOCK_OFFICER and (
        (record.block or "").strip().casefold()
        != (user.block or "").strip().casefold()
    ):
        return False
    if district is not None and record.district.strip().casefold() != district.strip().casefold():
        return False
    if block is not None and (record.block or "").strip().casefold() != block.strip().casefold():
        return False
    return True


def _uploaded_villages(
    db: Session,
    user: User,
    district: str | None,
    block: str | None,
) -> tuple[DataUpload, tuple[DatasetVillage, ...]] | None:
    candidates = db.scalars(
        _scope_upload_statement(user).order_by(
            DataUpload.created_at.desc(),
            DataUpload.id.desc(),
        )
    ).all()
    for upload in candidates:
        if not isinstance(upload, DataUpload):
            continue
        statement = (
            select(ImportedDataRow)
            .where(ImportedDataRow.upload_id == upload.id)
            .order_by(ImportedDataRow.row_number)
        )
        if user.role != UserRole.STATE_ADMIN:
            statement = statement.where(
                func.lower(ImportedDataRow.district)
                == (user.district or "").strip().lower()
            )
        if user.role == UserRole.BLOCK_OFFICER:
            statement = statement.where(
                func.lower(ImportedDataRow.block) == (user.block or "").strip().lower()
            )
        rows = db.scalars(statement).all()
        villages = tuple(
            record
            for row in rows
            if isinstance(row, ImportedDataRow)
            and (
                record := _as_dataset_village(
                    row.normalized_data,
                    f"{upload.id}:{row.row_number}",
                )
            ) is not None
            and _within_scope(record, user, district, block)
        )
        if villages:
            return upload, villages
    return None


def _synthetic_villages(
    db: Session,
    user: User,
    district: str | None,
    block: str | None,
) -> tuple[DatasetVillage, ...]:
    filters = village_scope_filters(user, district=district, block=block)
    entities = db.scalars(
        select(Village).where(*filters).order_by(Village.village_id)
    ).all()
    villages = tuple(
        DatasetVillage(
            **{
                name: getattr(entity, name, None)
                for name in DatasetVillage.__dataclass_fields__
            }
        )
        for entity in entities
    )
    return tuple(
        village
        for village in villages
        if _within_scope(village, user, district, block)
    )


def get_active_dataset(
    db: Session,
    user: User,
    *,
    district: str | None = None,
    block: str | None = None,
) -> ActiveDataset:
    """Return the latest usable in-scope upload, or the scoped demo villages."""
    # Validate optional query scope before selecting either source.
    village_scope_filters(user, district=district, block=block)
    selected = _uploaded_villages(db, user, district, block)
    if selected is not None:
        upload, villages = selected
        return ActiveDataset("GOVERNMENT_UPLOAD", villages, upload)
    return ActiveDataset(
        "DEMO_DATA",
        _synthetic_villages(db, user, district, block),
    )


def filter_dataset_villages(
    villages: tuple[DatasetVillage, ...],
    user: User,
    *,
    district: str | None = None,
    block: str | None = None,
) -> tuple[DatasetVillage, ...]:
    village_scope_filters(user, district=district, block=block)
    return tuple(
        village
        for village in villages
        if _within_scope(village, user, district, block)
    )


def dataset_row_values(village: DatasetVillage) -> dict[str, Any]:
    return {
        name: getattr(village, name)
        for name in DatasetVillage.__dataclass_fields__
    }


def major_service_gap(village: DatasetVillage) -> str | None:
    gaps = {
        label: Decimal("100") - Decimal(str(coverage))
        for label, field in (
            ("Housing", "housing_coverage"),
            ("Health", "health_coverage"),
            ("Water", "water_coverage"),
            ("Welfare", "welfare_coverage"),
        )
        if (coverage := getattr(village, field)) is not None
    }
    return max(gaps, key=gaps.get) if gaps else None


def village_analytics(village: DatasetVillage) -> VillageAnalytics:
    if not village.analytics_available:
        return VillageAnalytics(
            village_id=village.village_id,
            village=village.village,
            district=village.district,
            block=village.block,
            available=False,
            unavailable_reason=(
                "Priority analytics require current service coverage, historical "
                "service coverage, and pending-rate data."
            ),
        )
    return build_village_analytics(
        VillageAnalyticsInput(
            village_id=village.village_id,
            village=village.village,
            district=village.district,
            block=village.block,
            housing_coverage=Decimal(str(village.housing_coverage)),
            health_coverage=Decimal(str(village.health_coverage)),
            water_coverage=Decimal(str(village.water_coverage)),
            welfare_coverage=Decimal(str(village.welfare_coverage)),
            historical_housing_coverage=Decimal(str(village.historical_housing_coverage)),
            historical_health_coverage=Decimal(str(village.historical_health_coverage)),
            historical_water_coverage=Decimal(str(village.historical_water_coverage)),
            historical_welfare_coverage=Decimal(str(village.historical_welfare_coverage)),
            pending_rate=Decimal(str(village.pending_rate)),
        )
    )
