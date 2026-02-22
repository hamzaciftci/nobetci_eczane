import {
  normalizeAddress,
  normalizeCompareKey,
  normalizePharmacyName,
  normalizeTime
} from "./hybrid-normalization";

export type MismatchType = "ADDED" | "REMOVED" | "TIME_MISMATCH" | "ADDRESS_MISMATCH";

export interface HybridFlatRecord {
  province: string;
  provinceSlug: string;
  district: string;
  districtSlug: string;
  pharmacyName: string;
  address: string;
  dutyHours: string | null;
}

export interface MismatchItem {
  province: string;
  provinceSlug: string;
  district: string;
  districtSlug: string;
  pharmacyName: string;
  type: MismatchType;
  sourceValue: string | null;
  projectValue: string | null;
}

export interface DiffResult {
  added: MismatchItem[];
  removed: MismatchItem[];
  timeMismatches: MismatchItem[];
  addressMismatches: MismatchItem[];
}

export function buildHybridDiff(previous: HybridFlatRecord[], next: HybridFlatRecord[]): DiffResult {
  const previousMap = new Map(previous.map((row) => [recordKey(row), row]));
  const nextMap = new Map(next.map((row) => [recordKey(row), row]));

  const added: MismatchItem[] = [];
  const removed: MismatchItem[] = [];
  const timeMismatches: MismatchItem[] = [];
  const addressMismatches: MismatchItem[] = [];

  for (const [key, nextRow] of nextMap.entries()) {
    const prevRow = previousMap.get(key);
    if (!prevRow) {
      added.push(
        mismatch("ADDED", nextRow, {
          sourceValue: nextRow.address,
          projectValue: null
        })
      );
      continue;
    }

    const prevAddress = normalizeAddress(prevRow.address);
    const nextAddress = normalizeAddress(nextRow.address);
    if (prevAddress !== nextAddress) {
      addressMismatches.push(
        mismatch("ADDRESS_MISMATCH", nextRow, {
          sourceValue: nextRow.address,
          projectValue: prevRow.address
        })
      );
    }

    const prevTime = normalizeTime(prevRow.dutyHours ?? "");
    const nextTime = normalizeTime(nextRow.dutyHours ?? "");
    if ((prevTime || nextTime) && prevTime !== nextTime) {
      timeMismatches.push(
        mismatch("TIME_MISMATCH", nextRow, {
          sourceValue: nextRow.dutyHours,
          projectValue: prevRow.dutyHours
        })
      );
    }
  }

  for (const [key, prevRow] of previousMap.entries()) {
    if (nextMap.has(key)) {
      continue;
    }
    removed.push(
      mismatch("REMOVED", prevRow, {
        sourceValue: null,
        projectValue: prevRow.address
      })
    );
  }

  return {
    added,
    removed,
    timeMismatches,
    addressMismatches
  };
}

function recordKey(row: HybridFlatRecord): string {
  return [
    normalizeCompareKey(row.provinceSlug),
    normalizeCompareKey(row.districtSlug),
    normalizeCompareKey(normalizePharmacyName(row.pharmacyName))
  ].join(":");
}

function mismatch(
  type: MismatchType,
  row: HybridFlatRecord,
  values: { sourceValue: string | null; projectValue: string | null }
): MismatchItem {
  return {
    province: row.province,
    provinceSlug: row.provinceSlug,
    district: row.district,
    districtSlug: row.districtSlug,
    pharmacyName: row.pharmacyName,
    type,
    sourceValue: values.sourceValue,
    projectValue: values.projectValue
  };
}
