import { hasDatabase } from "./_lib/db.js";
import { methodNotAllowed, sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  return sendJson(res, 200, {
    ok: true,
    database_configured: hasDatabase(),
    now: new Date().toISOString()
  });
}

