/**
 * Unit tests — api/_lib/matching/algorithms.js
 */
import { describe, it, expect } from "vitest";
import {
  levenshtein,
  levenshteinSimilarity,
  jaroWinkler,
  tokenSetRatio,
  bestSimilarity,
} from "../../api/_lib/matching/algorithms.js";

// ---------------------------------------------------------------------------
// levenshtein
// ---------------------------------------------------------------------------
describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("AKSU", "AKSU")).toBe(0);
    expect(levenshtein("", "")).toBe(0);
  });

  it("returns string length when one side is empty", () => {
    expect(levenshtein("AKSU", "")).toBe(4);
    expect(levenshtein("", "GUNES")).toBe(5);
  });

  it("computes single-char substitution", () => {
    expect(levenshtein("AKSU", "AKTU")).toBe(1);
  });

  it("computes insertion / deletion", () => {
    expect(levenshtein("AKSU", "AKSUU")).toBe(1);
    expect(levenshtein("MERKEZ", "MERKE")).toBe(1);
  });

  it("computes multi-operation distance", () => {
    // "kitten" → "sitting" = 3
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("is symmetric", () => {
    expect(levenshtein("BORNOVA", "BORNOVIA")).toBe(levenshtein("BORNOVIA", "BORNOVA"));
  });
});

// ---------------------------------------------------------------------------
// levenshteinSimilarity
// ---------------------------------------------------------------------------
describe("levenshteinSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(levenshteinSimilarity("AKSU", "AKSU")).toBe(1.0);
  });

  it("returns 1.0 for two empty strings", () => {
    expect(levenshteinSimilarity("", "")).toBe(1.0);
  });

  it("returns < 1.0 for different strings", () => {
    expect(levenshteinSimilarity("AKSU", "GUNES")).toBeLessThan(1.0);
  });

  it("returns a value in [0, 1]", () => {
    const s = levenshteinSimilarity("BORNOVA", "BUCA");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it("gives high score for single-char difference", () => {
    // "AKSU" vs "AKTU" → distance=1, maxLen=4 → sim=0.75
    expect(levenshteinSimilarity("AKSU", "AKTU")).toBeCloseTo(0.75);
  });
});

// ---------------------------------------------------------------------------
// jaroWinkler
// ---------------------------------------------------------------------------
describe("jaroWinkler", () => {
  it("returns 1.0 for identical strings", () => {
    expect(jaroWinkler("BORNOVA", "BORNOVA")).toBe(1.0);
  });

  it("returns 0.0 for completely different strings (no common chars)", () => {
    // Very short strings with no overlap
    expect(jaroWinkler("XZ", "QW")).toBe(0.0);
  });

  it("returns 0.0 for empty inputs", () => {
    expect(jaroWinkler("", "BORNOVA")).toBe(0.0);
    expect(jaroWinkler("BORNOVA", "")).toBe(0.0);
  });

  it("gives high similarity to close strings", () => {
    // "BORNOVA" vs "BORNOVAA" — one extra char at end
    const s = jaroWinkler("BORNOVA", "BORNOVAA");
    expect(s).toBeGreaterThan(0.85);
  });

  it("favors common prefix (Winkler bonus)", () => {
    const s1 = jaroWinkler("BORNOVA", "BORNOVAA");
    const s2 = jaroWinkler("BORNOVA", "AABORNOV");
    // Same characters but prefix bonus should favour s1
    expect(s1).toBeGreaterThan(s2);
  });

  it("returns value in [0, 1]", () => {
    const s = jaroWinkler("AKSU", "GUNES");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// tokenSetRatio
// ---------------------------------------------------------------------------
describe("tokenSetRatio", () => {
  it("returns 1.0 for identical strings", () => {
    expect(tokenSetRatio("AKSU MERKEZ", "AKSU MERKEZ")).toBe(1.0);
  });

  it("returns 0.0 for empty inputs", () => {
    expect(tokenSetRatio("", "AKSU")).toBe(0.0);
    expect(tokenSetRatio("AKSU", "")).toBe(0.0);
  });

  it("handles token order differences", () => {
    // "MERKEZ AKSU" vs "AKSU MERKEZ" — same tokens, different order
    const s = tokenSetRatio("MERKEZ AKSU", "AKSU MERKEZ");
    expect(s).toBeGreaterThan(0.9);
  });

  it("gives partial credit for subset tokens", () => {
    // "AKSU" vs "MERKEZ AKSU ECZANESI" — one common token
    const s = tokenSetRatio("AKSU", "AKSU MERKEZ");
    expect(s).toBeGreaterThan(0.7);
  });

  it("returns low score for completely different tokens", () => {
    const s = tokenSetRatio("KARADENIZ", "AKDENIZ");
    expect(s).toBeLessThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// bestSimilarity
// ---------------------------------------------------------------------------
describe("bestSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(bestSimilarity("AKSU", "AKSU")).toBe(1.0);
  });

  it("returns 0.0 for empty inputs", () => {
    expect(bestSimilarity("", "AKSU")).toBe(0.0);
    expect(bestSimilarity("AKSU", "")).toBe(0.0);
  });

  it("returns max of levenshtein, jaroWinkler, tokenSetRatio", () => {
    const s = bestSimilarity("BORNOVA", "BORNOVAA");
    const lev = levenshteinSimilarity("BORNOVA", "BORNOVAA");
    const jw  = jaroWinkler("BORNOVA", "BORNOVAA");
    const tsr = tokenSetRatio("BORNOVA", "BORNOVAA");
    expect(s).toBeCloseTo(Math.max(lev, jw, tsr), 5);
  });

  it("gives high score to token-reordered strings", () => {
    const s = bestSimilarity("MERKEZ AKSU", "AKSU MERKEZ");
    expect(s).toBeGreaterThan(0.9);
  });

  it("returns value in [0, 1]", () => {
    const s = bestSimilarity("KARADENIZ BORNOVA", "AKDENIZ BUCA");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
