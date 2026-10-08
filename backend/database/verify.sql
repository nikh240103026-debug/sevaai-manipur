DO $$
DECLARE
    row_count bigint;
    unique_id_count bigint;
    geometry_count bigint;
    wrong_srid_count bigint;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'postgis'
    ) THEN
        RAISE EXCEPTION 'PostGIS extension is not enabled';
    END IF;

    IF to_regclass('public.villages') IS NULL THEN
        RAISE EXCEPTION 'public.villages table does not exist';
    END IF;

    SELECT COUNT(*), COUNT(DISTINCT village_id), COUNT(geom),
           COUNT(*) FILTER (WHERE ST_SRID(geom) <> 4326)
    INTO row_count, unique_id_count, geometry_count, wrong_srid_count
    FROM public.villages;

    IF row_count <> 2000 THEN
        RAISE EXCEPTION 'Expected 2000 villages, found %', row_count;
    END IF;

    IF unique_id_count <> row_count THEN
        RAISE EXCEPTION 'Village IDs are not unique: % rows, % unique IDs',
            row_count, unique_id_count;
    END IF;

    IF geometry_count <> row_count THEN
        RAISE EXCEPTION 'Expected geometry for every village, found % of %',
            geometry_count, row_count;
    END IF;

    IF wrong_srid_count <> 0 THEN
        RAISE EXCEPTION 'Found % geometries with SRID other than 4326',
            wrong_srid_count;
    END IF;
END
$$;

SELECT
    COUNT(*) AS row_count,
    COUNT(DISTINCT village_id) AS unique_village_ids,
    COUNT(geom) AS geometry_values,
    MIN(ST_SRID(geom)) AS geometry_srid,
    (SELECT postgis_version() IS NOT NULL) AS postgis_enabled
FROM public.villages;
