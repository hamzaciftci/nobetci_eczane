/**
 * Parser Registry — kayıt merkezi.
 *
 * Tüm parser'ları registry'ye kaydeder ve dışarıya açar.
 * ingest.js ve parserLayer.js bu modülü kullanır.
 *
 * Yeni parser eklemek:
 *   1. api/_lib/parsers/ altında yeni dosya oluştur
 *   2. Burada registry.register() ile kaydet
 */
import { parserRegistry } from "./registry.js";
import { tableParser }      from "./tableParser.js";
import { inlineBoxParser }  from "./inlineBoxParser.js";
import { cardParser }       from "./cardParser.js";
import {
  antalyaParser,
  osmaniyeParser,
  teknoEczaV1Parser,
  teknoEczaV2Parser,
  yandexParser,
  iconUserMdParser,
  eczaneIsmiParser,
  trendItemParser,
  karamanParser,
  konyaV1Parser,
} from "./specialParsers.js";

// ─── Auto-detection sırası (güvenilirlik → özel parser'lar önce) ──────────────
// Özel parser'lar güçlü canParse probe'larına sahip → önce kayıt et
parserRegistry.register(osmaniyeParser);    // "nobet-kart" kesin bir sinyal
parserRegistry.register(antalyaParser);     // "nobetciDiv" kesin
parserRegistry.register(konyaV1Parser);     // "baslik_eczane" kesin
parserRegistry.register(karamanParser);     // "vatan_hl" + "icon-home" birlikte
parserRegistry.register(yandexParser);      // "ymaps.Placemark" + "balloonContent"
parserRegistry.register(inlineBoxParser);   // data-name + data-district
parserRegistry.register(teknoEczaV2Parser); // href="nobetci-eczaneler"
parserRegistry.register(teknoEczaV1Parser); // "Nöbetçi Eczane" title
parserRegistry.register(eczaneIsmiParser);  // "eczaneismi"
parserRegistry.register(trendItemParser);   // "trend-item"
parserRegistry.register(iconUserMdParser);  // "icon-user-md"
parserRegistry.register(tableParser);       // Generic table — en sona

// ─── Ek keyed alias'lar (parserKey → parser eşlemesi) ────────────────────────
// DB'de farklı parser_key kullanılan iller için alias kayıtları.
// canParse=false olan wrapper'larla registry'ye doğrudan eklenir.
const keyedAliases = [
  { key: "adana_secondary_v1",  parser: tableParser },
  { key: "generic_auto_v1",     parser: null },   // null → auto-detect devreye girer
  { key: "hatay_v1",            parser: yandexParser },
  { key: "isparta_v1",          parser: trendItemParser },
  { key: "amasya_v1",           parser: eczaneIsmiParser },
  { key: "nigde_v1",            parser: teknoEczaV1Parser },
  { key: "aydin_v1",            parser: teknoEczaV2Parser },
];

// Alias'ları key-only olarak (autoDetect=false) kaydet.
// Bu sayede parserKey eşleşmesi olduğunda doğrudan ilgili parser çağrılır,
// ama auto-detection sırasına eklenmez (yukarıda zaten var).
for (const { key, parser } of keyedAliases) {
  if (!parser) continue;
  // Wrap: sadece key'i değiştir, canParse/parse orijinalden gelsin
  const aliasParser = Object.create(parser);
  Object.defineProperty(aliasParser, "key", { get: () => key });
  parserRegistry.register(aliasParser, { autoDetect: false });
}

export { parserRegistry };
export {
  tableParser, inlineBoxParser, cardParser,
  antalyaParser, osmaniyeParser, teknoEczaV1Parser, teknoEczaV2Parser,
  yandexParser, iconUserMdParser, eczaneIsmiParser, trendItemParser,
  karamanParser, konyaV1Parser,
};
