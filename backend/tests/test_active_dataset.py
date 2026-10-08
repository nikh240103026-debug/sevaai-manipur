from datetime import date, datetime, timezone
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import require_authenticated_user
from app.db.database import get_db
from app.main import app
from app.models.data_upload import DataUpload, ImportedDataRow
from app.models.user import User, UserRole
from app.models.village import Village
from app.services.dataset import get_active_dataset


class ScalarResult:
    def __init__(self, values: list[Any]):
        self.values = values

    def all(self) -> list[Any]:
        return self.values


def make_upload(
    *,
    status: str = "COMPLETED",
    district: str | None = None,
    block: str | None = None,
    created_at: datetime | None = None,
    upload_id: UUID | None = None,
) -> DataUpload:
    return DataUpload(
        id=upload_id or uuid4(),
        created_by=1,
        scope_district=district,
        scope_block=block,
        dataset_type="GOVERNMENT_UPLOAD",
        filename="government.csv",
        file_type="CSV",
        status=status,
        row_count=1,
        valid_rows=1,
        rejected_rows=0,
        detected_columns=["Village", "District"],
        mapped_columns={"village": "Village", "district": "District"},
        unmapped_columns=[],
        validation_errors=[],
        warnings=[],
        created_at=created_at or datetime.now(timezone.utc),
    )


def complete_record(
    name: str,
    *,
    district: str = "Bishnupur",
    block: str = "Bishnupur",
    population: int = 100,
    latitude: float | None = 24.6,
    longitude: float | None = 93.9,
    coverage: float = 80,
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "village": name,
        "district": district,
        "block": block,
        "population": population,
        "pending_cases": 5,
        "pending_rate": 10.0,
        "latitude": latitude,
        "longitude": longitude,
        "data_date": date(2026, 1, 1).isoformat(),
    }
    for service in ("housing", "health", "water", "welfare"):
        record[f"{service}_coverage"] = coverage
        record[f"historical_{service}_coverage"] = coverage + 2
    return record


def make_row(upload: DataUpload, row_number: int, values: dict[str, Any]) -> ImportedDataRow:
    return ImportedDataRow(
        id=row_number,
        upload_id=upload.id,
        row_number=row_number,
        district=str(values["district"]),
        block=values.get("block"),
        normalized_data=values,
    )


class DatasetSession:
    def __init__(
        self,
        uploads: list[DataUpload] | None = None,
        rows: list[ImportedDataRow] | None = None,
        synthetic: list[Any] | None = None,
    ):
        self.uploads = uploads or []
        self.rows = rows or []
        self.synthetic = synthetic or []

    def scalars(self, statement: Any) -> ScalarResult:
        entity = statement.column_descriptions[0].get("entity")
        if entity is DataUpload:
            candidates = [
                upload for upload in self.uploads
                if upload.status in {"COMPLETED", "PARTIAL"} and upload.valid_rows > 0
            ]
            return ScalarResult(sorted(
                candidates,
                key=lambda upload: (upload.created_at, str(upload.id)),
                reverse=True,
            ))
        if entity is ImportedDataRow:
            upload_id = statement.compile().params.get("upload_id_1")
            return ScalarResult([
                row for row in self.rows if row.upload_id == upload_id
            ])
        if entity is Village:
            return ScalarResult(self.synthetic)
        raise AssertionError(f"Unexpected query entity: {entity}")

    def get(self, model: Any, identifier: str) -> Any | None:
        if model is Village:
            return next(
                (village for village in self.synthetic if village.village_id == identifier),
                None,
            )
        return None


def make_user(
    role: UserRole = UserRole.STATE_ADMIN,
    district: str | None = None,
    block: str | None = None,
) -> User:
    return User(
        id=1,
        username="dataset-test-user",
        password_hash="unused",
        full_name="Dataset Test User",
        role=role,
        district=district,
        block=block,
        is_active=True,
    )


def test_no_usable_upload_uses_synthetic_villages() -> None:
    synthetic = SimpleNamespace(
        village_id="SYN-001",
        village="Synthetic One",
        district="Bishnupur",
        block="Bishnupur",
    )
    dataset = get_active_dataset(DatasetSession(synthetic=[synthetic]), make_user())

    assert dataset.mode == "DEMO_DATA"
    assert [village.village_id for village in dataset.villages] == ["SYN-001"]


