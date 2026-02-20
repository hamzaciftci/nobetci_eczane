import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { fetchProvinces } from "../../lib/api";

interface Props {
  params: Promise<{ legacySlug: string }>;
}

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: {
      index: false,
      follow: false
    }
  };
}

export default async function LegacyNobetciRedirectPage({ params }: Props) {
  const { legacySlug } = await params;
  const resolved = await resolveLegacySlug(legacySlug);
  if (!resolved) {
    notFound();
  }

  if (resolved.ilce) {
    permanentRedirect(`/nobetci-eczane/${resolved.il}/${resolved.ilce}`);
  }

  permanentRedirect(`/nobetci-eczane/${resolved.il}`);
}

async function resolveLegacySlug(
  legacySlug: string
): Promise<{ il: string; ilce?: string } | null> {
  if (!legacySlug.startsWith("nobetci-")) {
    return null;
  }

  const raw = legacySlug.slice("nobetci-".length).trim();
  if (!raw) {
    return null;
  }

  const provinces = await fetchProvinces();
  const sortedProvinceSlugs = provinces
    .map((item) => item.slug)
    .sort((a, b) => b.length - a.length);

  for (const provinceSlug of sortedProvinceSlugs) {
    if (raw === provinceSlug) {
      return { il: provinceSlug };
    }

    const prefix = `${provinceSlug}-`;
    if (raw.startsWith(prefix)) {
      const ilce = raw.slice(prefix.length).trim();
      if (!ilce) {
        return { il: provinceSlug };
      }
      return { il: provinceSlug, ilce };
    }
  }

  return null;
}
