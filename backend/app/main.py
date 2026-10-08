import logging

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.analytics import router as analytics_router
from app.api.routes.villages import router as villages_router
from app.core.config import get_settings
from app.db.database import get_engine
from app.schemas.village import HealthResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
app = FastAPI(
    title="SevaAI Manipur API",
    description=(
        "Initial API foundation. Dataset records and geography are synthetic "
        "demonstration data, not government statistics."
    ),
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(villages_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "name": "SevaAI Manipur API",
        "version": app.version,
        "description": "AI-Powered Welfare & Public Service Gap Intelligence Platform",
        "data_notice": "Village records are synthetic demonstration data.",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
            postgis_enabled = bool(
                connection.scalar(
                    text(
                        "SELECT EXISTS "
                        "(SELECT 1 FROM pg_extension WHERE extname = 'postgis')"
                    )
                )
            )
    except RuntimeError as exc:
        logger.error("Database health check unavailable: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not configured",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database health check failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is unavailable",
        ) from exc

    database_status = "connected"
    service_status = "ok"
    if not postgis_enabled:
        database_status = "connected; PostGIS extension is unavailable"
        service_status = "degraded"

    return HealthResponse(
        status=service_status,
        database=database_status,
        postgis=postgis_enabled,
    )
