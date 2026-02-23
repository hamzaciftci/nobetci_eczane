import { methodNotAllowed, sendJson } from "./_lib/http.js";
import { withDb } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  try {
    const provinces = await withDb((db) =>
      db`
        select code, name, slug
        from provinces
        order by code asc
      `
    );
    return sendJson(res, 200, provinces);
  } catch (error) {
    return sendJson(res, 500, {
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

