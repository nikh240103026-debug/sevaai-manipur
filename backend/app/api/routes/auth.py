import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_session_token,
    hash_session_token,
    verify_password,
)
from app.db.database import get_db
from app.models.auth import AuthSession, AuthUser
from app.schemas.auth import AuthUserResponse, LoginRequest

logger = logging.getLogger(__name__)
router = APIRouter()
SESSION_COOKIE = "sevaai_session"
SESSION_LIFETIME = timedelta(hours=8)


def _database_error() -> HTTPException:
    logger.exception("Authentication database operation failed")
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Authentication service is unavailable",
    )


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid user ID or password",
    )


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        secure=get_settings().auth_cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=AuthUserResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthUser:
    try:
        user = db.get(AuthUser, payload.normalized_user_id())
        password_valid = verify_password(
            payload.password, user.password_hash if user is not None else None
        )
        if user is None or not user.is_active or not password_valid:
            raise _unauthorized()

        token = create_session_token()
        db.add(
            AuthSession(
                token_hash=hash_session_token(token),
                user_id=user.user_id,
                expires_at=datetime.now(UTC) + SESSION_LIFETIME,
            )
        )
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_error() from exc

    _set_session_cookie(response, token)
    return user


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> AuthUser:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise _unauthorized()

    try:
        session = db.get(AuthSession, hash_session_token(token))
        if session is None:
            raise _unauthorized()
        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= datetime.now(UTC):
            db.delete(session)
            db.commit()
            raise _unauthorized()

        user = db.get(AuthUser, session.user_id)
        if user is None or not user.is_active:
            raise _unauthorized()
        return user
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_error() from exc


@router.get("/me", response_model=AuthUserResponse)
def read_current_user(
    current_user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        try:
            session = db.get(AuthSession, hash_session_token(token))
            if session is not None:
                db.delete(session)
                db.commit()
        except SQLAlchemyError as exc:
            raise _database_error() from exc

    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=get_settings().auth_cookie_secure,
        samesite="lax",
        path="/",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
