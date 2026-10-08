# SevaAI Manipur backend

This backend currently provides a FastAPI API, PostgreSQL/PostGIS data layer, JWT authentication with role-based access control, prototype analytics, and a deterministic anomaly-detection signal. Interventions, alerts, and production government data integration are out of scope.

## Synthetic data warning

The imported `villages` rows come from [`../data/raw/sevaai_demo_data.csv`](../data/raw/sevaai_demo_data.csv). Service and beneficiary-related values are synthetic. Village names, local-council groupings, identifiers, and coordinates are synthetic; coordinates are approximate demonstration points, not surveyed locations. The data must not be represented as actual government statistics or used for operational decisions. It contains no real beneficiary PII.

## AI anomaly signals

`GET /api/v1/ai/anomalies` compares service coverage, pending rates, historical coverage, and positive historical deterioration across the available village population using an unsupervised Isolation Forest. The fixed estimator count and random state make results reproducible for an unchanged dataset. `GET /api/v1/ai/anomalies/{village_id}` returns the same population-relative result for one village. Optional list filters include `district`, `limit`, and `anomaly_only`.

An `UNUSUAL` classification is not fraud, corruption, or wrongdoing. Scores and deterministic reason codes are decision-support signals only, and the current village dataset is synthetic/demo data. The in-process service reuses evaluated results while village feature values remain unchanged; each application worker maintains its own cache.

## Authentication and roles

Village, district, map, analytics, and AI anomaly endpoints require a bearer access token. `POST /api/v1/auth/login` accepts a username and password and returns a signed JWT; send it as `Authorization: Bearer <access_token>`. `GET /api/v1/auth/me` returns the authenticated account without its password hash. `/`, `/health`, and the login endpoint remain public.

The roles are:

- `STATE_ADMIN`: unrestricted access.
- `DISTRICT_OFFICER`: only data for the account's assigned district.
- `BLOCK_OFFICER`: only data for the assigned district and block.

The same scope restrictions apply to list filters, detail records, district lists, maps, analytics, and anomaly results. Requests for records outside the assigned scope return HTTP 403. Inactive accounts cannot log in or use tokens.

Configure `JWT_SECRET_KEY`, `JWT_ALGORITHM`, and `ACCESS_TOKEN_EXPIRE_MINUTES` in the ignored local `.env` file. Generate a random secret of at least 32 bytes (for example, `openssl rand -hex 32`); never use the blank/example value in a shared environment or commit a secret. The MVP accepts HS256 and defaults tokens to 30 minutes. Restart the API after changing the environment.

Apply the additive user-table migration once to an existing database; it creates only `public.users` and leaves the `villages` table and its rows untouched:

```powershell
Get-Content -Raw backend\database\migrations\001_create_users.sql | docker compose exec -T db psql -U sevaai -d sevaai_manipur
```

Create the initial administrator and other accounts interactively so passwords are not placed in shell history or command-line arguments. From the repository root:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m scripts.create_user --username admin --full-name "State Administrator" --role STATE_ADMIN
```

For a district officer, also pass `--district "District Name"`; for a block officer, pass both `--district "District Name"` and `--block "Block Name"`. The script prompts for a matching password of at least 12 characters and stores only its Argon2 hash. No demo account or default password is created.

## Government data uploads

Authenticated officials can submit CSV, XLSX, or text-based PDF tables to `POST /api/v1/data/upload` as multipart form field `file`. Uploads are limited to 20 MiB. The parser maps recognized headers, requires village and district for each accepted row, validates available values, and returns detected/mapped/unmapped columns plus row-level validation messages. Missing service or historical fields remain missing; no source data is fabricated. PDFs without an extractable table require a structured table source; OCR and document interpretation are not enabled.

Uploads and accepted normalized rows are stored separately from `public.villages` in `public.data_uploads` and `public.imported_data_rows`. The original file is not retained. Use `GET /api/v1/data/uploads` and `GET /api/v1/data/uploads/{upload_id}` for import metadata, and `GET /api/v1/data/uploads/{upload_id}/rows` to page through accepted normalized rows. Upload metadata is scoped to the uploader's assigned district/block; state-admin imports are visible to state admins only. Existing dashboard, village, analytics, and anomaly endpoints continue to use the existing village dataset.

After applying the users migration, apply the additive upload migration:

```powershell
Get-Content -Raw backend\database\migrations\002_create_data_uploads.sql | docker compose exec -T db psql -U sevaai -d sevaai_manipur
```

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
