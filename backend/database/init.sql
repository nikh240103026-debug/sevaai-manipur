CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS auth_users (
    user_id varchar(50) PRIMARY KEY,
    password_hash varchar(256) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash varchar(64) PRIMARY KEY,
    user_id varchar(50) NOT NULL REFERENCES auth_users(user_id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS villages (
    village_id text PRIMARY KEY,
    state text NOT NULL,
    district text NOT NULL,
    block text NOT NULL,
    gram_panchayat text NOT NULL,
    village text NOT NULL,

    population integer NOT NULL CHECK (population > 0),
    households integer NOT NULL CHECK (households > 0 AND households <= population),
    eligible_households integer NOT NULL
        CHECK (eligible_households > 0 AND eligible_households <= households),

    housing_eligible integer NOT NULL CHECK (housing_eligible > 0),
    housing_covered integer NOT NULL
        CHECK (housing_covered >= 0 AND housing_covered <= housing_eligible),
    housing_coverage numeric(5, 2) NOT NULL
        CHECK (
            housing_coverage BETWEEN 0 AND 100
            AND housing_coverage = ROUND(100.0 * housing_covered / housing_eligible, 2)
        ),

    health_eligible integer NOT NULL CHECK (health_eligible > 0),
    health_covered integer NOT NULL
        CHECK (health_covered >= 0 AND health_covered <= health_eligible),
    health_coverage numeric(5, 2) NOT NULL
        CHECK (
            health_coverage BETWEEN 0 AND 100
            AND health_coverage = ROUND(100.0 * health_covered / health_eligible, 2)
        ),

    water_eligible integer NOT NULL CHECK (water_eligible > 0),
    water_covered integer NOT NULL
        CHECK (water_covered >= 0 AND water_covered <= water_eligible),
    water_coverage numeric(5, 2) NOT NULL
        CHECK (
            water_coverage BETWEEN 0 AND 100
            AND water_coverage = ROUND(100.0 * water_covered / water_eligible, 2)
        ),

    welfare_eligible integer NOT NULL CHECK (welfare_eligible > 0),
    welfare_covered integer NOT NULL
        CHECK (welfare_covered >= 0 AND welfare_covered <= welfare_eligible),
    welfare_coverage numeric(5, 2) NOT NULL
        CHECK (
            welfare_coverage BETWEEN 0 AND 100
            AND welfare_coverage = ROUND(100.0 * welfare_covered / welfare_eligible, 2)
        ),

    pending_cases integer NOT NULL
        CHECK (pending_cases >= 0 AND pending_cases <= eligible_households),
    pending_rate numeric(5, 2) NOT NULL
        CHECK (
            pending_rate BETWEEN 0 AND 100
            AND pending_rate = ROUND(100.0 * pending_cases / eligible_households, 2)
        ),

    historical_water_coverage numeric(5, 2) NOT NULL
        CHECK (historical_water_coverage BETWEEN 0 AND 100),
    historical_health_coverage numeric(5, 2) NOT NULL
        CHECK (historical_health_coverage BETWEEN 0 AND 100),
    historical_housing_coverage numeric(5, 2) NOT NULL
        CHECK (historical_housing_coverage BETWEEN 0 AND 100),
    historical_welfare_coverage numeric(5, 2) NOT NULL
        CHECK (historical_welfare_coverage BETWEEN 0 AND 100),

    latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    data_date date NOT NULL,

    geom geometry(Point, 4326)
        GENERATED ALWAYS AS (
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        ) STORED
);

CREATE INDEX IF NOT EXISTS villages_district_idx ON villages (district);
CREATE INDEX IF NOT EXISTS villages_block_idx ON villages (block);
CREATE INDEX IF NOT EXISTS villages_district_block_idx ON villages (district, block);
CREATE INDEX IF NOT EXISTS villages_geom_gist_idx ON villages USING GIST (geom);
