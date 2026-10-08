from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    Integer,
    String,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.village import Base


class UserRole(StrEnum):
    STATE_ADMIN = "STATE_ADMIN"
    DISTRICT_OFFICER = "DISTRICT_OFFICER"
    BLOCK_OFFICER = "BLOCK_OFFICER"


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "role IN ('STATE_ADMIN', 'DISTRICT_OFFICER', 'BLOCK_OFFICER')",
            name="users_role_valid",
        ),
        CheckConstraint(
            "(role = 'STATE_ADMIN' AND district IS NULL AND block IS NULL) "
            "OR (role = 'DISTRICT_OFFICER' AND district IS NOT NULL) "
            "OR (role = 'BLOCK_OFFICER' AND district IS NOT NULL AND block IS NOT NULL)",
            name="users_role_scope_valid",
        ),
        Index("users_role_idx", "role"),
        Index("users_district_idx", "district"),
        Index("users_block_idx", "block"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(150), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(String(32), nullable=False)
    district: Mapped[str | None] = mapped_column(String(100))
    block: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
