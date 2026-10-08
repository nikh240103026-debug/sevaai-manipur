from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, cast

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Table
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import (
    authorize_block_access,
    authorize_district_access,
    get_db,
    require_authenticated_user,
    require_roles,
    village_scope_filters,
)
from app.main import app
from app.models.user import User, UserRole
from app.models.village import Village
from app.core.security import create_access_token, hash_password

TEST_PASSWORD = "local-test-password-not-a-secret"
TEST_PASSWORD_HASH = hash_password(TEST_PASSWORD)


def make_user(
    *,
    role: UserRole = UserRole.STATE_ADMIN,
    district: str | None = None,
    block: str | None = None,
    active: bool = True,
    username: str = "operator",
    user_id: int = 7,
) -> User:
    return User(
        id=user_id,
        username=username,
        password_hash=TEST_PASSWORD_HASH,
        full_name="Test Operator",
        role=role,
        district=district,
        block=block,
        is_active=active,
    )


def make_village() -> SimpleNamespace:
    values: dict[str, Any] = {
        "village_id": "MAN-BIS-01-001",
        "state": "Manipur",
        "district": "Bishnupur",
        "block": "Bishnupur",
        "gram_panchayat": "Bishnupur Local Council Group 01",
        "village": "Bishnupur Demo Village 001",
        "population": 371,
        "households": 61,
        "eligible_households": 48,
        "pending_cases": 5,
        "pending_rate": Decimal("10.42"),
        "latitude": 24.560263,
        "longitude": 93.867276,
        "data_date": date(2025, 3, 31),
    }
    for service in ("housing", "health", "water", "welfare"):
        values[f"{service}_eligible"] = 40
        values[f"{service}_covered"] = 35
        values[f"{service}_coverage"] = Decimal("87.50")
        values[f"historical_{service}_coverage"] = Decimal("85.00")
    return SimpleNamespace(**values)


class FakeScalars:
    def __init__(self, values: list[Any]):
        self.values = values

    def first(self) -> Any | None:
        return self.values[0] if self.values else None

    def all(self) -> list[Any]:
        return self.values


class AuthSession:
    def __init__(self, user: User | None = None):
        self.user = user
        self.village = make_village()
        self.fail = False
        self.statements: list[str] = []

    def scalars(self, statement: Any) -> FakeScalars:
        self._check(statement)
        model = statement.column_descriptions[0].get("entity")
        if model is Village:
            return FakeScalars([self.village])
        params = statement.compile().params
        searched_username = next(iter(params.values()), None)
        if self.user and self.user.username == searched_username:
            return FakeScalars([self.user])
        return FakeScalars([])

    def scalar(self, statement: Any) -> int:
        self._check(statement)
        return 1

    def get(self, model: Any, identifier: Any) -> Any | None:
        self._check(f"get {model.__name__}")
        if model is User and self.user and identifier == self.user.id:
            return self.user
        if model is Village and identifier == self.village.village_id:
            return self.village
        return None

    def execute(self, statement: Any) -> Any:
        self._check(statement)
        return SimpleNamespace(all=lambda: [])

    def _check(self, statement: Any) -> None:
        self.statements.append(str(statement))
        if self.fail:
            raise SQLAlchemyError("simulated database failure")


@pytest.fixture
def auth_client(monkeypatch: pytest.MonkeyPatch) -> Any:
    import app.core.security as security

    user = make_user()
    session = AuthSession(user)
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: SimpleNamespace(
            jwt_secret_key=SecretStr("t" * 48),
            jwt_algorithm="HS256",
            access_token_expire_minutes=30,
        ),
    )

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, session, user
    app.dependency_overrides.clear()


def login(client: TestClient, username: str = "operator", password: str = TEST_PASSWORD):
    return client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )


def test_valid_login_returns_bearer_token_without_user_secrets(auth_client: Any) -> None:
    client, _, user = auth_client

    response = login(client)

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["expires_in"] == 1800
    assert "password_hash" not in response.json()
    assert create_access_token(str(user.id))


def test_login_rejects_unknown_username_and_invalid_password(auth_client: Any) -> None:
    client, _, _ = auth_client

    assert login(client, username="unknown").status_code == 401
    assert login(client, password="incorrect-password").status_code == 401


def test_login_rejects_inactive_user(auth_client: Any) -> None:
    client, session, _ = auth_client
    session.user = make_user(active=False)

    response = login(client)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_valid_jwt_and_auth_me(auth_client: Any) -> None:
    client, _, user = auth_client
    token = create_access_token(str(user.id))

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": UserRole.STATE_ADMIN.value,
        "district": None,
        "block": None,
        "is_active": True,
    }
    assert "password_hash" not in response.json()


