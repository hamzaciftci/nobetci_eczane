import { withDb } from "./_lib/db.js";
import { methodNotAllowed, parseJsonBody, sendInternalError, sendJson } from "./_lib/http.js";
import { slugify } from "./_lib/slug.js";

const ALLOWED_ISSUES = new Set(["telefon_yanlis", "adres_yanlis", "nobette_degil", "kapali", "diger"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const body = await parseJsonBody(req);
  const il = String(body.il || "").trim();
  const ilce = String(body.ilce || "").trim();
  const eczaneAdi = String(body.eczane_adi || "").trim();
  const sorunTuru = String(body.sorun_turu || "").trim();
  const notText = typeof body.not === "string" ? body.not.trim().slice(0, 1000) : "";
  const iletisimIzni = Boolean(body.iletisim_izni);

  if (il.length < 2 || eczaneAdi.length < 2 || !ALLOWED_ISSUES.has(sorunTuru)) {
    return sendJson(res, 400, { error: "invalid_payload" });
  }

  try {
    const result = await withDb(async (db) => {
      const provinceRows = await db`
        select id
        from provinces
        where slug = ${slugify(il)}
        limit 1
      `;
      if (!provinceRows.length) {
        throw new Error("province_not_found");
      }

      let districtId = null;
      if (ilce) {
        const districtRows = await db`
          select id
          from districts
          where province_id = ${provinceRows[0].id}
            and slug = ${slugify(ilce)}
          limit 1
        `;
        districtId = districtRows[0]?.id ?? null;
      }

      const insertRows = await db`
        insert into correction_reports (
          province_id,
          district_id,
          eczane_adi,
          sorun_turu,
          not_text,
          iletisim_izni
        )
        values (
          ${provinceRows[0].id},
          ${districtId},
          ${eczaneAdi},
          ${sorunTuru},
          ${notText || null},
          ${iletisimIzni}
        )
        returning id
      `;

      return insertRows[0];
    });

    return sendJson(res, 200, {
      id: String(result.id),
      status: "received"
    });
  } catch (error) {
    if (error instanceof Error && error.message === "province_not_found") {
      return sendJson(res, 400, { error: "unknown_province" });
    }
    return sendInternalError(res, error);
  }
}

