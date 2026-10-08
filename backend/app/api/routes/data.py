import logging
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_authenticated_user
from app.db.database import get_db
from app.models.data_upload import DataUpload, ImportedDataRow
from app.models.user import User, UserRole
from app.schemas.data_upload import (
    ActiveDatasetResponse,
    DataUploadSummary,
    ImportedDataRowResponse,
    ImportedDataRowsResponse,
    UploadStatus,
)
from app.services.dataset import get_active_dataset
from app.schemas.analytics import VillageAnalytics
from app.services.analytics import VillageAnalyticsInput, build_village_analytics
from app.services.data_import import (
    MAX_UPLOAD_BYTES,
    DataImportFileError,
    detect_file_type,
    normalize_table,
    read_tabular_file,
    sanitize_filename,
)

logger = logging.getLogger(__name__)
router = APIRouter()
READ_CHUNK_SIZE = 1024 * 1024


def _database_error() -> HTTPException:
    logger.error("Government data import database operation failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Data import storage is unavailable",
    )


def _upload_scope(user: User) -> tuple[str | None, str | None]:
    if user.role == UserRole.STATE_ADMIN:
        return None, None
    if not user.district:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No district is assigned to this account",
        )
    return (
        user.district,
        user.block if user.role == UserRole.BLOCK_OFFICER else None,
    )


def _upload_is_in_scope(user: User, upload: DataUpload) -> bool:
    if user.role == UserRole.STATE_ADMIN:
        return True
    if (
        not user.district
        or upload.scope_district is None
        or upload.scope_district.strip().casefold() != user.district.strip().casefold()
    ):
        return False
    if user.role == UserRole.BLOCK_OFFICER:
        return (
            user.block is not None
            and upload.scope_block is not None
            and upload.scope_block.strip().casefold() == user.block.strip().casefold()
        )
    return True


def _response(upload: DataUpload) -> DataUploadSummary:
    return DataUploadSummary(
        upload_id=upload.id,
        status=UploadStatus(upload.status),
        filename=upload.filename,
        file_type=upload.file_type,
        row_count=upload.row_count,
        detected_columns=upload.detected_columns,
        mapped_columns=upload.mapped_columns,
        unmapped_columns=upload.unmapped_columns,
        validation_errors=upload.validation_errors,
        warnings=upload.warnings,
        valid_rows=upload.valid_rows,
        rejected_rows=upload.rejected_rows,
        created_at=upload.created_at,
    )


@router.get("/data/active", response_model=ActiveDatasetResponse)
def get_active_dataset_info(
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> ActiveDatasetResponse:
    try:
        dataset = get_active_dataset(db, user)
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    available_fields = sorted({
        field
        for village in dataset.villages
        for field in village.__dataclass_fields__
        if getattr(village, field) is not None
    })
    return ActiveDatasetResponse(
        mode=dataset.mode,
        upload_id=dataset.upload.id if dataset.upload else None,
        filename=dataset.upload.filename if dataset.upload else None,
        status=UploadStatus(dataset.upload.status) if dataset.upload else None,
        created_at=dataset.upload.created_at if dataset.upload else None,
        village_count=len(dataset.villages),
        available_fields=available_fields,
        map_available=any(
            village.latitude is not None and village.longitude is not None
            for village in dataset.villages
        ),
        analytics_available=any(
            village.analytics_available for village in dataset.villages
        ),
        anomalies_available=any(
            village.analytics_available for village in dataset.villages
        ) and (
            dataset.mode != "GOVERNMENT_UPLOAD"
            or sum(village.analytics_available for village in dataset.villages) >= 2
        ),
    )


def _imported_row_analytics(data: dict[str, object]) -> VillageAnalytics | None:
    required_fields = (
        "village_id",
        "village",
        "district",
        "block",
        "housing_coverage",
        "health_coverage",
        "water_coverage",
        "welfare_coverage",
        "historical_housing_coverage",
        "historical_health_coverage",
        "historical_water_coverage",
        "historical_welfare_coverage",
        "pending_rate",
    )
    if any(data.get(field) is None for field in required_fields):
        return None
    analytics_input = VillageAnalyticsInput(
        village_id=str(data["village_id"]),
        village=str(data["village"]),
        district=str(data["district"]),
        block=str(data["block"]),
        housing_coverage=Decimal(str(data["housing_coverage"])),
        health_coverage=Decimal(str(data["health_coverage"])),
        water_coverage=Decimal(str(data["water_coverage"])),
        welfare_coverage=Decimal(str(data["welfare_coverage"])),
        historical_housing_coverage=Decimal(str(data["historical_housing_coverage"])),
        historical_health_coverage=Decimal(str(data["historical_health_coverage"])),
        historical_water_coverage=Decimal(str(data["historical_water_coverage"])),
        historical_welfare_coverage=Decimal(str(data["historical_welfare_coverage"])),
        pending_rate=Decimal(str(data["pending_rate"])),
    )
    return build_village_analytics(analytics_input)


async def _read_bounded_file(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(min(READ_CHUNK_SIZE, MAX_UPLOAD_BYTES + 1 - total)):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Uploaded file exceeds the 20 MiB size limit",
            )
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Uploaded file is empty",
        )
    return b"".join(chunks)


