import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { CityPageClient } from "./CityPageClient";
import { SchemaMarkup } from "@/app/components/SchemaMarkup";
import { getCityDuty } from "@/app/lib/duty";
import { cityMeta } from "@/app/lib/meta";
import { getProvinceName, provinces } from "@/app/lib/provinces";
import { getToday } from "@/app/lib/date";
import { breadcrumbSchema } from "@/app/lib/schema";

export const revalidate = 3600;

export function generateStaticParams() {
  return provinces.map((p) => ({ il: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ il: string }>;
}): Promise<Metadata> {
  const { il } = await params;
  return cityMeta(il);
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ il: string }>;
}) {
  const { il } = await params;

  if (!provinces.find((p) => p.slug === il)) notFound();

  const ilName = getProvinceName(il);
  const { ddmmyyyy } = getToday();
  const pharmacies = await getCityDuty(il);

  const breadcrumbs = [
    { name: "Türkiye", href: "/" },
    { name: `${ilName} Nöbetçi Eczane`, href: `/nobetci-eczane/${il}` },
  ];

  return (
    <div className="container py-8 md:py-12">
      <SchemaMarkup schemas={[breadcrumbSchema(breadcrumbs)]} />

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-primary">
          Türkiye
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{ilName}</span>
      </nav>

      <CityPageClient
        pharmacies={pharmacies}
        ilSlug={il}
        ilName={ilName}
        ddmmyyyy={ddmmyyyy}
      />
    </div>
  );
}
