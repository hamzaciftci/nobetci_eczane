import { buildNearestResponse } from "./_lib/duty.js";
import { withDb } from "./_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, sendJson } from "./_lib/http.js";
import { degradedPayload, isViewMissing } from "./_lib/fallback.js";
import { cacheGet, cacheSet, nearestKey } from "./_lib/cache.js";

// Bounding box radius for pre-filter (kilometres)
const RADIUS_KM = 50;
// 1 degree latitude ≈ 111.12 km (constant)
const KM_PER_DEG_LAT = 111.12;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const lat = Number(getSingleQueryValue(req.query.lat));
  const lng = Number(getSingleQueryValue(req.query.lng));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return sendJson(res, 400, { error: "invalid_coordinates" });
  }

  // Bounding box (degrees) for the SQL pre-filter — eliminates rows outside the
  // radius before the haversine ORDER BY runs.
  const latDelta = RADIUS_KM / KM_PER_DEG_LAT;
  const lngDelta = RADIUS_KM / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  const cacheKey = nearestKey(lat, lng);

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return sendJson(res, 200, cached);
    }

    const rows = await withDb((db) =>
      db`
        select
          v.*,
          6371.0 * acos(
            least(1.0,
              cos(radians(${lat})) * cos(radians(v.lat::float))
                * cos(radians(v.lng::float) - radians(${lng}))
              + sin(radians(${lat})) * sin(radians(v.lat::float))
            )
          ) as distance_km
        from api_active_duty v
        where v.lat is not null
          and v.lng is not null
          and v.lat::float between ${minLat} and ${maxLat}
          and v.lng::float between ${minLng} and ${maxLng}
        order by distance_km
        limit 10
      `
    );

    const payload = buildNearestResponse(rows);
    await cacheSet(cacheKey, payload);
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error("[nearest]", error?.message ?? error);
    return sendJson(res, 200, { status: "degraded", data: [] });
  }
}
