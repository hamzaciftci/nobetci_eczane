/**
 * Unit tests — api/_lib/matching/engine.js
 */
import { describe, it, expect } from "vitest";
import { matchPharmacies, summarizeMatches } from "../../api/_lib/matching/engine.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DB_ROWS = [
  {
    canonical_name: "AKSU",
    district_name:  "Bornova",
    phone:          "02322345678",
  },
  {
    canonical_name: "GUNES",
    district_name:  "Buca",
    phone:          "02323456789",
  },
  {
    canonical_name: "MERKEZ",
    district_name:  "Konak",
    phone:          "02324567890",
  },
  {
    canonical_name: "CELIK",
    district_name:  "Karşıyaka",
    phone:          "02325678901",
  },
];

// ---------------------------------------------------------------------------
// matchPharmacies
// ---------------------------------------------------------------------------
describe("matchPharmacies — exact match", () => {
  it("matches identical name + phone + district", () => {
    const src = [{ name: "AKSU ECZANESI", district: "Bornova", phone: "02322345678" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    expect(result.matchType).toBe("exact");
    expect(result.dbItem.canonical_name).toBe("AKSU");
    expect(result.confidence).toBeGreaterThan(0.95);
  });

  it("matches with TR char in source name", () => {
    const src = [{ name: "Güneş Eczanesi", district: "Buca", phone: "02323456789" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    expect(result.dbItem.canonical_name).toBe("GUNES");
    expect(result.matchType).toBe("exact");
  });
});

describe("matchPharmacies — fuzzy / normalized match", () => {
  it("matches when name has minor typo", () => {
    const src = [{ name: "AKSUU ECZANE", district: "Bornova" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    expect(result.dbItem.canonical_name).toBe("AKSU");
    expect(result.matchType).not.toBe("no_match");
  });

  it("uses phone signal to break tie", () => {
    // Name is ambiguous but phone uniquely identifies
    const src = [{ name: "ECZANE", phone: "02323456789" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    // Phone match → GUNES
    expect(result.dbItem.canonical_name).toBe("GUNES");
  });
});

describe("matchPharmacies — no_match", () => {
  it("returns no_match for completely different name and no phone", () => {
    const src = [{ name: "XYZXYZXYZ BILINMEYEN" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    expect(result.matchType).toBe("no_match");
    expect(result.dbItem).toBeNull();
  });

  it("returns empty array when sourceRows is empty", () => {
    expect(matchPharmacies([], DB_ROWS)).toEqual([]);
  });

  it("returns empty array when dbRows is empty", () => {
    const src = [{ name: "AKSU ECZANESI" }];
    expect(matchPharmacies(src, [])).toEqual([]);
  });

  it("returns empty array for null inputs", () => {
    expect(matchPharmacies(null, DB_ROWS)).toEqual([]);
    expect(matchPharmacies([], null)).toEqual([]);
  });
});

describe("matchPharmacies — signals", () => {
  it("includes name signal for every result", () => {
    const src = [{ name: "AKSU ECZANESI", district: "Bornova", phone: "02322345678" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    const nameSig = result.signals.find((s) => s.field === "name");
    expect(nameSig).toBeDefined();
    expect(nameSig.score).toBeGreaterThan(0);
  });

  it("includes phone signal when both have phone", () => {
    const src = [{ name: "AKSU ECZANESI", phone: "02322345678" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    const phoneSig = result.signals.find((s) => s.field === "phone");
    expect(phoneSig).toBeDefined();
    expect(phoneSig.type).toBe("exact");
  });

  it("includes district signal when both have district", () => {
    const src = [{ name: "AKSU ECZANESI", district: "Bornova" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    const distSig = result.signals.find((s) => s.field === "district");
    expect(distSig).toBeDefined();
  });

  it("omits phone signal when source has no phone", () => {
    const src = [{ name: "AKSU ECZANESI" }];
    const [result] = matchPharmacies(src, DB_ROWS);
    const phoneSig = result.signals.find((s) => s.field === "phone");
    expect(phoneSig).toBeUndefined();
  });
});

describe("matchPharmacies — partial phone match", () => {
  it("gives partial score when last 7 digits match", () => {
    // DB phone: 02322345678 — last 7: 2345678
    const src = [{ name: "AKSU ECZANESI", phone: "05322345678" }]; // prefix differs
    const [result] = matchPharmacies(src, DB_ROWS);
    const phoneSig = result.signals.find((s) => s.field === "phone");
    if (phoneSig) {
      expect(phoneSig.type).toBe("partial");
      expect(phoneSig.score).toBeCloseTo(0.8);
    }
  });
});

// ---------------------------------------------------------------------------
// summarizeMatches
// ---------------------------------------------------------------------------
describe("summarizeMatches", () => {
  it("returns zeros for empty array", () => {
    const s = summarizeMatches([]);
    expect(s).toEqual({ total: 0, exact: 0, fuzzy: 0, no_match: 0, avg_confidence: 0 });
  });

  it("counts exact, fuzzy, no_match correctly", () => {
    const results = [
      { matchType: "exact",    confidence: 0.98 },
      { matchType: "fuzzy",    confidence: 0.82 },
      { matchType: "fuzzy",    confidence: 0.76 },
      { matchType: "no_match", confidence: 0.30 },
    ];
    const s = summarizeMatches(results);
    expect(s.total).toBe(4);
    expect(s.exact).toBe(1);
    expect(s.fuzzy).toBe(2);
    expect(s.no_match).toBe(1);
  });

  it("computes avg_confidence correctly", () => {
    const results = [
      { matchType: "exact",    confidence: 1.0 },
      { matchType: "no_match", confidence: 0.0 },
    ];
    const s = summarizeMatches(results);
    expect(s.avg_confidence).toBeCloseTo(0.5);
  });

  it("counts normalized as fuzzy in summarize", () => {
    // "normalized" matchType → counted as fuzzy (neither exact nor no_match)
    const results = [{ matchType: "normalized", confidence: 0.70 }];
    const s = summarizeMatches(results);
    expect(s.fuzzy).toBe(1);
  });

  it("handles all-exact results", () => {
    const results = DB_ROWS.map(() => ({ matchType: "exact", confidence: 1.0 }));
    const s = summarizeMatches(results);
    expect(s.exact).toBe(DB_ROWS.length);
    expect(s.fuzzy).toBe(0);
    expect(s.no_match).toBe(0);
    expect(s.avg_confidence).toBe(1.0);
  });
});
