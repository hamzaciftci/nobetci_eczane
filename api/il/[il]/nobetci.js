import { buildDutyResponse } from "../../_lib/duty.js";
import { withDb } from "../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, sendInternalError, sendJson } from "../../_lib/http.js";
import { resolveActiveDutyDate } from "../../_lib/time.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const ilSlug = getSingleQueryValue(req.query.il).toLowerCase();
  if (!ilSlug) {
    return sendJson(res, 400, { error: "invalid_il" });
  }

  try {
    const rows = await withDb((db) =>
      db`
        select v.*
        from api_active_duty v
        where v.il_slug = ${ilSlug}
        order by v.ilce, v.eczane_adi
      `
    );

    const dutyDate = resolveActiveDutyDate();
    return sendJson(res, 200, buildDutyResponse(rows, dutyDate));
  } catch (error) {
    if (isViewMissing(error)) {
      return sendJson(res, 503, {
        status: "error",
        message: "Canonical duty view not available"
      });
    }
    return sendInternalError(res, error);
  }
}

function isViewMissing(error) {
  return (
    error?.code === "42P01" ||
    (typeof error?.message === "string" && error.message.includes("api_active_duty"))
  );
}
