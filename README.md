# SevaAI Manipur

**AI-Powered Welfare & Public Service Gap Intelligence Platform**

## Problem

Government welfare and public-service information can be fragmented across different schemes and systems, making it difficult for officials to identify areas with multiple service gaps and prioritize interventions.

## Solution

SevaAI Manipur is an intelligence and decision-support layer that combines service data, performs coverage-gap analysis, detects unusual patterns, prioritizes areas, explains AI results, and supports intervention tracking.

## Initial technology stack

- Next.js, TypeScript, and Tailwind CSS
- FastAPI and Python
- PostgreSQL/PostGIS (planned)
- scikit-learn (planned)
- Leaflet (planned)

## Data and privacy

The hackathon prototype may use synthetic/demo data based on publicly available government scheme structures and geography. Synthetic data must never be represented as actual government statistics.

Do not use Aadhaar numbers, phone numbers, addresses, or other personally identifiable beneficiary information in the prototype.

## Development status

The project is currently in the initial repository/setup phase. The application, data, and decision-support capabilities will be developed incrementally.

## Local development

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Start the backend in a separate terminal:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
