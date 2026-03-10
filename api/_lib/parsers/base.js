/**
 * Parser base — tüm parser adapter'ların uyması gereken interface.
 *
 * Her parser:
 *   - key: benzersiz string tanımlayıcı (parserKey ile eşleşmeli)
 *   - canParse(html): içeriğe bakarak bu parser'ın uygun olup olmadığına karar verir
 *   - parse(html): ParseResult[] döndürür, exception fırlatmaz
 */

/** @typedef {{ name: string, district: string, address: string, phone: string, lat?: number, lng?: number }} ParseResult */

export class BaseParser {
  /** @type {string} */
  get key() { throw new Error("key getter must be implemented"); }

  /**
   * İçerik probe: bu parser bu HTML'i parse edebilir mi?
   * @param {string} _html
   * @returns {boolean}
   */
  // eslint-disable-next-line no-unused-vars
  canParse(_html) { return false; }

  /**
   * Ana parse metodu. Asla exception fırlatmamalı.
   * @param {string} _html
   * @returns {ParseResult[]}
   */
  // eslint-disable-next-line no-unused-vars
  parse(_html) { return []; }
}
