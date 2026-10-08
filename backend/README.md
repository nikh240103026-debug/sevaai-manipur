# SevaAI Manipur backend

This backend currently provides the minimal FastAPI API foundation and the PostgreSQL/PostGIS schema connection. Authentication, AI/ML, analytics, interventions, alerts, and production government data integration are out of scope.

## Synthetic data warning

The imported `villages` rows come from [`../data/raw/sevaai_demo_data.csv`](../data/raw/sevaai_demo_data.csv). Service and beneficiary-related values are synthetic. Village names, local-council groupings, identifiers, and coordinates are synthetic; coordinates are approximate demonstration points, not surveyed locations. The data must not be represented as actual government statistics or used for operational decisions. It contains no real beneficiary PII.

## Prerequisites

- Docker Desktop (or Docker Engine) with the Compose plugin
- The existing synthetic CSV at `data/raw/sevaai_demo_data.csv`
- Python 3.11 or later

## Configure and start PostgreSQL/PostGIS

From the repository root, create a local environment file and set a development-only password:

```powershell
Copy-Item .env.example .env
```

Edit `.env` before starting the database. It is ignored by Git. The Compose service uses the `postgis/postgis:16-3.5` image, creates a persistent named volume, and publishes PostgreSQL on port `5432` by default. Set `POSTGRES_PORT` in `.env` if that host port is already in use.

`DATABASE_URL` configures the host-run FastAPI application. Keep its user/password synchronized with `POSTGRES_USER` and `POSTGRES_PASSWORD`. URL-encode special characters in URL credentials. Never commit `.env` or use the example password for a shared deployment.

Start the service and wait for its health check:

```powershell
docker compose up -d --wait db
docker compose ps
```

On the first start for an empty volume, the image executes `backend/database/init.sql`, which enables PostGIS, creates the `villages` table and geometry column, and builds district, block, and spatial indexes. Initialization scripts run only when PostgreSQL initializes a new data directory. To reapply a changed schema during local development, reset the volume as described below.

## Import or re-import the existing CSV

The import script reads the mounted CSV from inside the database container. It replaces the current `villages` contents in one transaction and is repeatable:

```powershell
docker compose exec -T db bash /database/import_csv.sh
```

The table's `geom` column is generated from `longitude` and `latitude` using SRID 4326; it is not present in the source CSV and should not be imported manually.

## Verify the database

Run the database verification script:

```powershell
docker compose exec -T db bash /database/verify_database.sh
```

The script fails with a PostgreSQL error unless PostGIS is enabled, the table exists, exactly 2,000 records are present, all village IDs are unique, each row has a geometry, and every geometry uses SRID 4326. On success it prints those counts and the PostGIS status.

## Stop or reset

Stop the container without deleting its data:

```powershell
docker compose down
```

Reset the local database, including the persistent volume (this permanently deletes the database contents):

```powershell
docker compose down -v
docker compose up -d db
docker compose exec -T db bash /database/import_csv.sh
docker compose exec -T db bash /database/verify_database.sh
```

Do not use the volume-reset command for any database containing data that must be retained.

## Install backend dependencies

From the repository root:

```powershell
py -3.11 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

For endpoint tests, install development requirements as well:

```powershell
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
```

## Start FastAPI

Ensure PostgreSQL is running and `.env` contains a valid `DATABASE_URL`. From the repository root:

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload
```

Interactive Swagger documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs); OpenAPI JSON is at `/openapi.json`.

## Test the API

Check application and database health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

List districts and the first page of villages:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/districts
Invoke-RestMethod "http://127.0.0.1:8000/api/v1/villages?page=1&limit=10"
```

Get a village by ID (use an ID returned by the list endpoint) and retrieve map-safe points:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/villages/MAN-BIS-01-001
Invoke-RestMethod http://127.0.0.1:8000/api/v1/map/villages
```

Run automated route tests:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

With FastAPI and the imported database running, verify the live database-backed endpoints:

```powershell
.\backend\.venv\Scripts\python.exe backend\scripts\verify_api.py
```

The live verification checks API readiness, PostgreSQL and PostGIS health, districts, the 2,000-row village list, village detail, and map coordinates. It fails clearly if the API or database is unavailable.
