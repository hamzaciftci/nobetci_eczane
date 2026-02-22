import { ConflictItem, SourceBatch, VerifiedRecord } from "./types";

interface CrossCheckInput {
  primaryBatch?: SourceBatch;
  secondaryBatch?: SourceBatch;
  secondaryExpected?: boolean;
}

interface CrossCheckOutput {
  records: VerifiedRecord[];
  conflicts: ConflictItem[];
}

export function crossCheck(input: CrossCheckInput): CrossCheckOutput {
  const primary = input.primaryBatch;
  const secondary = input.secondaryBatch;
  const secondaryExpected = input.secondaryExpected ?? true;

  if (!primary && !secondary) {
    return { records: [], conflicts: [] };
  }

  const primaryRecords = primary?.records ?? [];
  const secondaryRecords = secondary?.records ?? [];
  const secondaryMap = new Map(
    secondaryRecords.map((item) => [recordKey(item.dutyDate, item.districtSlug, item.normalizedName), item])
  );

  const records: VerifiedRecord[] = [];
  const conflicts: ConflictItem[] = [];

  for (const row of primaryRecords) {
    const key = recordKey(row.dutyDate, row.districtSlug, row.normalizedName);
    const sec = secondaryMap.get(key);

    const evidence = [
      {
        sourceName: primary!.source.sourceName,
        sourceUrl: primary!.source.sourceUrl,
        sourceType: primary!.source.sourceType,
        authorityWeight: primary!.source.authorityWeight,
        fetchedAt: row.fetchedAt
      }
    ];

    let confidence = baseScore(primary!.source.authorityWeight, row.fetchedAt);
    let verificationSourceCount = 1;

    if (sec && secondary) {
      evidence.push({
        sourceName: secondary.source.sourceName,
        sourceUrl: secondary.source.sourceUrl,
        sourceType: secondary.source.sourceType,
        authorityWeight: secondary.source.authorityWeight,
        fetchedAt: sec.fetchedAt
      });
      verificationSourceCount = 2;
      confidence += Math.round(baseScore(secondary.source.authorityWeight, sec.fetchedAt) * 0.35);

      if (row.phone !== sec.phone || row.address !== sec.address) {
        confidence -= 15;
        conflicts.push({
          provinceSlug: row.provinceSlug,
          districtSlug: row.districtSlug,
          dutyDate: row.dutyDate,
          reason: "field_mismatch",
          payload: {
            normalized_name: row.normalizedName,
            primary: { address: row.address, phone: row.phone },
            secondary: { address: sec.address, phone: sec.phone }
          }
        });
      }
    }

    const merged = sec && newerThan(sec.fetchedAt, row.fetchedAt) ? sec : row;
    records.push({
      provinceSlug: row.provinceSlug,
      districtName: merged.districtName,
      districtSlug: merged.districtSlug,
      pharmacyName: merged.pharmacyName,
      normalizedName: merged.normalizedName,
      address: merged.address,
      phone: merged.phone,
      lat: merged.lat,
      lng: merged.lng,
      dutyDate: merged.dutyDate,
      confidenceScore: clamp(confidence, 20, 100),
      verificationSourceCount,
      isDegraded: secondaryExpected && !sec,
      evidence
    });
  }

  if (!primary && secondary) {
    for (const row of secondary.records) {
      records.push({
        provinceSlug: row.provinceSlug,
        districtName: row.districtName,
        districtSlug: row.districtSlug,
        pharmacyName: row.pharmacyName,
        normalizedName: row.normalizedName,
        address: row.address,
        phone: row.phone,
        lat: row.lat,
        lng: row.lng,
        dutyDate: row.dutyDate,
        confidenceScore: clamp(baseScore(secondary.source.authorityWeight, row.fetchedAt), 20, 100),
        verificationSourceCount: 1,
        isDegraded: true,
        evidence: [
          {
            sourceName: secondary.source.sourceName,
            sourceUrl: secondary.source.sourceUrl,
            sourceType: secondary.source.sourceType,
            authorityWeight: secondary.source.authorityWeight,
            fetchedAt: row.fetchedAt
          }
        ]
      });
    }
  }

  return { records, conflicts };
}

function baseScore(authorityWeight: number, fetchedAt: string): number {
  const ageMinutes = Math.max((Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60), 0);
  const recencyScore = Math.max(0, 100 - ageMinutes);
  return Math.round(authorityWeight * 0.7 + recencyScore * 0.3);
}

function newerThan(left: string, right: string): boolean {
  return new Date(left).getTime() > new Date(right).getTime();
}

function recordKey(dutyDate: string, districtSlug: string, normalizedName: string): string {
  return `${dutyDate}:${districtSlug}:${normalizedName}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
