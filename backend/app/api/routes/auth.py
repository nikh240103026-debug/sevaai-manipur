import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    dummy_password_hash,
    verify_password,
)
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import CurrentUserResponse, LoginRequest, TokenResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = db.scalars(
            select(User).where(User.username == payload.username.strip())
        ).first()
    except SQLAlchemyError as exc:
        logger.exception("User login lookup failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable",
        ) from exc

    password = payload.password.get_secret_value()
    stored_hash = user.password_hash if user is not None else dummy_password_hash()
    password_matches = verify_password(password, stored_hash)
    if (
        user is None
        or not password_matches
        or not user.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        access_token = create_access_token(str(user.id))
    except RuntimeError as exc:
        logger.error("Authentication configuration is unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured",
        ) from exc

    return TokenResponse(
        access_token=access_token,
        expires_in=get_settings().access_token_expire_minutes * 60,
    )


@router.get("/auth/me", response_model=CurrentUserResponse)
def read_current_user(
    user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    return CurrentUserResponse.model_validate(user)
