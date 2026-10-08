from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.routes import auth as auth_routes
from app.core.security import hash_password, hash_session_token
from app.db.database import get_db
from app.main import app
from app.models.auth import AuthSession, AuthUser


class FakeAuthSession:
    def __init__(self) -> None:
        self.user = AuthUser(
            user_id="admin01",
            password_hash=hash_password("auth-test-password"),
            is_active=True,
        )
        self.sessions: dict[str, AuthSession] = {}

    def get(self, model: Any, identity: str) -> Any:
        if model is AuthUser:
            return self.user if identity == self.user.user_id else None
        if model is AuthSession:
            return self.sessions.get(identity)
        raise AssertionError(f"Unexpected model: {model}")

    def add(self, value: AuthSession) -> None:
        self.sessions[value.token_hash] = value

    def commit(self) -> None:
        pass

    def delete(self, value: AuthSession) -> None:
        self.sessions.pop(value.token_hash, None)

    def close(self) -> None:
        pass


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Any:
    session = FakeAuthSession()

    def override_get_db():
        yield session

    monkeypatch.setattr(
        auth_routes,
        "get_settings",
        lambda: type("Settings", (), {"auth_cookie_secure": False})(),
    )
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, session
    app.dependency_overrides.clear()


def test_login_and_authenticated_session(client: Any) -> None:
    test_client, session = client
    response = test_client.post(
        "/api/v1/auth/login",
        json={"user_id": "ADMIN01", "password": "auth-test-password"},
    )

    assert response.status_code == 200
    assert response.json() == {"user_id": "admin01"}
    assert "httponly" in response.headers["set-cookie"].lower()
    assert "auth-test-password" not in response.text
    assert len(session.sessions) == 1

    current_user = test_client.get("/api/v1/auth/me")
    assert current_user.status_code == 200
    assert current_user.json() == {"user_id": "admin01"}


def test_login_rejects_invalid_credentials(client: Any) -> None:
    test_client, _ = client
    response = test_client.post(
        "/api/v1/auth/login",
        json={"user_id": "admin01", "password": "incorrect"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid user ID or password"


def test_current_user_requires_a_valid_session(client: Any) -> None:
    test_client, _ = client
    response = test_client.get("/api/v1/auth/me")
    assert response.status_code == 401

    test_client.cookies.set("sevaai_session", "not-a-real-session")
    response = test_client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_logout_revokes_session(client: Any) -> None:
    test_client, session = client
    login_response = test_client.post(
        "/api/v1/auth/login",
        json={"user_id": "admin01", "password": "auth-test-password"},
    )
    raw_token = login_response.cookies["sevaai_session"]
    assert hash_session_token(raw_token) in session.sessions

    logout_response = test_client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204
    assert not session.sessions
    assert test_client.get("/api/v1/auth/me").status_code == 401


def test_expired_session_is_revoked(client: Any) -> None:
    test_client, session = client
    expired = AuthSession(
        token_hash=hash_session_token("expired-token"),
        user_id="admin01",
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    session.add(expired)
    test_client.cookies.set("sevaai_session", "expired-token")

    response = test_client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert expired.token_hash not in session.sessions


def test_login_schema_rejects_invalid_user_id(client: Any) -> None:
    test_client, _ = client
    response = test_client.post(
        "/api/v1/auth/login",
        json={"user_id": "admin id", "password": "auth-test-password"},
    )
    assert response.status_code == 422


def test_password_hash_does_not_store_plaintext() -> None:
    password = "auth-test-password"
    stored_hash = hash_password(password)

    assert password not in stored_hash
    assert "$" in stored_hash
