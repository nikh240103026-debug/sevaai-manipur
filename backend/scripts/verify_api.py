"""Smoke-test the running API against its configured PostgreSQL database."""

from __future__ import annotations

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def get_json(path: str) -> object:
    try:
        with urlopen(f"{BASE_URL}{path}", timeout=10) as response:
            if response.status != 200:
                raise RuntimeError(f"{path} returned HTTP {response.status}")
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{path} returned HTTP {exc.code}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach {BASE_URL}: {exc.reason}") from exc


def main() -> int:
    try:
        root = get_json("/")
        if not isinstance(root, dict) or root.get("name") != "SevaAI Manipur API":
            raise RuntimeError("Root endpoint returned unexpected API information")

        health = get_json("/health")
        if not isinstance(health, dict) or health.get("status") != "ok":
            raise RuntimeError(f"API/database health check failed: {health}")
        if health.get("database") != "connected" or health.get("postgis") is not True:
            raise RuntimeError(f"PostgreSQL/PostGIS is not healthy: {health}")

        districts = get_json("/api/v1/districts")
        if not isinstance(districts, dict) or not districts.get("districts"):
            raise RuntimeError("District endpoint returned no districts")

        page = get_json("/api/v1/villages?page=1&limit=1")
        if not isinstance(page, dict) or page.get("total") != 2000 or not page.get("items"):
            raise RuntimeError(f"Village list endpoint returned unexpected data: {page}")
        village_id = page["items"][0]["village_id"]

        village = get_json(f"/api/v1/villages/{village_id}")
        if not isinstance(village, dict) or village.get("village_id") != village_id:
            raise RuntimeError(f"Village detail endpoint failed for {village_id}")

        map_points = get_json("/api/v1/map/villages")
        if not isinstance(map_points, list) or len(map_points) != 2000:
            raise RuntimeError("Map endpoint did not return 2,000 village points")
        point = map_points[0]
        required = {"village_id", "village", "district", "block", "latitude", "longitude"}
        if not required.issubset(point):
            raise RuntimeError("Map point is missing required geographic fields")

        print("API verification passed.")
        print("Root: passed")
        print("Health, PostgreSQL, and PostGIS: passed")
        print(f"District endpoint: passed ({len(districts['districts'])} districts)")
        print(f"Village list: passed ({page['total']} records)")
        print(f"Village detail: passed ({village_id})")
        print(f"Map points: passed ({len(map_points)} points with coordinates)")
        return 0
    except (RuntimeError, KeyError, TypeError) as exc:
        print(f"API verification failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
