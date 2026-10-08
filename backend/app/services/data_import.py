import csv
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from io import BytesIO, StringIO
from typing import Any
from zipfile import BadZipFile, ZipFile

import pandas as pd
import pdfplumber
from openpyxl.utils.exceptions import InvalidFileException
from pdfminer.pdfexceptions import PDFException

from app.models.user import User, UserRole

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_XLSX_EXPANDED_BYTES = 100 * 1024 * 1024
MAX_TABULAR_ROWS = 100_000
MAX_REPORTED_ERRORS = 1000
MAX_COLUMN_NAME_LENGTH = 255

NORMALIZED_FIELDS = (
    "village_id",
    "state",
    "district",
    "block",
    "gram_panchayat",
    "village",
    "population",
    "households",
    "eligible_households",
    "housing_eligible",
    "housing_covered",
    "housing_coverage",
    "health_eligible",
    "health_covered",
    "health_coverage",
    "water_eligible",
    "water_covered",
    "water_coverage",
    "welfare_eligible",
    "welfare_covered",
    "welfare_coverage",
    "pending_cases",
    "pending_rate",
    "historical_housing_coverage",
    "historical_health_coverage",
    "historical_water_coverage",
    "historical_welfare_coverage",
    "latitude",
    "longitude",
    "data_date",
)

TEXT_FIELDS = {
    "village_id",
    "state",
    "district",
    "block",
    "gram_panchayat",
    "village",
}
INTEGER_FIELDS = {
    "population",
    "households",
    "eligible_households",
    "housing_eligible",
    "housing_covered",
    "health_eligible",
    "health_covered",
    "water_eligible",
    "water_covered",
    "welfare_eligible",
    "welfare_covered",
    "pending_cases",
}
PERCENTAGE_FIELDS = {
    "housing_coverage",
    "health_coverage",
    "water_coverage",
    "welfare_coverage",
    "pending_rate",
    "historical_housing_coverage",
    "historical_health_coverage",
    "historical_water_coverage",
    "historical_welfare_coverage",
}

ALIASES: dict[str, tuple[str, ...]] = {
    "village_id": ("villageid", "villagecode", "villageidentifier"),
    "state": ("state", "statename"),
    "district": ("district", "districtname"),
    "block": ("block", "blockname", "subdistrict"),
    "gram_panchayat": ("grampanchayat", "panchayat", "localbody"),
    "village": ("village", "villagename", "name"),
    "population": ("population", "totalpopulation"),
    "households": ("households", "totalhouseholds", "householdcount"),
    "eligible_households": (
        "eligiblehouseholds",
        "totaleligiblehouseholds",
        "eligiblefamilies",
    ),
    "housing_eligible": ("housingeligible", "housingtarget", "housingeligibleunits"),
    "housing_covered": ("housingcovered", "housingcompleted", "housingbeneficiaries"),
    "housing_coverage": ("housingcoverage", "housingcoveragepercent"),
    "health_eligible": ("healtheligible", "healthtarget", "healtheligibleunits"),
    "health_covered": ("healthcovered", "healthbeneficiaries"),
    "health_coverage": ("healthcoverage", "healthcoveragepercent"),
    "water_eligible": ("watereligible", "watertarget", "watereligibleunits"),
    "water_covered": ("watercovered", "waterbeneficiaries"),
    "water_coverage": ("watercoverage", "watercoveragepercent"),
    "welfare_eligible": ("welfareeligible", "welfaretarget"),
    "welfare_covered": ("welfarecovered", "welfarebeneficiaries"),
    "welfare_coverage": ("welfarecoverage", "welfarecoveragepercent"),
    "pending_cases": ("pendingcases", "pendingapplications", "pending"),
    "pending_rate": ("pendingrate", "pendingpercent"),
    "historical_housing_coverage": (
        "historicalhousingcoverage",
        "previoushousingcoverage",
    ),
    "historical_health_coverage": (
        "historicalhealthcoverage",
        "previoushealthcoverage",
    ),
    "historical_water_coverage": (
        "historicalwatercoverage",
        "previouswatercoverage",
    ),
    "historical_welfare_coverage": (
        "historicalwelfarecoverage",
        "previouswelfarecoverage",
    ),
    "latitude": ("latitude", "lat"),
    "longitude": ("longitude", "lon", "lng"),
    "data_date": ("datadate", "reportdate", "asofdate"),
}

ALIAS_TO_FIELD = {
    re.sub(r"[^a-z0-9]", "", alias.casefold()): field
    for field, aliases in ALIASES.items()
    for alias in (field, *aliases)
}


class DataImportFileError(ValueError):
    """A supported upload could not be parsed as a structured table."""


