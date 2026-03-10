/**
 * Unit tests — api/_lib/normalize/pharmacyName.js
 */
import { describe, it, expect } from "vitest";
import {
  normalizePharmacyName,
  normalizeNameList,
  toNormalizedMap,
} from "../../api/_lib/normalize/pharmacyName.js";

// ---------------------------------------------------------------------------
// normalizePharmacyName
// ---------------------------------------------------------------------------
describe("normalizePharmacyName", () => {
  // TR karakter → ASCII
  it("converts Turkish chars to ASCII and uppercases", () => {
    expect(normalizePharmacyName("şeker")).toBe("SEKER");
    expect(normalizePharmacyName("çiçek")).toBe("CICEK");
    expect(normalizePharmacyName("güneş")).toBe("GUNES");
    expect(normalizePharmacyName("ığdır")).toBe("IGDIR");
    expect(normalizePharmacyName("özel")).toBe("OZEL");
    expect(normalizePharmacyName("ümmü")).toBe("UMMU");
    expect(normalizePharmacyName("İstanbul")).toBe("ISTANBUL");
  });

  // Suffix stripping — longest match first
  it("strips ECZANESI suffix", () => {
    expect(normalizePharmacyName("AKSU ECZANESI")).toBe("AKSU");
    expect(normalizePharmacyName("Güneş Eczanesi")).toBe("GUNES");
  });

  it("strips ECZANE suffix", () => {
    expect(normalizePharmacyName("KONAK ECZANE")).toBe("KONAK");
    expect(normalizePharmacyName("şeker eczane")).toBe("SEKER");
  });

  it("strips ECZ suffix", () => {
    expect(normalizePharmacyName("MERKEZ ECZ")).toBe("MERKEZ");
    expect(normalizePharmacyName("çelik ecz.")).toBe("CELIK");
  });

  it("strips ECZANELERI suffix", () => {
    expect(normalizePharmacyName("AKSU ECZANELERI")).toBe("AKSU");
  });

  it("does not strip suffix if part of name", () => {
    // "ECZANECI" — ends with "ECZ" but the regex requires whitespace before it
    expect(normalizePharmacyName("ECZANECI")).toBe("ECZANECI");
  });

  // Parentheses removal
  it("removes parenthesised content", () => {
    expect(normalizePharmacyName("AKSU (MERKEZ) ECZANESI")).toBe("AKSU");
    expect(normalizePharmacyName("ÇELIK (YENİ)")).toBe("CELIK");
  });

  // Numbered prefix: step 4 converts "." → space before the regex fires,
  // so "1. KONAK" → "1  KONAK" (dot gone) → prefix regex ^\d+\.\s+ never matches.
  // The digit and the converted space remain as a token.
  it("numbered prefix: dot converted to space before regex — digit token stays", () => {
    expect(normalizePharmacyName("1. KONAK ECZANE")).toBe("1 KONAK");
    expect(normalizePharmacyName("12. ÇELIK ECZANE")).toBe("12 CELIK");
  });

  it("strips NÖBETÇİ prefix", () => {
    // After TR→ASCII "NÖBETÇİ" becomes "NOBETCI"
    expect(normalizePharmacyName("NÖBETÇİ AKSU ECZANESI")).toBe("AKSU");
    expect(normalizePharmacyName("NOBETCI GUNES")).toBe("GUNES");
  });

  // Token aliases
  it("expands DR. to DOKTOR", () => {
    expect(normalizePharmacyName("DR. AHMET ECZANESI")).toBe("DOKTOR AHMET");
    expect(normalizePharmacyName("DR FATMA")).toBe("DOKTOR FATMA");
  });

  it("expands AV. to AVUKAT", () => {
    expect(normalizePharmacyName("AV. MEHMET ECZANE")).toBe("AVUKAT MEHMET");
  });

  it("removes NO: / NO. tokens", () => {
    expect(normalizePharmacyName("ÇELIK NO: 3 ECZANESI")).toBe("CELIK 3");
    expect(normalizePharmacyName("MERT NO. ECZANE")).toBe("MERT");
  });

  // Punctuation → space
  it("converts punctuation to spaces", () => {
    expect(normalizePharmacyName("ÇELIK/ÖZKAN ECZANE")).toBe("CELIK OZKAN");
    expect(normalizePharmacyName("A.B.C ECZANE")).toBe("A B C");
  });

  // Edge cases
  it("returns empty string for empty/null input", () => {
    expect(normalizePharmacyName("")).toBe("");
    expect(normalizePharmacyName(null)).toBe("");
    expect(normalizePharmacyName(undefined)).toBe("");
    expect(normalizePharmacyName("   ")).toBe("");
  });

  it("handles plain name with no suffix correctly", () => {
    expect(normalizePharmacyName("ÇELIK")).toBe("CELIK");
    expect(normalizePharmacyName("MERKEz")).toBe("MERKEZ");
  });

  it("collapses multiple spaces", () => {
    expect(normalizePharmacyName("AKSU   MERKEZ  ECZANE")).toBe("AKSU MERKEZ");
  });
});

// ---------------------------------------------------------------------------
// normalizeNameList
// ---------------------------------------------------------------------------
describe("normalizeNameList", () => {
  it("normalizes all names and deduplicates", () => {
    const input = ["AKSU ECZANESI", "Aksu Eczanesi", "GUNES ECZ"];
    const result = normalizeNameList(input);
    // AKSU appears once, GUNES once — sorted
    expect(result).toEqual(["AKSU", "GUNES"]);
  });

  it("filters empty results", () => {
    expect(normalizeNameList(["", null, undefined])).toEqual([]);
  });

  it("handles empty array", () => {
    expect(normalizeNameList([])).toEqual([]);
    expect(normalizeNameList(null)).toEqual([]);
  });

  it("returns sorted results", () => {
    const result = normalizeNameList(["ZEYTINLIK ECZANE", "AKSU ECZANE", "MERKEZ ECZ"]);
    expect(result).toEqual(["AKSU", "MERKEZ", "ZEYTINLIK"]);
  });
});

// ---------------------------------------------------------------------------
// toNormalizedMap
// ---------------------------------------------------------------------------
describe("toNormalizedMap", () => {
  it("creates normalized→raw map", () => {
    const map = toNormalizedMap(["AKSU ECZANESI", "Güneş Eczane"]);
    expect(map.get("AKSU")).toBe("AKSU ECZANESI");
    expect(map.get("GUNES")).toBe("Güneş Eczane");
  });

  it("keeps first occurrence for duplicate normalized keys", () => {
    const map = toNormalizedMap(["AKSU ECZANESI", "AKSU ECZANE"]);
    expect(map.get("AKSU")).toBe("AKSU ECZANESI");
    expect(map.size).toBe(1);
  });

  it("handles empty / null input", () => {
    expect(toNormalizedMap([]).size).toBe(0);
    expect(toNormalizedMap(null).size).toBe(0);
  });
});