def test_completed_upload_becomes_active_and_failed_upload_does_not() -> None:
    completed = make_upload(
        status="COMPLETED",
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    failed = make_upload(
        status="FAILED",
        created_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
    )
    rows = [make_row(completed, 2, complete_record("Uploaded Village"))]
    dataset = get_active_dataset(
        DatasetSession(uploads=[completed, failed], rows=rows),
        make_user(),
    )

    assert dataset.mode == "GOVERNMENT_UPLOAD"
    assert dataset.upload is completed
    assert dataset.villages[0].village == "Uploaded Village"


def test_failed_upload_alone_keeps_synthetic_dataset_active() -> None:
    failed = make_upload(status="FAILED")
    synthetic = SimpleNamespace(
        village_id="SYN-001",
        village="Synthetic One",
        district="Bishnupur",
        block="Bishnupur",
    )

    dataset = get_active_dataset(
        DatasetSession(
            uploads=[failed],
            rows=[make_row(failed, 2, complete_record("Rejected Dataset"))],
            synthetic=[synthetic],
        ),
        make_user(),
    )

    assert dataset.mode == "DEMO_DATA"
    assert [village.village_id for village in dataset.villages] == ["SYN-001"]


def test_partial_upload_with_valid_rows_is_usable() -> None:
    partial = make_upload(status="PARTIAL")
    dataset = get_active_dataset(
        DatasetSession(
            uploads=[partial],
            rows=[make_row(partial, 2, complete_record("Valid Partial Row"))],
        ),
        make_user(),
    )

    assert dataset.mode == "GOVERNMENT_UPLOAD"
    assert dataset.villages[0].village == "Valid Partial Row"


def test_upload_selection_respects_district_and_block_scope() -> None:
    bishnupur_upload = make_upload(
        district="Bishnupur",
        block="Nambol",
    )
    tamenglong_upload = make_upload(
        district="Tamenglong",
        block="Tamei",
        created_at=datetime(2027, 1, 1, tzinfo=timezone.utc),
    )
    session = DatasetSession(
        uploads=[bishnupur_upload, tamenglong_upload],
        rows=[
            make_row(
                bishnupur_upload,
                2,
                complete_record("Allowed", district="Bishnupur", block="Nambol"),
            ),
            make_row(
                tamenglong_upload,
                2,
                complete_record("Not Allowed", district="Tamenglong", block="Tamei"),
            ),
        ],
    )

    district_data = get_active_dataset(
        session,
        make_user(UserRole.DISTRICT_OFFICER, "Bishnupur"),
    )
    block_data = get_active_dataset(
        session,
        make_user(UserRole.BLOCK_OFFICER, "Bishnupur", "Nambol"),
    )

    assert [village.village for village in district_data.villages] == ["Allowed"]
    assert [village.village for village in block_data.villages] == ["Allowed"]


@pytest.fixture
def active_client():
    user = make_user()
    uploaded = make_upload()
    rows = [
        make_row(uploaded, 2, complete_record("Uploaded One", population=100)),
        make_row(
            uploaded,
            3,
            complete_record(
                "Uploaded Two",
                population=150,
                coverage=65,
                latitude=None,
                longitude=None,
            ),
        ),
    ]
    session = DatasetSession(uploads=[uploaded], rows=rows)

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[require_authenticated_user] = lambda: user
    with TestClient(app) as client:
        yield client, uploaded, session
    app.dependency_overrides.clear()


def test_dashboard_villages_map_analytics_and_anomalies_use_active_upload(
    active_client: Any,
) -> None:
    client, upload, _ = active_client

    dashboard = client.get("/api/v1/dashboard/summary").json()
    villages = client.get("/api/v1/villages").json()
    map_points = client.get("/api/v1/map/villages").json()
    village_id = villages["items"][0]["village_id"]
    analytics = client.get(f"/api/v1/analytics/villages/{village_id}").json()
    anomalies = client.get("/api/v1/ai/anomalies?limit=100").json()
    active = client.get("/api/v1/data/active").json()

    assert dashboard["total_villages"] == 2
    assert dashboard["total_population"] == 250
    assert dashboard["service_coverage"]["housing"] == 72.5
    assert villages["items"][0]["village"] == "Uploaded One"
    assert villages["items"][0]["village_id"].startswith(f"{upload.id}:")
    assert len(map_points) == 1
    assert map_points[0]["village"] == "Uploaded One"
    assert analytics["available"] is True
    assert analytics["priority_score"] is not None
    assert len(anomalies) == 2
    assert all(item["available"] for item in anomalies)
    assert active["mode"] == "GOVERNMENT_UPLOAD"
    assert active["upload_id"] == str(upload.id)
    assert active["map_available"] is True


def test_missing_analytical_fields_return_unavailable_without_fabricated_metrics(
    active_client: Any,
) -> None:
    client, upload, session = active_client
    upload.filename = "minimal.csv"
    upload.valid_rows = 1
    upload.row_count = 1
    minimal_row = make_row(
        upload,
        2,
        {
            "village": "Minimal Village",
            "district": "Bishnupur",
            "housing_coverage": 20,
            "health_coverage": 80,
            "latitude": 24.6,
            "longitude": 93.9,
        },
    )
    session.rows = [minimal_row]

    dashboard = client.get("/api/v1/dashboard/summary").json()
    village = client.get("/api/v1/villages").json()["items"][0]
    village_id = village["village_id"]
    analytics = client.get(f"/api/v1/analytics/villages/{village_id}").json()
    anomalies = client.get("/api/v1/ai/anomalies?limit=100").json()
    map_points = client.get("/api/v1/map/villages").json()
    active = client.get("/api/v1/data/active").json()

    assert dashboard["service_coverage"]["housing"] == 20
    assert dashboard["total_population"] is None
    assert dashboard["analytics_available"] is False
    assert village["housing_coverage"] == 20
    assert village["latitude"] == 24.6
    assert village["major_service_gap"] == "Housing"
    assert analytics["available"] is False
    assert analytics["priority_score"] is None
    assert anomalies[0]["anomaly_status"] == "UNAVAILABLE"
    assert len(map_points) == 1
    assert map_points[0]["major_service_gap"] == "Housing"
    assert map_points[0]["priority_score"] is None
    assert active["map_available"] is True


def test_active_upload_with_one_complete_record_has_unavailable_anomaly_results(
    active_client: Any,
) -> None:
    client, _, session = active_client
    session.rows = [session.rows[0]]

    anomalies = client.get("/api/v1/ai/anomalies?limit=100").json()
    active = client.get("/api/v1/data/active").json()

    assert len(anomalies) == 1
    assert anomalies[0]["anomaly_status"] == "UNAVAILABLE"
    assert anomalies[0]["available"] is False
    assert active["anomalies_available"] is False


def test_active_endpoint_and_analytics_are_authenticated(active_client: Any) -> None:
    client, _, _ = active_client
    app.dependency_overrides.pop(require_authenticated_user)

    assert client.get("/api/v1/data/active").status_code == 401
    assert client.get("/api/v1/analytics/villages/not-visible").status_code == 401