@router.post(
    "/data/upload",
    response_model=DataUploadSummary,
    status_code=status.HTTP_201_CREATED,
)
async def upload_government_data(
    file: UploadFile = File(...),
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> DataUploadSummary:
    try:
        try:
            file_type = detect_file_type(file.filename)
        except DataImportFileError as exc:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=str(exc),
            ) from exc

        content = await _read_bounded_file(file)
        try:
            parsed = read_tabular_file(content, file_type)
        except DataImportFileError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
    finally:
        await file.close()

    normalized = normalize_table(parsed, user)
    valid_count = len(normalized.valid_rows)
    row_count = len(parsed.records)
    rejected_count = row_count - valid_count
    upload_status = (
        UploadStatus.COMPLETED
        if rejected_count == 0
        else UploadStatus.PARTIAL
        if valid_count > 0
        else UploadStatus.FAILED
    )
    scope_district, scope_block = _upload_scope(user)
    upload_id = uuid4()
    upload = DataUpload(
        id=upload_id,
        created_by=user.id,
        scope_district=scope_district,
        scope_block=scope_block,
        dataset_type="GOVERNMENT_UPLOAD",
        filename=sanitize_filename(file.filename, f".{file_type.casefold()}"),
        file_type=file_type,
        status=upload_status.value,
        row_count=row_count,
        valid_rows=valid_count,
        rejected_rows=rejected_count,
        detected_columns=parsed.columns,
        mapped_columns=normalized.mapped_columns,
        unmapped_columns=normalized.unmapped_columns,
        validation_errors=normalized.validation_errors,
        warnings=normalized.warnings,
    )
    try:
        db.add(upload)
        db.flush()
        for row_number, data in normalized.valid_rows:
            db.add(
                ImportedDataRow(
                    upload_id=upload_id,
                    row_number=row_number,
                    district=str(data["district"]),
                    block=str(data["block"]) if data.get("block") is not None else None,
                    normalized_data=data,
                )
            )
        db.commit()
        db.refresh(upload)
    except SQLAlchemyError as exc:
        db.rollback()
        raise _database_error() from exc

    return _response(upload)


@router.get("/data/uploads", response_model=list[DataUploadSummary])
def list_uploads(
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> list[DataUploadSummary]:
    statement = select(DataUpload).order_by(DataUpload.created_at.desc())
    if user.role != UserRole.STATE_ADMIN:
        district, block = _upload_scope(user)
        if district is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No district is assigned to this account",
            )
        statement = statement.where(
            func.lower(DataUpload.scope_district) == district.strip().lower()
        )
        if block is not None:
            statement = statement.where(
                func.lower(DataUpload.scope_block) == block.strip().lower()
            )
    try:
        uploads = db.scalars(statement).all()
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    return [_response(upload) for upload in uploads]


@router.get("/data/uploads/{upload_id}", response_model=DataUploadSummary)
def get_upload(
    upload_id: UUID,
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> DataUploadSummary:
    try:
        upload = db.get(DataUpload, upload_id)
    except SQLAlchemyError as exc:
        raise _database_error() from exc
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found",
        )
    if not _upload_is_in_scope(user, upload):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access is limited to the assigned data scope",
        )
    return _response(upload)


@router.get(
    "/data/uploads/{upload_id}/rows",
    response_model=ImportedDataRowsResponse,
)
def list_uploaded_rows(
    upload_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> ImportedDataRowsResponse:
    try:
        upload = db.get(DataUpload, upload_id)
        if upload is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload not found",
            )
        if not _upload_is_in_scope(user, upload):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access is limited to the assigned data scope",
            )
        filters = [ImportedDataRow.upload_id == upload_id]
        if user.role != UserRole.STATE_ADMIN:
            filters.append(
                func.lower(ImportedDataRow.district)
                == (user.district or "").strip().lower()
            )
        if user.role == UserRole.BLOCK_OFFICER:
            filters.append(
                func.lower(ImportedDataRow.block)
                == (user.block or "").strip().lower()
            )
        total = db.scalar(
            select(func.count())
            .select_from(ImportedDataRow)
            .where(*filters)
        ) or 0
        rows = db.scalars(
            select(ImportedDataRow)
            .where(*filters)
            .order_by(ImportedDataRow.row_number)
            .offset(offset)
            .limit(limit)
        ).all()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_error() from exc

    return ImportedDataRowsResponse(
        upload_id=upload_id,
        total=total,
        offset=offset,
        limit=limit,
        items=[
            ImportedDataRowResponse(
                row_number=row.row_number,
                normalized_data=row.normalized_data,
                analytics=_imported_row_analytics(row.normalized_data),
            )
            for row in rows
        ],
    )
