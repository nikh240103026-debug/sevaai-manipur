from datetime import datetime, timezone
from io import BytesIO
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import require_authenticated_user
from app.api.routes.data import _imported_row_analytics
from app.db.database import get_db
from app.main import app
from app.models.data_upload import DataUpload, ImportedDataRow
from app.models.user import User, UserRole


class FakeScalars:
    def __init__(self, values: list[Any]):
        self.values = values

    def all(self) -> list[Any]:
        return self.values


class FakeImportSession:
    def __init__(self):
        self.uploads: list[DataUpload] = []
        self.rows: list[ImportedDataRow] = []
        self.fail = False
        self.last_statement = ""

    def add(self, record: DataUpload | ImportedDataRow) -> None:
        if isinstance(record, DataUpload):
            self.uploads.append(record)
        else:
            self.rows.append(record)

    def flush(self) -> None:
        self._check()

    def commit(self) -> None:
        self._check()

    def rollback(self) -> None:
        return None

    def refresh(self, upload: DataUpload) -> None:
        upload.created_at = datetime.now(timezone.utc)

    def get(self, model: Any, identifier: UUID) -> Any | None:
        self._check()
        if model is DataUpload:
            return next(
                (upload for upload in self.uploads if upload.id == identifier),
                None,
            )
        return None

    def scalars(self, statement: Any) -> FakeScalars:
        self._check(statement)
        model = statement.column_descriptions[0].get("entity")
        if model is DataUpload:
            return FakeScalars(self.uploads)
        if model is ImportedDataRow:
            return FakeScalars(self.rows)
        raise AssertionError(f"Unexpected query entity: {model}")

    def scalar(self, statement: Any) -> int:
        self._check(statement)
        return len(self.rows)

    def _check(self, statement: Any | None = None) -> None:
        if statement is not None:
            self.last_statement = str(statement)
        if self.fail:
            raise SQLAlchemyError("simulated database error")


@pytest.fixture
def import_client() -> Any:
    session = FakeImportSession()
    user = User(
        id=1,
        username="state-admin",
        password_hash="not-used",
        full_name="Test State Admin",
        role=UserRole.STATE_ADMIN,
        district=None,
        block=None,
        is_active=True,
    )

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_authenticated_user] = lambda: user
    with TestClient(app) as client:
        yield client, session
    app.dependency_overrides.clear()


def upload_csv(
    client: TestClient,
    content: bytes,
    filename: str = "government.csv",
):
    return client.post(
        "/api/v1/data/upload",
        files={"file": (filename, content, "text/csv")},
    )


def test_valid_csv_is_normalized_and_stored(import_client: Any) -> None:
    client, session = import_client
    content = (
        b"Village Name,District Name,Block Name,Population,Households,"
        b"Housing Eligible,Housing Covered\n"
        b"Village One,Bishnupur,Bishnupur,120,30,20,15\n"
    )

    response = upload_csv(client, content)

    assert response.status_code == 201
    result = response.json()
    assert result["status"] == "COMPLETED"
    assert result["filename"] == "government.csv"
    assert result["file_type"] == "CSV"
    assert result["row_count"] == 1
    assert result["valid_rows"] == 1
    assert result["rejected_rows"] == 0
    assert result["mapped_columns"]["village"] == "Village Name"
    assert result["mapped_columns"]["district"] == "District Name"
    assert result["mapped_columns"]["housing_covered"] == "Housing Covered"
    assert result["unmapped_columns"] == []
    assert len(session.uploads) == 1
    assert len(session.rows) == 1
    assert session.rows[0].normalized_data == {
        "village": "Village One",
        "district": "Bishnupur",
        "block": "Bishnupur",
        "population": 120,
        "households": 30,
        "housing_eligible": 20,
        "housing_covered": 15,
        "housing_coverage": 75.0,
    }