@pytest.mark.parametrize(
    "token_factory",
    [
        lambda: "not.a.valid.token",
        lambda: create_access_token("7", expires_minutes=-1),
        lambda: jwt.encode(
            {"sub": "not-an-integer", "exp": 4_102_444_800},
            "t" * 48,
            algorithm="HS256",
        ),
    ],
    ids=["invalid", "expired", "invalid-subject"],
)
def test_invalid_or_expired_jwt_is_rejected(
    auth_client: Any,
    token_factory: Any,
) -> None:
    client, _, _ = auth_client

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_factory()}"},
    )

    assert response.status_code == 401


def test_unauthenticated_access_is_denied(auth_client: Any) -> None:
    client, _, _ = auth_client

    for path in (
        "/api/v1/villages",
        "/api/v1/districts",
        "/api/v1/map/villages",
        "/api/v1/analytics/villages/MAN-BIS-01-001",
        "/api/v1/ai/anomalies",
    ):
        assert client.get(path).status_code == 401


def test_state_admin_has_unrestricted_scope(auth_client: Any) -> None:
    client, _, _ = auth_client
    app.dependency_overrides[require_authenticated_user] = lambda: make_user()

    response = client.get("/api/v1/villages/MAN-BIS-01-001")

    assert response.status_code == 200
    admin = make_user()
    authorize_district_access(admin, "Tamenglong")
    authorize_block_access(admin, "Tamenglong", "Tamenglong")
    assert village_scope_filters(admin, block="Tamenglong")


def test_district_officer_is_limited_to_assigned_district(auth_client: Any) -> None:
    client, session, _ = auth_client
    officer = make_user(role=UserRole.DISTRICT_OFFICER, district="Bishnupur")
    app.dependency_overrides[require_authenticated_user] = lambda: officer

    assert client.get("/api/v1/villages/MAN-BIS-01-001").status_code == 200
    assert client.get("/api/v1/villages?limit=10").status_code == 200
    assert any("lower(villages.district)" in sql for sql in session.statements)
    assert client.get("/api/v1/villages?district=Tamenglong").status_code == 403
    assert client.get("/api/v1/analytics/villages/MAN-BIS-01-001").status_code == 200


def test_block_officer_is_limited_to_assigned_block(auth_client: Any) -> None:
    client, session, _ = auth_client
    officer = make_user(
        role=UserRole.BLOCK_OFFICER,
        district="Bishnupur",
        block="Bishnupur",
    )
    app.dependency_overrides[require_authenticated_user] = lambda: officer

    assert client.get("/api/v1/villages/MAN-BIS-01-001").status_code == 200
    assert client.get("/api/v1/villages?limit=10").status_code == 200
    assert any("lower(villages.block)" in sql for sql in session.statements)
    session.village.block = "Another Block"
    assert client.get("/api/v1/villages/MAN-BIS-01-001").status_code == 403
    assert client.get("/api/v1/villages?district=Tamenglong").status_code == 403
    assert client.get("/api/v1/ai/anomalies?district=Tamenglong").status_code == 403


def test_role_dependency_and_cross_scope_helpers() -> None:
    admin_dependency = require_roles(UserRole.STATE_ADMIN)
    district_officer = make_user(
        role=UserRole.DISTRICT_OFFICER,
        district="Bishnupur",
    )

    with pytest.raises(Exception) as error:
        admin_dependency(current_user=district_officer)
    assert getattr(error.value, "status_code", None) == 403

    with pytest.raises(Exception) as district_error:
        authorize_district_access(district_officer, "Tamenglong")
    assert getattr(district_error.value, "status_code", None) == 403

    block_officer = make_user(
        role=UserRole.BLOCK_OFFICER,
        district="Bishnupur",
        block="Bishnupur",
    )
    with pytest.raises(Exception) as block_error:
        authorize_block_access(block_officer, "Bishnupur", "Another Block")
    assert getattr(block_error.value, "status_code", None) == 403


def test_authentication_database_failure_is_service_unavailable(auth_client: Any) -> None:
    client, session, _ = auth_client
    session.fail = True

    response = login(client)

    assert response.status_code == 503
    assert response.json()["detail"] == "Authentication service is unavailable"


def test_role_constraint_and_user_table_indexes() -> None:
    user_table = cast(Table, User.__table__)
    assert user_table.name == "users"
    assert "users_role_valid" in {
        constraint.name for constraint in user_table.constraints
    }
    assert "users_role_scope_valid" in {
        constraint.name for constraint in user_table.constraints
    }
    indexes = {index.name for index in user_table.indexes}
    assert {
        "ix_users_username",
        "users_role_idx",
        "users_district_idx",
        "users_block_idx",
    }.issubset(indexes)
