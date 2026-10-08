"""Validate the synthetic SevaAI Manipur village demonstration CSV."""

from __future__ import annotations

import csv
import datetime as dt
import math
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

if __package__:
    from .percentage import percentage
else:
    from percentage import percentage


ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "raw" / "sevaai_demo_data.csv"
EXPECTED_COLUMNS = (
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
    "historical_water_coverage",
    "historical_health_coverage",
    "historical_housing_coverage",
    "historical_welfare_coverage",
    "latitude",
    "longitude",
    "data_date",
)
SERVICES = ("housing", "health", "water", "welfare")
PERCENTAGE_FIELDS = (
    "housing_coverage",
    "health_coverage",
    "water_coverage",
    "welfare_coverage",
    "pending_rate",
    "historical_water_coverage",
    "historical_health_coverage",
    "historical_housing_coverage",
    "historical_welfare_coverage",
)
INTEGER_FIELDS = (
    "population",
    "households",
    "eligible_households",
    "pending_cases",
    *(f"{service}_{suffix}" for service in SERVICES for suffix in ("eligible", "covered")),
)


def validate() -> tuple[list[str], list[dict[str, str]]]:
    errors: list[str] = []
    rows: list[dict[str, str]] = []

    if not DATASET.is_file():
        return [f"Dataset file does not exist: {DATASET}"], rows

    with DATASET.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if reader.fieldnames != list(EXPECTED_COLUMNS):
            errors.append(
                "CSV columns do not match the documented schema/order: "
                f"{reader.fieldnames!r}"
            )
            return errors, rows
        rows = list(reader)

    if not 1_800 <= len(rows) <= 2_200:
        errors.append(f"Expected approximately 2,000 rows; found {len(rows)}")

    identifiers = [row["village_id"] for row in rows]
    if len(set(identifiers)) != len(identifiers):
        errors.append("Duplicate village_id values found")

    for row_number, row in enumerate(rows, start=2):
        prefix = f"CSV row {row_number}"
        missing = [column for column in EXPECTED_COLUMNS if not row.get(column, "").strip()]
        if missing:
            errors.append(f"{prefix}: missing values in {', '.join(missing)}")
            continue

        counts: dict[str, Decimal] = {}
        coordinates: dict[str, float] = {}
        percentages: dict[str, Decimal] = {}
        for field in INTEGER_FIELDS:
            try:
                counts[field] = Decimal(row[field])
            except InvalidOperation:
                errors.append(f"{prefix}: {field} is not numeric")

        for field in ("latitude", "longitude"):
            try:
                coordinates[field] = float(row[field])
            except ValueError:
                errors.append(f"{prefix}: {field} is not numeric")

        for field in PERCENTAGE_FIELDS:
            try:
                percentages[field] = Decimal(row[field])
            except InvalidOperation:
                errors.append(f"{prefix}: {field} is not numeric")

        if (
            len(counts) != len(INTEGER_FIELDS)
            or len(coordinates) != 2
            or len(percentages) != len(PERCENTAGE_FIELDS)
        ):
            continue

        if (
            any(not value.is_finite() for value in counts.values())
            or any(not math.isfinite(value) for value in coordinates.values())
            or any(not value.is_finite() for value in percentages.values())
        ):
            errors.append(f"{prefix}: numeric values must be finite")
            continue

        for field in INTEGER_FIELDS:
            if counts[field] != counts[field].to_integral_value():
                errors.append(f"{prefix}: {field} must be an integer")
            if counts[field] < 0:
                errors.append(f"{prefix}: {field} must not be negative")

        for field in PERCENTAGE_FIELDS:
            if not 0 <= percentages[field] <= 100:
                errors.append(f"{prefix}: {field} must be between 0 and 100")

        if counts["households"] > counts["population"]:
            errors.append(f"{prefix}: households exceed population")
        if counts["eligible_households"] > counts["households"]:
            errors.append(f"{prefix}: eligible_households exceed households")

        for service in SERVICES:
            eligible = counts[f"{service}_eligible"]
            covered = counts[f"{service}_covered"]
            coverage = percentages[f"{service}_coverage"]
            if covered > eligible:
                errors.append(f"{prefix}: {service}_covered exceeds {service}_eligible")
            if eligible == 0:
                errors.append(f"{prefix}: {service}_eligible must be positive")
            elif (
                eligible > 0
                and covered == covered.to_integral_value()
                and eligible == eligible.to_integral_value()
                and coverage != percentage(int(covered), int(eligible))
            ):
                errors.append(f"{prefix}: {service}_coverage is inconsistent with its counts")

        if counts["pending_cases"] > counts["eligible_households"]:
            errors.append(f"{prefix}: pending_cases exceed eligible_households")
        if counts["eligible_households"] <= 0:
            errors.append(f"{prefix}: eligible_households must be positive")
        elif (
            counts["pending_cases"]
            == counts["pending_cases"].to_integral_value()
            and counts["eligible_households"]
            == counts["eligible_households"].to_integral_value()
            and percentages["pending_rate"]
            != percentage(
                int(counts["pending_cases"]),
                int(counts["eligible_households"]),
            )
        ):
            errors.append(f"{prefix}: pending_rate is inconsistent with its counts")

        latitude, longitude = coordinates["latitude"], coordinates["longitude"]
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            errors.append(f"{prefix}: coordinates are outside valid latitude/longitude ranges")
        if not 23.8 <= latitude <= 25.8 or not 92.9 <= longitude <= 94.9:
            errors.append(f"{prefix}: coordinates are outside the Manipur prototype envelope")

        try:
            parsed_date = dt.date.fromisoformat(row["data_date"])
            if parsed_date.isoformat() != row["data_date"]:
                errors.append(f"{prefix}: data_date must use YYYY-MM-DD format")
        except ValueError:
            errors.append(f"{prefix}: data_date is not a valid ISO date")

        if row["state"] != "Manipur":
            errors.append(f"{prefix}: state must be Manipur")

    if rows and len({row["district"] for row in rows}) != 16:
        errors.append(f"Expected 16 represented districts; found {len({row['district'] for row in rows})}")

    if rows:
        pattern_counts = {
            "high coverage across services": sum(
                all(float(row[f"{service}_coverage"]) >= 75 for service in SERVICES)
                for row in rows
            ),
            "low coverage examples per service": min(
                sum(float(row[f"{service}_coverage"]) <= 52 for row in rows)
                for service in SERVICES
            ),
            "multiple simultaneous gaps": sum(
                sum(float(row[f"{service}_coverage"]) < 60 for service in SERVICES) >= 3
                for row in rows
            ),
            "high pending rate": sum(float(row["pending_rate"]) >= 24 for row in rows),
            "negative historical trend": sum(
                float(row[f"historical_{service}_coverage"])
                - float(row[f"{service}_coverage"])
                >= 10
                for row in rows
                for service in SERVICES
            ),
            "unusual service combinations": sum(
                float(row["water_coverage"]) >= 80
                and float(row["housing_coverage"]) >= 80
                and float(row["health_coverage"]) < 55
                and float(row["welfare_coverage"]) < 55
                for row in rows
            ),
            "medium-range overall coverage": sum(
                50
                <= sum(float(row[f"{service}_coverage"]) for service in SERVICES) / 4
                <= 75
                for row in rows
            ),
        }
        minimums = {
            "high coverage across services": 100,
            "low coverage examples per service": 50,
            "multiple simultaneous gaps": 100,
            "high pending rate": 100,
            "negative historical trend": 100,
            "unusual service combinations": 50,
            "medium-range overall coverage": 100,
        }
        for pattern, minimum in minimums.items():
            if pattern_counts[pattern] < minimum:
                errors.append(
                    f"Insufficient synthetic examples for {pattern}: "
                    f"{pattern_counts[pattern]} (expected at least {minimum})"
                )

    return errors, rows


