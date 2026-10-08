from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.village import Base

JSON_DOCUMENT = JSON().with_variant(JSONB(), "postgresql")


class DataUpload(Base):
    __tablename__ = "data_uploads"

    __table_args__ = (
        Index("data_uploads_scope_idx", "scope_district", "scope_block"),
        Index("data_uploads_created_at_idx", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    scope_district: Mapped[str | None] = mapped_column(String(100))
    scope_block: Mapped[str | None] = mapped_column(String(100))
    dataset_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="GOVERNMENT_UPLOAD",
        server_default="GOVERNMENT_UPLOAD",
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(8), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False)
    rejected_rows: Mapped[int] = mapped_column(Integer, nullable=False)
    detected_columns: Mapped[list[str]] = mapped_column(JSON_DOCUMENT, nullable=False)
    mapped_columns: Mapped[dict[str, str]] = mapped_column(JSON_DOCUMENT, nullable=False)
    unmapped_columns: Mapped[list[str]] = mapped_column(JSON_DOCUMENT, nullable=False)
    validation_errors: Mapped[list[str]] = mapped_column(JSON_DOCUMENT, nullable=False)
    warnings: Mapped[list[str]] = mapped_column(JSON_DOCUMENT, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class ImportedDataRow(Base):
    __tablename__ = "imported_data_rows"

    __table_args__ = (
        Index("imported_data_rows_upload_row_idx", "upload_id", "row_number", unique=True),
        Index("imported_data_rows_scope_idx", "district", "block"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    upload_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("data_uploads.id", ondelete="CASCADE"),
        nullable=False,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    block: Mapped[str | None] = mapped_column(String(100))
    normalized_data: Mapped[dict[str, Any]] = mapped_column(
        JSON_DOCUMENT,
        nullable=False,
    )
