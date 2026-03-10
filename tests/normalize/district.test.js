/**
 * Unit tests — api/_lib/normalize/district.js
 */
import { describe, it, expect } from "vitest";
import {
  normalizeDistrictName,
  resolveDistrictWithConfidence,
  resolveDistrictId,
} from "../../api/_lib/normalize/district.js";

// ---------------------------------------------------------------------------
// normalizeDistrictName
// ---------------------------------------------------------------------------
describe("normalizeDistrictName", () => {
  it("converts TR chars to ASCII lowercase", () => {
    expect(normalizeDistrictName("İZMİR")).toBe("izmir");
    expect(normalizeDistrictName("Şişli")).toBe("sisli");
    expect(normalizeDistrictName("ÜSKÜDAR")).toBe("uskudar");
  });

  it("strips ILCESI suffix", () => {
    expect(normalizeDistrictName("Merkez İlçesi")).toBe("merkez");
    expect(normalizeDistrictName("KONAK ILCESI")).toBe("konak");
  });

  it("strips MERKEZI suffix", () => {
    expect(normalizeDistrictName("Bakırköy Merkezi")).toBe("bakirkoy");
  });

  it("strips BELEDIYESI suffix", () => {
    expect(normalizeDistrictName("Bornova Belediyesi")).toBe("bornova");
  });

  it("strips BELDESI suffix", () => {
    expect(normalizeDistrictName("Karacabey Beldesi")).toBe("karacabey");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeDistrictName("  BUCA   ")).toBe("buca");
  });

  it("returns empty string for empty/null input", () => {
    expect(normalizeDistrictName("")).toBe("");
    expect(normalizeDistrictName(null)).toBe("");
    expect(normalizeDistrictName(undefined)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

/** Minimal district list simulating an İzmir province. */
const IZMIR_DISTRICTS = [
  { id: 1,  name: "Bornova",   slug: "bornova"   },
  { id: 2,  name: "Buca",      slug: "buca"       },
  { id: 3,  name: "Konak",     slug: "konak"      },
  { id: 4,  name: "Karşıyaka", slug: "karsiyaka"  },
  { id: 5,  name: "Merkez",    slug: "merkez"     },
  { id: 6,  name: "Çiğli",     slug: "cigli"      },
];

// ---------------------------------------------------------------------------
// resolveDistrictWithConfidence
// ---------------------------------------------------------------------------
describe("resolveDistrictWithConfidence — Level 1: exact slug", () => {
  it("returns exact when slug matches", () => {
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "bornova");
    expect(r).toEqual({ id: 1, confidence: "exact" });
  });

  it("returns exact for slug-friendlified input", () => {
    // slugify("Karşıyaka") → "karsiyaka"
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "Karşıyaka");
    expect(r.confidence).toBe("exact");
    expect(r.id).toBe(4);
  });
});

describe("resolveDistrictWithConfidence — Level 2: normalized text", () => {
  it("matches via normalized text when slug differs", () => {
    // "Bornova Belediyesi" normalizes → "bornova" which matches district.name normalized
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "Bornova Belediyesi");
    expect(r.confidence).toBe("normalized");
    expect(r.id).toBe(1);
  });

  it("handles TR char differences in district names", () => {
    // "Cigli" normalizes → "cigli" — same as slugify("Çiğli")
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "Cigli");
    // Could be exact slug match; either way id must be 6
    expect(r.id).toBe(6);
    expect(["exact", "normalized"]).toContain(r.confidence);
  });
});

describe("resolveDistrictWithConfidence — Level 3: alias lookup", () => {
  it("resolves 'Merkez İlçe' alias to merkez slug", () => {
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "Merkez İlçe");
    // normalizeDistrictName("Merkez İlçe") → "merkez ilce" → DISTRICT_ALIASES["merkez ilce"] → "merkez"
    expect(r.confidence).toBe("alias");
    expect(r.id).toBe(5);
  });

  it("'İl Merkezi' strips suffix to 'il' — does not match alias, falls to fallback", () => {
    // normalizeDistrictName("İl Merkezi") strips "merkezi" suffix → "il"
    // DISTRICT_ALIASES["il"] is not defined, so alias lookup misses.
    // Jaro-Winkler("il", ...) < 0.85 (too short / no match) → fallback.
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "İl Merkezi");
    expect(r.confidence).toBe("fallback");
    expect(r.id).toBe(5); // merkez fallback
  });
});

describe("resolveDistrictWithConfidence — Level 4: fuzzy Jaro-Winkler", () => {
  it("fuzzy-matches a slightly misspelled district name", () => {
    // "Bornovaa" is close enough to "bornova" (JW > 0.85)
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "Bornovaa");
    expect(r.confidence).toBe("fuzzy");
    expect(r.id).toBe(1);
  });

  it("does NOT fuzzy-match a completely different name", () => {
    // "XYZXYZ" should fall through to fallback, not fuzzy
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "XYZXYZ");
    expect(r.confidence).toBe("fallback");
  });

  it("skips fuzzy for short strings (< 4 chars)", () => {
    // "bor" is 3 chars — falls straight to fallback
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "bor");
    expect(r.confidence).toBe("fallback");
  });
});

describe("resolveDistrictWithConfidence — Level 5: fallback", () => {
  it("falls back to merkez district when no match", () => {
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "bilinmeyen yer");
    expect(r.confidence).toBe("fallback");
    expect(r.id).toBe(5); // merkez slug
  });

  it("returns fallback for empty rawDistrict", () => {
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "");
    expect(r.confidence).toBe("fallback");
  });

  it("returns none when allowMerkezFallback=false and no match", () => {
    const r = resolveDistrictWithConfidence(IZMIR_DISTRICTS, "bilinmeyen yer", { allowMerkezFallback: false });
    expect(r.confidence).toBe("none");
    expect(r.id).toBeNull();
  });

  it("returns none when districts array is empty", () => {
    const r = resolveDistrictWithConfidence([], "bornova");
    expect(r).toEqual({ id: null, confidence: "none" });
  });
});

// ---------------------------------------------------------------------------
// resolveDistrictId (backward-compat wrapper)
// ---------------------------------------------------------------------------
describe("resolveDistrictId", () => {
  it("returns the id of matched district", () => {
    expect(resolveDistrictId(IZMIR_DISTRICTS, "bornova")).toBe(1);
    expect(resolveDistrictId(IZMIR_DISTRICTS, "buca")).toBe(2);
  });

  it("returns merkez id as fallback", () => {
    expect(resolveDistrictId(IZMIR_DISTRICTS, "bilinmeyen")).toBe(5);
  });

  it("returns null when no districts", () => {
    expect(resolveDistrictId([], "bornova")).toBeNull();
  });
});
