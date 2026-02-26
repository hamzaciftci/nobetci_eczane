import { fetchAnkaraRows } from "../api/_lib/ingest/fetchLayer.js";

const result = await fetchAnkaraRows("https://www.aeo.org.tr/nobetci-eczaneler");
console.log("Rows:", result.rows.length, "  Error:", result.error, "  HTTP:", result.httpStatus);
if (result.rows.length > 0) {
  result.rows.slice(0, 5).forEach(r => console.log(" -", r.name, "|", r.district, "|", r.phone));
}
