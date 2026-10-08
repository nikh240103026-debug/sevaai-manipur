from datetime import date
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import CheckConstraint, Computed, Date, Float, Index, Integer, Numeric, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Village(Base):
    __tablename__ = "villages"

    __table_args__ = (
        CheckConstraint("population > 0", name="villages_population_positive"),
        CheckConstraint(
            "households > 0 AND households <= population",
            name="villages_households_valid",
        ),
        CheckConstraint(
            "eligible_households > 0 AND eligible_households <= households",
            name="villages_eligible_households_valid",
        ),
        CheckConstraint(
            "housing_eligible > 0 AND housing_covered BETWEEN 0 AND housing_eligible "
            "AND housing_coverage BETWEEN 0 AND 100 "
            "AND housing_coverage = ROUND(100.0 * housing_covered / housing_eligible, 2)",
            name="villages_housing_values_valid",
        ),
        CheckConstraint(
            "health_eligible > 0 AND health_covered BETWEEN 0 AND health_eligible "
            "AND health_coverage BETWEEN 0 AND 100 "
            "AND health_coverage = ROUND(100.0 * health_covered / health_eligible, 2)",
            name="villages_health_values_valid",
        ),
        CheckConstraint(
            "water_eligible > 0 AND water_covered BETWEEN 0 AND water_eligible "
            "AND water_coverage BETWEEN 0 AND 100 "
            "AND water_coverage = ROUND(100.0 * water_covered / water_eligible, 2)",
            name="villages_water_values_valid",
        ),
        CheckConstraint(
            "welfare_eligible > 0 AND welfare_covered BETWEEN 0 AND welfare_eligible "
            "AND welfare_coverage BETWEEN 0 AND 100 "
            "AND welfare_coverage = ROUND(100.0 * welfare_covered / welfare_eligible, 2)",
            name="villages_welfare_values_valid",
        ),
        CheckConstraint(
            "pending_cases >= 0 AND pending_cases <= eligible_households "
            "AND pending_rate BETWEEN 0 AND 100 "
            "AND pending_rate = ROUND(100.0 * pending_cases / eligible_households, 2)",
            name="villages_pending_values_valid",
        ),
        CheckConstraint(
            "historical_water_coverage BETWEEN 0 AND 100 "
            "AND historical_health_coverage BETWEEN 0 AND 100 "
            "AND historical_housing_coverage BETWEEN 0 AND 100 "
            "AND historical_welfare_coverage BETWEEN 0 AND 100",
            name="villages_historical_coverages_valid",
        ),
        CheckConstraint("latitude BETWEEN -90 AND 90", name="villages_latitude_valid"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="villages_longitude_valid"),
        Index("villages_district_idx", "district"),
        Index("villages_block_idx", "block"),
        Index("villages_district_block_idx", "district", "block"),
        Index("villages_geom_gist_idx", "geom", postgresql_using="gist"),
    )

    village_id: Mapped[str] = mapped_column(Text, primary_key=True)
    state: Mapped[str] = mapped_column(Text, nullable=False)
    district: Mapped[str] = mapped_column(Text, nullable=False)
    block: Mapped[str] = mapped_column(Text, nullable=False)
    gram_panchayat: Mapped[str] = mapped_column(Text, nullable=False)
    village: Mapped[str] = mapped_column(Text, nullable=False)

    population: Mapped[int] = mapped_column(Integer, nullable=False)
    households: Mapped[int] = mapped_column(Integer, nullable=False)
    eligible_households: Mapped[int] = mapped_column(Integer, nullable=False)

    housing_eligible: Mapped[int] = mapped_column(Integer, nullable=False)
    housing_covered: Mapped[int] = mapped_column(Integer, nullable=False)
    housing_coverage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    health_eligible: Mapped[int] = mapped_column(Integer, nullable=False)
    health_covered: Mapped[int] = mapped_column(Integer, nullable=False)
    health_coverage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    water_eligible: Mapped[int] = mapped_column(Integer, nullable=False)
    water_covered: Mapped[int] = mapped_column(Integer, nullable=False)
    water_coverage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    welfare_eligible: Mapped[int] = mapped_column(Integer, nullable=False)
    welfare_covered: Mapped[int] = mapped_column(Integer, nullable=False)
    welfare_coverage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)

    pending_cases: Mapped[int] = mapped_column(Integer, nullable=False)
    pending_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    historical_water_coverage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    historical_health_coverage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    historical_housing_coverage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    historical_welfare_coverage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    data_date: Mapped[date] = mapped_column(Date, nullable=False)
    geom: Mapped[object] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
        Computed("ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)", persisted=True),
        nullable=False,
    )
