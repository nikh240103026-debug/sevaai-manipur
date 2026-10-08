# SevaAI Manipur

**AI-Powered Welfare & Public Service Gap Intelligence Platform**

## Problem

Government welfare and public-service information can be fragmented across different schemes and systems, making it difficult for officials to identify areas with multiple service gaps and prioritize interventions.

## Solution

SevaAI Manipur is an intelligence and decision-support layer that combines service data, performs coverage-gap analysis, detects unusual patterns, prioritizes areas, explains AI results, and supports intervention tracking.

## Initial technology stack

- Next.js, TypeScript, and Tailwind CSS
- FastAPI and Python
- PostgreSQL/PostGIS database foundation
- scikit-learn (planned)
- Leaflet (planned)

## Data and privacy

The hackathon prototype may use synthetic/demo data based on publicly available government scheme structures and geography. Synthetic data must never be represented as actual government statistics.

Do not use Aadhaar numbers, phone numbers, addresses, or other personally identifiable beneficiary information in the prototype.

## Development status

The repository includes a Next.js frontend, a FastAPI village/district/map API, administrator-only session authentication, a PostgreSQL/PostGIS schema, and a synthetic demonstration dataset. Analytics, anomaly detection, interventions, and production data integrations are not implemented.

## Local development

### Prerequisites

- Node.js 20.9 or later
- Python 3.11 or later
- Docker Engine/Desktop with the Compose plugin (for PostgreSQL/PostGIS)

### Database

From the repository root, create `.env` once, set a development-only PostgreSQL password, and keep it synchronized in `DATABASE_URL`. Never commit `.env`.

```bash
cp .env.example .env
docker compose up -d --wait db
docker compose exec -T db bash /database/import_csv.sh
docker compose exec -T db bash /database/verify_database.sh
```

The checked-in CSV contains synthetic demonstration data only. It is not official government data.

### Frontend

In one terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To use the API client, create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`.

If `NEXT_PUBLIC_API_URL` is missing, the frontend opens in local demo mode. If the API URL is configured but the backend/database is unavailable, select **Use local demo passkey** on the sign-in page. On first use, create a device passkey; later sign-ins require that passkey. This mode uses a small set of bundled synthetic village records and does not need the backend or database. It is only a local page-preview convenience, not secure authentication: do not use it with real or sensitive data. WebAuthn requires `localhost` or HTTPS. Restart the frontend after changing its environment file.

### Backend

In another terminal, from the repository root:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload
```

The API docs are at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Run backend tests from the repository root with:

```bash
backend/.venv/bin/python -m pytest backend/tests -q
```

### Administrator sign-in

Authentication uses the `user_id` and `password` JSON fields, stored PBKDF2 password hashes, and an eight-hour HttpOnly session cookie. Public registration is disabled.

For a new database, the auth tables are created by `backend/database/init.sql`. If the database already exists, apply the additive schema once:

```bash
docker compose exec -T db bash -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /database/auth.sql'
```

Set `ADMIN_USER_ID=admin01` and `ADMIN_PASSWORD` in the ignored repository-root `.env` file. Keep that password out of source control. Create the initial admin account once:

```bash
cd backend
.venv/bin/python -m app.scripts.bootstrap_admin
```

The bootstrap command does not overwrite an existing account. For production, use HTTPS and set `AUTH_COOKIE_SECURE=true`.
