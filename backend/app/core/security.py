from datetime import UTC, datetime, timedelta
from functools import lru_cache
import secrets

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import PwdlibError

from app.core.config import get_settings

password_hash = PasswordHash.recommended()
SUPPORTED_JWT_ALGORITHMS = {"HS256"}


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return password_hash.verify(password, hashed_password)
    except PwdlibError:
        return False


@lru_cache(maxsize=1)
def dummy_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(32))


def _jwt_settings() -> tuple[str, str, int]:
    settings = get_settings()
    secret_key = (
        settings.jwt_secret_key.get_secret_value()
        if settings.jwt_secret_key is not None
        else ""
    )
    if len(secret_key.encode("utf-8")) < 32:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 bytes")
    if settings.jwt_algorithm not in SUPPORTED_JWT_ALGORITHMS:
        raise RuntimeError("Unsupported JWT_ALGORITHM")
    return secret_key, settings.jwt_algorithm, settings.access_token_expire_minutes


def create_access_token(subject: str, *, expires_minutes: int | None = None) -> str:
    secret_key, algorithm, configured_expiry = _jwt_settings()
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=expires_minutes or configured_expiry)
    return jwt.encode(
        {"sub": subject, "iat": now, "exp": expires_at},
        secret_key,
        algorithm=algorithm,
    )


def decode_access_token(token: str) -> str:
    secret_key, algorithm, _ = _jwt_settings()
    payload = jwt.decode(
        token,
        secret_key,
        algorithms=[algorithm],
        options={"require": ["exp", "sub"]},
    )
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.isdecimal():
        raise jwt.InvalidTokenError("Invalid token subject")
    return subject
