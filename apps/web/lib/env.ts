export function publicEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const cleaned = value.replace(/^\uFEFF/, "").trim();
  return cleaned.length ? cleaned : fallback;
}
