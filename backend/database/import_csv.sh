#!/usr/bin/env bash
set -euo pipefail

psql --set ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'SQL'
BEGIN;
TRUNCATE TABLE villages;
\copy villages (village_id, state, district, block, gram_panchayat, village, population, households, eligible_households, housing_eligible, housing_covered, housing_coverage, health_eligible, health_covered, health_coverage, water_eligible, water_covered, water_coverage, welfare_eligible, welfare_covered, welfare_coverage, pending_cases, pending_rate, historical_water_coverage, historical_health_coverage, historical_housing_coverage, historical_welfare_coverage, latitude, longitude, data_date) FROM '/seed/sevaai_demo_data.csv' WITH (FORMAT csv, HEADER true)
COMMIT;
SQL
