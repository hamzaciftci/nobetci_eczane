export function envValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const cleaned = value.replace(/^\uFEFF/, "").trim();
  return cleaned.length ? cleaned : undefined;
}