def test_valid_xlsx_uses_first_nonempty_worksheet(import_client: Any) -> None:
    import pandas as pd

    client, session = import_client
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame().to_excel(writer, sheet_name="Cover", index=False)
        pd.DataFrame(
            [{"Village": "Village Excel", "District": "Bishnupur"}]
        ).to_excel(writer, sheet_name="Village Data", index=False)

    response = client.post(
        "/api/v1/data/upload",
        files={
            "file": (
                "manipur.xlsx",
                output.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 201
    assert response.json()["file_type"] == "XLSX"
    assert response.json()["valid_rows"] == 1
    assert session.rows[0].normalized_data["village"] == "Village Excel"


def test_pdf_table_is_extracted_without_ocr(
    import_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session = import_client

    class Page:
        def extract_tables(self) -> list[list[list[str]]]:
            return [[["Village", "District"], ["Village PDF", "Bishnupur"]]]

    class PdfDocument:
        pages = [Page()]

        def __enter__(self) -> "PdfDocument":
            return self

        def __exit__(
            self,
            exc_type: Any,
            _exc_value: Any,
            _traceback: Any,
        ) -> bool:
            return bool(exc_type) and False

    def open_pdf(source: BytesIO) -> PdfDocument:
        assert source.getvalue().startswith(b"%PDF-")
        return PdfDocument()

    monkeypatch.setattr("app.services.data_import.pdfplumber.open", open_pdf)

    response = client.post(
        "/api/v1/data/upload",
        files={"file": ("report.pdf", b"%PDF-1.4 placeholder", "application/pdf")},
    )

    assert response.status_code == 201
    assert response.json()["file_type"] == "PDF"
    assert session.rows[0].normalized_data["village"] == "Village PDF"


def test_pdf_without_extractable_table_returns_structured_table_message(
    import_client: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = import_client

    class Page:
        def extract_tables(self) -> list[list[list[str]]]:
            return []

    class PdfDocument:
        pages = [Page()]

        def __enter__(self) -> "PdfDocument":
            return self

        def __exit__(
            self,
            exc_type: Any,
            _exc_value: Any,
            _traceback: Any,
        ) -> bool:
            return bool(exc_type) and False

    monkeypatch.setattr(
        "app.services.data_import.pdfplumber.open",
        lambda source: PdfDocument() if source.getvalue() else None,
    )

    response = client.post(
        "/api/v1/data/upload",
        files={"file": ("scan.pdf", b"%PDF-1.4 placeholder", "application/pdf")},
    )

    assert response.status_code == 422
    assert "Structured table extraction required" in response.json()["detail"]


def test_unsupported_file_is_rejected(import_client: Any) -> None:
    client, session = import_client

    response = client.post(
        "/api/v1/data/upload",
        files={"file": ("program.exe", b"not executable", "application/octet-stream")},
    )

    assert response.status_code == 415
    assert "Only CSV, XLSX, and PDF" in response.json()["detail"]
    assert session.uploads == []


def test_empty_file_is_rejected(import_client: Any) -> None:
    client, _ = import_client

    response = upload_csv(client, b"")

    assert response.status_code == 422
    assert response.json()["detail"] == "Uploaded file is empty"


def test_malformed_csv_is_rejected(import_client: Any) -> None:
    client, session = import_client

    response = upload_csv(client, b"Village,District\nVillage One,Bishnupur,extra\n")

    assert response.status_code == 422
    assert "inconsistent column counts" in response.json()["detail"]
    assert session.uploads == []


def test_missing_geographic_information_is_reported_and_row_rejected(
    import_client: Any,
) -> None:
    client, session = import_client

    response = upload_csv(client, b"Village,Population\nVillage One,10\n")

    assert response.status_code == 201
    result = response.json()
    assert result["status"] == "FAILED"
    assert result["valid_rows"] == 0
    assert result["rejected_rows"] == 1
    assert any("district" in error for error in result["validation_errors"])
    assert session.rows == []
    assert len(session.uploads) == 1


def test_partial_mapping_and_unmapped_column_are_reported(
    import_client: Any,
) -> None:
    client, _ = import_client

    response = upload_csv(
        client,
        b"Village,District,Unrecognized Metric\nVillage One,Bishnupur,123\n",
    )

    assert response.status_code == 201
    result = response.json()
    assert result["valid_rows"] == 1
    assert result["mapped_columns"] == {
        "village": "Village",
        "district": "District",
    }
    assert result["unmapped_columns"] == ["Unrecognized Metric"]
    assert any("analytics inputs are unavailable" in warning for warning in result["warnings"])


def test_complete_import_can_reuse_existing_analytics_service() -> None:
    normalized_data: dict[str, object] = {
        "village_id": "MAN-BIS-01-001",
        "village": "Village One",
        "district": "Bishnupur",
        "block": "Bishnupur",
        "pending_rate": 10.0,
    }
    for service in ("housing", "health", "water", "welfare"):
        normalized_data[f"{service}_coverage"] = 80.0
        normalized_data[f"historical_{service}_coverage"] = 82.0

    result = _imported_row_analytics(normalized_data)

    assert result is not None
    assert result.village_id == "MAN-BIS-01-001"
    assert result.priority_score >= 0


def test_upload_history_detail_and_normalized_rows(import_client: Any) -> None:
    client, _ = import_client
    response = upload_csv(
        client,
        b"Village,District\nVillage One,Bishnupur\n",
        filename=r"..\untrusted\report.csv",
    )
    upload_id = response.json()["upload_id"]

    history = client.get("/api/v1/data/uploads")
    detail = client.get(f"/api/v1/data/uploads/{upload_id}")
    rows = client.get(f"/api/v1/data/uploads/{upload_id}/rows")

    assert history.status_code == 200
    assert history.json()[0]["upload_id"] == upload_id
    assert detail.status_code == 200
    assert detail.json()["filename"] == "report.csv"
    assert rows.status_code == 200
    assert rows.json()["items"][0]["normalized_data"] == {
        "village": "Village One",
        "district": "Bishnupur",
    }


def test_upload_endpoints_require_authentication(import_client: Any) -> None:
    client, _ = import_client
    app.dependency_overrides.pop(require_authenticated_user)

    assert client.get("/api/v1/data/uploads").status_code == 401
    assert client.post(
        "/api/v1/data/upload",
        files={"file": ("data.csv", b"Village,District\nOne,Two\n", "text/csv")},
    ).status_code == 401


def test_block_officer_cannot_import_rows_outside_assigned_block(
    import_client: Any,
) -> None:
    client, session = import_client
    app.dependency_overrides[require_authenticated_user] = lambda: User(
        id=2,
        username="block-officer",
        password_hash="not-used",
        full_name="Test Block Officer",
        role=UserRole.BLOCK_OFFICER,
        district="Bishnupur",
        block="Nambol",
        is_active=True,
    )

    response = upload_csv(
        client,
        b"Village,District,Block\nVillage One,Bishnupur,Bishnupur\n",
    )

    assert response.status_code == 201
    assert response.json()["status"] == "FAILED"
    assert response.json()["valid_rows"] == 0
    assert any("outside the uploader's permitted scope" in error for error in response.json()["validation_errors"])
    assert session.uploads[0].scope_district == "Bishnupur"
    assert session.uploads[0].scope_block == "Nambol"
    assert session.rows == []


def test_upload_database_failure_returns_service_unavailable(
    import_client: Any,
) -> None:
    client, session = import_client
    session.fail = True

    response = upload_csv(client, b"Village,District\nVillage One,Bishnupur\n")

    assert response.status_code == 503
    assert response.json()["detail"] == "Data import storage is unavailable"
