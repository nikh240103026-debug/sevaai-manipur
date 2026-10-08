import logging
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.village import Village

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


def _authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _authentication_error()
    try:
        subject = decode_access_token(credentials.credentials)
        user = db.get(User, int(subject))
    except jwt.InvalidTokenError as exc:
        raise _authentication_error() from exc
    except RuntimeError as exc:
        logger.error("Authentication configuration is unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Authentication user lookup failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable",
        ) from exc

    if user is None or not user.is_active:
        raise _authentication_error()
    return user


def require_authenticated_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user


def require_roles(*roles: UserRole) -> Callable[..., User]:
    def dependency(
        current_user: User = Depends(require_authenticated_user),
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency


def authorize_district_access(user: User, district: str) -> None:
    if user.role == UserRole.STATE_ADMIN:
        return
    assigned_district = (user.district or "").strip().casefold()
    if not assigned_district or district.strip().casefold() != assigned_district:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access is limited to the assigned district",
        )


def authorize_block_access(user: User, district: str, block: str) -> None:
    authorize_district_access(user, district)
    if user.role == UserRole.BLOCK_OFFICER:
        assigned_block = (user.block or "").strip().casefold()
        if not assigned_block or block.strip().casefold() != assigned_block:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access is limited to the assigned block",
            )


def authorize_village_access(user: User, village: Village) -> None:
    authorize_block_access(user, village.district, village.block)


def village_scope_filters(
    user: User,
    *,
    district: str | None = None,
    block: str | None = None,
) -> list[ColumnElement[bool]]:
    if district is not None:
        authorize_district_access(user, district)
    if block is not None:
        if user.role != UserRole.STATE_ADMIN:
            block_district = district or user.district
            if block_district is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="A district is required for block access",
                )
            authorize_block_access(user, block_district, block)

    filters: list[ColumnElement[bool]] = []
    if user.role != UserRole.STATE_ADMIN:
        if not user.district:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No district is assigned to this account",
            )
        filters.append(func.lower(Village.district) == user.district.strip().lower())
    if user.role == UserRole.BLOCK_OFFICER:
        if not user.block:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No block is assigned to this account",
            )
        filters.append(func.lower(Village.block) == user.block.strip().lower())
    if district is not None:
        filters.append(func.lower(Village.district) == district.strip().lower())
    if block is not None:
        filters.append(func.lower(Village.block) == block.strip().lower())
    return filters
