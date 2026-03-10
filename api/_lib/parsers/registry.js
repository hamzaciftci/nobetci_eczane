/**
 * Parser Registry — merkezi parser dispatch sistemi.
 *
 * ingest.js içindeki if-else zincirini ortadan kaldırır.
 * Yeni bir parser eklemek için:
 *   1. api/_lib/parsers/ altına yeni parser dosyası ekle
 *   2. Bu dosyada registry.register(...) ile kaydet
 *
 * Dispatch öncelik sırası:
 *   1. Keyed parser (parserKey eşleşmesi) → rows döndürdüyse kullan
 *   2. Keyed parser boş döndüyse → auto-detection sırası dene
 *   3. Hiçbiri bulamazsa → []
 */

export class ParserRegistry {
  constructor() {
    /** @type {Map<string, import('./base.js').BaseParser>} */
    this._byKey = new Map();
    /** @type {import('./base.js').BaseParser[]} Probe sırası (kayıt sırasıyla) */
    this._autoDetect = [];
  }

  /**
   * @param {import('./base.js').BaseParser} parser
   * @param {{ autoDetect?: boolean }} [opts]
   *   autoDetect=true (varsayılan): keyed match başarısız olunca canParse probe'una dahil edilir.
   */
  register(parser, { autoDetect = true } = {}) {
    this._byKey.set(parser.key, parser);
    if (autoDetect) this._autoDetect.push(parser);
    return this;
  }

  /**
   * @param {string} parserKey  Kaynak endpoint'in parser_key değeri
   * @param {string} html
   * @returns {{ rows: import('./base.js').ParseResult[], usedKey: string, strategy: string }}
   */
  dispatch(parserKey, html) {
    if (!html) return { rows: [], usedKey: parserKey, strategy: "empty_html" };

    // 1. Keyed dispatch
    if (parserKey && parserKey !== "generic_auto_v1") {
      const namedParser = this._byKey.get(parserKey);
      if (namedParser) {
        try {
          const rows = namedParser.parse(html);
          if (rows.length) {
            return { rows, usedKey: namedParser.key, strategy: "keyed" };
          }
          // Named parser boş döndürdü → auto-detect'e düş, bunu logla
          console.warn(JSON.stringify({
            scope: "parser_registry",
            event: "keyed_empty_fallback_to_auto",
            parser_key: parserKey
          }));
        } catch (err) {
          console.error(JSON.stringify({
            scope: "parser_registry",
            event: "keyed_parser_threw",
            parser_key: parserKey,
            error: err.message
          }));
        }
      } else {
        // Kayıtlı parser yok → uyar ve auto-detect'e düş
        console.warn(JSON.stringify({
          scope: "parser_registry",
          event: "unknown_parser_key_fallback_to_auto",
          parser_key: parserKey
        }));
      }
    }

    // 2. Auto-detection: canParse probe sırası
    for (const parser of this._autoDetect) {
      try {
        if (!parser.canParse(html)) continue;
        const rows = parser.parse(html);
        if (rows.length >= 1) {
          return { rows, usedKey: parser.key, strategy: "auto" };
        }
      } catch {
        /* parser bozuksa sessizce atla, bir sonrakini dene */
      }
    }

    return { rows: [], usedKey: parserKey, strategy: "no_match" };
  }

  /** Tüm kayıtlı parser key'lerini döndürür (test ve debug için). */
  keys() {
    return [...this._byKey.keys()];
  }
}

// Singleton instance — tüm uygulama bu örneği kullanır
export const parserRegistry = new ParserRegistry();