@dataclass(frozen=True)
class ParsedTable:
    columns: list[str]
    records: list[dict[str, Any]]
    warnings: list[str]


@dataclass(frozen=True)
class NormalizedTable:
    parsed: ParsedTable
    mapped_columns: dict[str, str]
    unmapped_columns: list[str]
    valid_rows: list[tuple[int, dict[str, Any]]]
    validation_errors: list[str]
    warnings: list[str]


def sanitize_filename(filename: str | None, extension: str) -> str:
    supplied = (filename or "").replace("\\", "/").split("/")[-1]
    safe = "".join(
        character for character in supplied
        if character.isprintable() and character not in "/\\"
    ).strip()
    return (safe or f"uploaded-file{extension}")[:255]


def detect_file_type(filename: str | None) -> str:
    suffix = (filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    extension = suffix.rsplit(".", 1)[-1].casefold() if "." in suffix else ""
    supported_types = {"csv": "CSV", "xlsx": "XLSX", "pdf": "PDF"}
    if extension not in supported_types:
        raise DataImportFileError("Only CSV, XLSX, and PDF files are supported.")
    return supported_types[extension]


def _nonempty_rows(table: list[list[Any]]) -> list[list[Any]]:
    return [
        row
        for row in table
        if any(value is not None and str(value).strip() for value in row)
    ]


def _read_pdf(content: bytes) -> tuple[pd.DataFrame, list[str]]:
    try:
        with pdfplumber.open(BytesIO(content)) as document:
            headers: list[str] | None = None
            data_rows: list[list[Any]] = []
            skipped_tables = False
            for page in document.pages:
                for table in page.extract_tables():
                    rows = _nonempty_rows(table)
                    if not rows:
                        continue
                    candidate_headers = [
                        str(value).strip() if value is not None else ""
                        for value in rows[0]
                    ]
                    if headers is None:
                        if len(rows) < 2 or not any(candidate_headers):
                            continue
                        headers = candidate_headers
                        data_rows.extend(rows[1:])
                        continue
                    if candidate_headers == headers:
                        data_rows.extend(rows[1:])
                    else:
                        skipped_tables = True
                    if len(data_rows) > MAX_TABULAR_ROWS:
                        raise DataImportFileError(
                            f"Tables may contain no more than {MAX_TABULAR_ROWS} rows."
                        )
            if headers is not None and data_rows:
                warnings = (
                    [
                        "Additional PDF tables with different headers were skipped; "
                        "verify that all required pages use the same table structure."
                    ]
                    if skipped_tables
                    else []
                )
                return pd.DataFrame(data_rows, columns=headers), warnings
    except DataImportFileError:
        raise
    except (PDFException, ValueError, TypeError, OSError) as exc:
        raise DataImportFileError(
            "The PDF could not be parsed. Upload a readable PDF with a structured table."
        ) from exc
    raise DataImportFileError(
        "Structured table extraction required: no reliable table was found in this PDF."
    )


def read_tabular_file(content: bytes, file_type: str) -> ParsedTable:
    warnings: list[str] = []
    try:
        if file_type == "CSV":
            csv_text = content.decode("utf-8-sig")
            reader = csv.reader(StringIO(csv_text, newline=""), strict=True)
            expected_fields: int | None = None
            source_headers: list[str] | None = None
            for row in reader:
                if not row:
                    continue
                if expected_fields is None:
                    expected_fields = len(row)
                    source_headers = [column.strip().casefold() for column in row]
                    if any(not column for column in source_headers):
                        raise DataImportFileError(
                            "Every table column must have a non-empty header."
                        )
                    if len(set(source_headers)) != len(source_headers):
                        raise DataImportFileError(
                            "The table contains duplicate column headers."
                        )
                elif len(row) != expected_fields:
                    raise DataImportFileError(
                        "The CSV contains rows with inconsistent column counts."
                    )
            frame = pd.read_csv(
                StringIO(csv_text),
                dtype=object,
                on_bad_lines="error",
                nrows=MAX_TABULAR_ROWS + 1,
            )
        elif file_type == "XLSX":
            with ZipFile(BytesIO(content)) as archive:
                expanded_size = sum(member.file_size for member in archive.infolist())
                if expanded_size > MAX_XLSX_EXPANDED_BYTES:
                    raise DataImportFileError(
                        "The XLSX expands beyond the supported uncompressed size limit."
                    )
            with pd.ExcelFile(BytesIO(content), engine="openpyxl") as workbook:
                frame = pd.DataFrame()
                for sheet_name in workbook.sheet_names:
                    candidate = pd.read_excel(
                        workbook,
                        sheet_name=sheet_name,
                        dtype=object,
                        nrows=MAX_TABULAR_ROWS + 1,
                    )
                    if not candidate.dropna(how="all").empty:
                        frame = candidate
                        break
        elif file_type == "PDF":
            frame, warnings = _read_pdf(content)
        else:
            raise DataImportFileError("Unsupported file type.")
    except DataImportFileError:
        raise
    except (
        csv.Error,
        pd.errors.EmptyDataError,
        pd.errors.ParserError,
        UnicodeDecodeError,
        BadZipFile,
        InvalidFileException,
        KeyError,
        ValueError,
        OSError,
    ) as exc:
        raise DataImportFileError(
            "The uploaded file is malformed or does not contain a readable table."
        ) from exc

    if frame.empty or len(frame.columns) == 0:
        raise DataImportFileError("The uploaded file does not contain a tabular header and data.")
    if len(frame.index) > MAX_TABULAR_ROWS:
        raise DataImportFileError(
            f"Tables may contain no more than {MAX_TABULAR_ROWS} rows."
        )

    columns = [str(column).strip() for column in frame.columns]
    if any(
        not column or column.casefold().startswith("unnamed:")
        for column in columns
    ):
        raise DataImportFileError("Every table column must have a non-empty header.")
    if any(len(column) > MAX_COLUMN_NAME_LENGTH for column in columns):
        raise DataImportFileError(
            f"Column headers may not exceed {MAX_COLUMN_NAME_LENGTH} characters."
        )
    if len({column.casefold() for column in columns}) != len(columns):
        raise DataImportFileError("The table contains duplicate column headers.")

    frame.columns = columns
    frame = frame.dropna(how="all")
    if frame.empty:
        raise DataImportFileError("The uploaded table does not contain any data rows.")
    records = [
        {str(column): value for column, value in record.items()}
        for record in frame.to_dict(orient="records")
    ]
    return ParsedTable(columns=columns, records=records, warnings=warnings)


def map_columns(columns: list[str]) -> tuple[dict[str, str], list[str], list[str]]:
    mapped: dict[str, str] = {}
    unmapped: list[str] = []
    warnings: list[str] = []
    for source_column in columns:
        normalized_header = re.sub(r"[^a-z0-9]", "", source_column.casefold())
        field = ALIAS_TO_FIELD.get(normalized_header)
        if field is None:
            unmapped.append(source_column)
        elif field in mapped:
            unmapped.append(source_column)
            warnings.append(
                f"Multiple source columns match '{field}'; "
                f"'{mapped[field]}' was used and '{source_column}' was left unmapped."
            )
        else:
            mapped[field] = source_column
    return mapped, unmapped, warnings


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    try:
        missing = pd.isna(value)
    except (TypeError, ValueError):
        return False
    try:
        return bool(missing)
    except (TypeError, ValueError):
        return False


def _as_decimal(value: Any) -> Decimal:
    text = str(value).strip().replace(",", "")
    if text.endswith("%"):
        text = text[:-1].strip()
    number = Decimal(text)
    if not number.is_finite():
        raise InvalidOperation
    return number


def _normalize_value(field: str, value: Any) -> str | int | float:
    if field in TEXT_FIELDS:
        text = str(value).strip()
        max_length = 100 if field in {"district", "block"} else 255
        if len(text) > max_length:
            raise ValueError
        return text
    if field == "data_date":
        parsed_date = pd.to_datetime(value, errors="raise")
        if pd.isna(parsed_date):
            raise ValueError
        return date(parsed_date.year, parsed_date.month, parsed_date.day).isoformat()
    number = _as_decimal(value)
    if field in INTEGER_FIELDS:
        if number != number.to_integral_value():
            raise ValueError
        return int(number)
    if field == "latitude":
        if number < -90 or number > 90:
            raise ValueError
    elif field == "longitude":
        if number < -180 or number > 180:
            raise ValueError
    elif field in PERCENTAGE_FIELDS and (number < 0 or number > 100):
        raise ValueError
    return float(number)


def _row_errors(
    normalized: dict[str, str | int | float],
    row_number: int,
    user: User,
) -> list[str]:
    errors: list[str] = []
    for required in ("village", "district"):
        if not normalized.get(required):
            errors.append(f"Row {row_number}: required geographic field '{required}' is missing.")

    if user.role != UserRole.STATE_ADMIN:
        if not user.district:
            errors.append(f"Row {row_number}: uploader has no assigned district scope.")
        elif str(normalized.get("district", "")).strip().casefold() != user.district.strip().casefold():
            errors.append(f"Row {row_number}: district is outside the uploader's permitted scope.")
    if user.role == UserRole.BLOCK_OFFICER:
        if not normalized.get("block"):
            errors.append(f"Row {row_number}: required geographic field 'block' is missing.")
        elif (
            user.block is None
            or str(normalized["block"]).strip().casefold() != user.block.strip().casefold()
        ):
            errors.append(f"Row {row_number}: block is outside the uploader's permitted scope.")

    for field in INTEGER_FIELDS:
        value = normalized.get(field)
        if isinstance(value, (int, float)) and value < 0:
            errors.append(f"Row {row_number}: '{field}' cannot be negative.")
    for field in (
        "housing_eligible",
        "health_eligible",
        "water_eligible",
        "welfare_eligible",
    ):
        value = normalized.get(field)
        if isinstance(value, int) and value == 0:
            errors.append(f"Row {row_number}: '{field}' must be greater than zero.")
    households = normalized.get("households")
    population = normalized.get("population")
    eligible_households = normalized.get("eligible_households")
    if isinstance(households, int) and isinstance(population, int) and households > population:
        errors.append(f"Row {row_number}: 'households' cannot exceed 'population'.")
    if (
        isinstance(eligible_households, int)
        and isinstance(households, int)
        and eligible_households > households
    ):
        errors.append(f"Row {row_number}: 'eligible_households' cannot exceed 'households'.")

    for service in ("housing", "health", "water", "welfare"):
        eligible = normalized.get(f"{service}_eligible")
        covered = normalized.get(f"{service}_covered")
        if isinstance(eligible, int) and isinstance(covered, int) and covered > eligible:
            errors.append(f"Row {row_number}: '{service}_covered' cannot exceed eligible.")
        coverage = normalized.get(f"{service}_coverage")
        if coverage is None and isinstance(eligible, int) and eligible > 0 and isinstance(covered, int):
            normalized[f"{service}_coverage"] = round(covered * 100 / eligible, 2)

    pending_cases = normalized.get("pending_cases")
    if (
        isinstance(pending_cases, int)
        and isinstance(eligible_households, int)
        and pending_cases > eligible_households
    ):
        errors.append(f"Row {row_number}: 'pending_cases' cannot exceed eligible households.")
    pending_rate = normalized.get("pending_rate")
    if (
        pending_rate is None
        and isinstance(pending_cases, int)
        and isinstance(eligible_households, int)
        and eligible_households > 0
    ):
        normalized["pending_rate"] = round(
            pending_cases * 100 / eligible_households,
            2,
        )
    return errors


def normalize_table(parsed: ParsedTable, user: User) -> NormalizedTable:
    mapped, unmapped, mapping_warnings = map_columns(parsed.columns)
    validation_errors: list[str] = []
    valid_rows: list[tuple[int, dict[str, Any]]] = []
    for row_number, record in enumerate(parsed.records, start=2):
        normalized: dict[str, str | int | float] = {}
        row_errors: list[str] = []
        for field, source_column in mapped.items():
            value = record.get(source_column)
            if _is_empty(value):
                continue
            try:
                normalized[field] = _normalize_value(field, value)
            except (InvalidOperation, TypeError, ValueError, OverflowError):
                row_errors.append(
                    f"Row {row_number}: '{field}' must contain a valid value."
                )
        row_errors.extend(_row_errors(normalized, row_number, user))
        if row_errors:
            validation_errors.extend(row_errors)
        else:
            valid_rows.append(
                (
                    row_number,
                    {
                        field: value
                        for field, value in normalized.items()
                        if field in NORMALIZED_FIELDS
                    },
                )
            )

    warnings = [*parsed.warnings, *mapping_warnings]
    if len(validation_errors) > MAX_REPORTED_ERRORS:
        validation_errors = validation_errors[:MAX_REPORTED_ERRORS]
        warnings.append(
            f"Validation error details were capped at {MAX_REPORTED_ERRORS} messages."
        )

    analytics_fields = {
        "housing_coverage",
        "health_coverage",
        "water_coverage",
        "welfare_coverage",
        "pending_rate",
    }
    if not analytics_fields.issubset(mapped):
        missing = sorted(analytics_fields - mapped.keys())
        warnings.append(
            "Some analytics inputs are unavailable in this import: "
            + ", ".join(missing)
            + "."
        )
    if unmapped:
        warnings.append(
            "Unmapped columns were retained in the mapping report but are not stored as normalized data."
        )

    return NormalizedTable(
        parsed=parsed,
        mapped_columns=mapped,
        unmapped_columns=unmapped,
        valid_rows=valid_rows,
        validation_errors=validation_errors,
        warnings=warnings,
    )