def main() -> int:
    errors, rows = validate()
    if errors:
        print(f"Dataset validation failed with {len(errors)} issue(s):")
        for error in errors[:100]:
            print(f"- {error}")
        if len(errors) > 100:
            print(f"- ... and {len(errors) - 100} more")
        return 1

    print("Dataset validation passed.")
    print(f"Rows: {len(rows)}")
    print(f"Columns: {len(EXPECTED_COLUMNS)}")
    print(f"Districts: {len({row['district'] for row in rows})}")
    print(f"Blocks: {len({(row['district'], row['block']) for row in rows})}")
    print(f"Unique villages: {len({row['village_id'] for row in rows})}")
    print("Missing values: 0")
    print("Invalid percentages, negative counts, covered > eligible, invalid coordinates, "
          "inconsistent calculations, invalid dates: 0")
    services = ("housing", "health", "water", "welfare")
    patterns = {
        "High coverage villages": sum(
            all(float(row[f"{service}_coverage"]) >= 75 for service in services)
            for row in rows
        ),
        "Villages with at least 3 services below 60% coverage": sum(
            sum(float(row[f"{service}_coverage"]) < 60 for service in services) >= 3
            for row in rows
        ),
        "Villages with pending rate >= 24%": sum(
            float(row["pending_rate"]) >= 24 for row in rows
        ),
        "Villages with >= 10-point historical decline in any service": sum(
            any(
                float(row[f"historical_{service}_coverage"])
                - float(row[f"{service}_coverage"])
                >= 10
                for service in services
            )
            for row in rows
        ),
    }
    for label, count in patterns.items():
        print(f"{label}: {count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
