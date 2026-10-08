"""Generate the reproducible, synthetic SevaAI Manipur demonstration dataset."""

from __future__ import annotations

import csv
import random
from decimal import Decimal
from pathlib import Path

if __package__:
    from .percentage import percentage
else:
    from percentage import percentage


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "raw" / "sevaai_demo_data.csv"
SEED = 240103026
DATA_DATE = "2025-03-31"
TARGET_VILLAGES = 2_000

DISTRICTS = (
    ("Bishnupur", "BIS", 24.61, 93.77, ("Bishnupur", "Moirang", "Nambol", "Kumbi", "Ningthoukhong")),
    ("Chandel", "CHA", 24.33, 94.00, ("Chandel", "Chakpikarong", "Khengjoi", "Machi")),
    ("Churachandpur", "CCP", 24.33, 93.68, ("Churachandpur", "Henglep", "Singngat", "Thanlon", "Tipaimukh", "Saikot")),
    ("Imphal East", "IEA", 24.81, 93.97, ("Porompat", "Sawombung", "Keirao Bitra", "Andro")),
    ("Imphal West", "IWE", 24.81, 93.91, ("Lamphelpat", "Wangoi", "Patsoi", "Sekmai", "Mayang Imphal")),
    ("Jiribam", "JIR", 24.80, 93.12, ("Jiribam", "Borobekra")),
    ("Kakching", "KAK", 24.49, 93.98, ("Kakching", "Waikhong", "Sugnu")),
    ("Kamjong", "KAM", 24.85, 94.50, ("Kamjong", "Phungyar", "Kasom Khullen", "Sahamphung")),
    ("Kangpokpi", "KPI", 25.15, 93.99, ("Kangpokpi", "Saikul", "Saitu", "Kangchup Geljang")),
    ("Noney", "NON", 24.78, 93.57, ("Nungba", "Khoupum")),
    ("Pherzawl", "PHE", 24.25, 93.23, ("Pherzawl", "Vangai")),
    ("Senapati", "SEN", 25.27, 94.02, ("Senapati", "Mao Maram", "Paomata", "Purul", "Tadubi", "Willong")),
    ("Tamenglong", "TAM", 24.98, 93.50, ("Tamenglong", "Tamei", "Tousem")),
    ("Tengnoupal", "TEN", 24.25, 94.15, ("Tengnoupal", "Moreh", "Machi")),
    ("Thoubal", "THO", 24.63, 94.01, ("Thoubal", "Lilong", "Wangjing", "Heirok", "Yairipok")),
    ("Ukhrul", "UKH", 25.12, 94.36, ("Ukhrul", "Chingai", "Litan", "Jessami")),
)

SERVICE_NAMES = ("housing", "health", "water", "welfare")
FIELDS = (
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

# Synthetic scenario cohorts are repeated across districts, so each district
# contains a mix of patterns instead of being assigned a single profile.
PATTERNS = (
    "high_coverage",
    "low_water",
    "low_health",
    "low_housing",
    "low_welfare",
    "multiple_gaps",
    "high_pending",
    "negative_trend",
    "unusual_combination",
    "normal",
    "medium",
    "normal",
)

BASE_RANGES = {
    "high_coverage": (82, 97),
    "low_water": (70, 91),
    "low_health": (70, 91),
    "low_housing": (70, 91),
    "low_welfare": (70, 91),
    "multiple_gaps": (27, 69),
    "high_pending": (66, 91),
    "negative_trend": (61, 87),
    "unusual_combination": (70, 92),
    "normal": (64, 94),
    "medium": (45, 78),
}

LOW_SERVICE_PATTERN = {
    "low_water": "water",
    "low_health": "health",
    "low_housing": "housing",
    "low_welfare": "welfare",
}


def coverage_values(pattern: str, rng: random.Random) -> dict[str, int]:
    low, high = BASE_RANGES[pattern]
    rates = {service: rng.randint(low, high) for service in SERVICE_NAMES}

    if pattern in LOW_SERVICE_PATTERN:
        service = LOW_SERVICE_PATTERN[pattern]
        rates[service] = rng.randint(28, 51)
    elif pattern == "multiple_gaps":
        for service in SERVICE_NAMES:
            rates[service] = rng.randint(30, 57)
    elif pattern == "high_pending":
        rates = {service: rng.randint(68, 91) for service in SERVICE_NAMES}
    elif pattern == "negative_trend":
        rates = {service: rng.randint(60, 84) for service in SERVICE_NAMES}
    elif pattern == "unusual_combination":
        rates = {
            "housing": rng.randint(88, 98),
            "health": rng.randint(31, 49),
            "water": rng.randint(84, 97),
            "welfare": rng.randint(33, 53),
        }
    elif pattern == "normal":
        rates = {service: rng.randint(69, 94) for service in SERVICE_NAMES}
    elif pattern == "medium":
        rates = {service: rng.randint(46, 77) for service in SERVICE_NAMES}

    return rates


def historical_rate(current: Decimal, pattern: str, rng: random.Random) -> float:
    if pattern == "negative_trend":
        previous = min(99, current + rng.randint(14, 30))
    elif pattern == "high_coverage":
        previous = max(0, current - rng.randint(0, 5))
    else:
        previous = max(0, min(99, current + rng.randint(-6, 6)))
    return round(float(previous), 2)


def make_row(
    index: int,
    district_index: int,
    district_count: int,
    blocks: tuple[str, ...],
    anchor_latitude: float,
    anchor_longitude: float,
    district_code: str,
    rng: random.Random,
) -> dict[str, object]:
    block_index = (index * len(blocks)) // district_count
    block = blocks[block_index]
    within_block = index - sum(
        district_count // len(blocks) + (1 if i < district_count % len(blocks) else 0)
        for i in range(block_index)
    )
    block_ordinal = block_index + 1

    households = rng.randint(42, 780)
    persons_per_household = rng.uniform(3.7, 6.1)
    population = max(households, round(households * persons_per_household))
    eligible_households = rng.randint(
        max(1, round(households * 0.62)), households
    )
    pattern = PATTERNS[(index + district_index * 3) % len(PATTERNS)]
    rates = coverage_values(pattern, rng)

    row: dict[str, object] = {
        "village_id": f"MAN-{district_code}-{block_ordinal:02d}-{within_block + 1:03d}",
        "state": "Manipur",
        "district": DISTRICTS[district_index][0],
        "block": block,
        # This is a synthetic local-council grouping, not an official GP name.
        "gram_panchayat": f"{block} Local Council Group {(within_block // 5) + 1:02d}",
        "village": f"{block} Demo Village {within_block + 1:03d}",
        "population": population,
        "households": households,
        "eligible_households": eligible_households,
    }

    for service in SERVICE_NAMES:
        eligible = rng.randint(max(1, round(eligible_households * 0.72)), eligible_households)
        covered = min(eligible, round(eligible * rates[service] / 100))
        actual_coverage = percentage(covered, eligible)
        row[f"{service}_eligible"] = eligible
        row[f"{service}_covered"] = covered
        row[f"{service}_coverage"] = actual_coverage
        row[f"historical_{service}_coverage"] = historical_rate(
            actual_coverage, pattern, rng
        )

    if pattern == "high_pending":
        pending_cases = round(eligible_households * rng.uniform(0.24, 0.43))
    elif pattern == "multiple_gaps":
        pending_cases = round(eligible_households * rng.uniform(0.18, 0.34))
    else:
        pending_cases = round(eligible_households * rng.uniform(0.01, 0.20))
    pending_cases = min(eligible_households, max(0, pending_cases))
    row["pending_cases"] = pending_cases
    row["pending_rate"] = percentage(pending_cases, eligible_households)

    # These are approximate synthetic demonstration points near district
    # reference locations, not surveyed village coordinates.
    latitude = anchor_latitude + rng.uniform(-0.11, 0.11)
    longitude = anchor_longitude + rng.uniform(-0.12, 0.12)
    row["latitude"] = round(latitude, 6)
    row["longitude"] = round(longitude, 6)
    row["data_date"] = DATA_DATE

    return row


def generate() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    base_count, extra = divmod(TARGET_VILLAGES, len(DISTRICTS))
    counts = [base_count + (1 if index < extra else 0) for index in range(len(DISTRICTS))]
    rows: list[dict[str, object]] = []

    for district_index, (
        _district,
        code,
        latitude,
        longitude,
        blocks,
    ) in enumerate(DISTRICTS):
        district_count = counts[district_index]
        for index in range(district_count):
            rows.append(
                make_row(
                    index=index,
                    district_index=district_index,
                    district_count=district_count,
                    blocks=blocks,
                    anchor_latitude=latitude,
                    anchor_longitude=longitude,
                    district_code=code,
                    rng=rng,
                )
            )

    with OUTPUT.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    return len(rows)


if __name__ == "__main__":
    print(f"Wrote {generate()} synthetic village records to {OUTPUT}")
