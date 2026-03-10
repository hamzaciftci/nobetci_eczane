import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import MainLayout from "@/components/MainLayout";
import CopyToClipboardButton from "@/components/CopyToClipboardButton";
import { provinces } from "@/lib/cities";
import { fetchDutyByProvince } from "@/lib/api";
import { toSlug } from "@/lib/slug";
import EczaneLogoIcon from "@/components/EczaneLogoIcon";

const BASE_URL = typeof window !== "undefined"
  ? window.location.origin
  : "https://nobetci-eczane-tau.vercel.app";

const DEFAULT_CITY = "istanbul";
const DEFAULT_HEIGHT = "240";

type DistrictOption = {
  slug: string;
  name: string;
};

export default function EmbedPage() {
  const sortedProvinces = useMemo(
    () => [...provinces].sort((a, b) => a.name.localeCompare(b.name, "tr-TR")),
    []
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCity = searchParams.get("il")?.toLowerCase() ?? DEFAULT_CITY;
  const initialCity = sortedProvinces.some((p) => p.slug === requestedCity) ? requestedCity : DEFAULT_CITY;
  const initialDistrict = searchParams.get("ilce")?.toLowerCase() ?? "";

  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const cityItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const province = sortedProvinces.find((p) => p.slug === selectedCity);

  const districtQuery = useQuery({
    queryKey: ["embed-districts", selectedCity],
    queryFn: () => fetchDutyByProvince(selectedCity),
    enabled: Boolean(selectedCity),
    staleTime: 1000 * 60 * 5,
  });

  const districts = useMemo<DistrictOption[]>(() => {
    const unique = new Map<string, string>();
    for (const item of districtQuery.data?.data ?? []) {
      const districtName = item.district?.trim();
      if (!districtName) {
        continue;
      }
      const slug = toSlug(districtName);
      if (!slug || unique.has(slug)) {
        continue;
      }
      unique.set(slug, districtName);
    }

    return Array.from(unique.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
  }, [districtQuery.data]);

  const selectedDistrictName = districts.find((d) => d.slug === selectedDistrict)?.name ?? null;
  const embedPath = selectedDistrict ? `/embed/${selectedCity}/${selectedDistrict}` : `/embed/${selectedCity}`;
  const detailPath = selectedDistrict ? `/il/${selectedCity}/${selectedDistrict}` : `/il/${selectedCity}`;

  const iframeCode = useMemo(() => {
    const safeHeight = /^\d+$/.test(height) ? height : DEFAULT_HEIGHT;
    return `<iframe src="${BASE_URL}${embedPath}" width="100%" height="${safeHeight}" style="border:none;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  }, [embedPath, height]);

  const updateParams = (city: string, districtSlug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("il", city);
    if (districtSlug) {
      next.set("ilce", districtSlug);
    } else {
      next.delete("ilce");
    }
    setSearchParams(next, { replace: true });
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    setSelectedDistrict("");
    updateParams(city, "");
  };

  const handleDistrictChange = (districtSlug: string) => {
    const normalized = districtSlug === "__all" ? "" : districtSlug;
    setSelectedDistrict(normalized);
    updateParams(selectedCity, normalized);
  };

  useEffect(() => {
    cityItemRefs.current[selectedCity]?.scrollIntoView({ block: "nearest" });
  }, [selectedCity]);

  return (
    <MainLayout>
      <div className="container py-10 md:py-14">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-center text-2xl font-bold text-foreground md:text-3xl">
            Sitene Nöbetçi Eczane Ekle
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground md:text-base">
            Sitenize bulunduğunuz ildeki güncel nöbetçi eczane listesini eklemek için önce şehir seçin,
            ardından oluşan iframe kodunu kopyalayıp sayfanıza yapıştırın.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm md:p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="embed-city" className="mb-2 block text-sm font-semibold text-foreground">
                    Şehir seçiniz
                  </label>
                  <select
                    id="embed-city"
                    value={selectedCity}
                    onChange={(event) => handleCityChange(event.target.value)}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary"
                  >
                    {sortedProvinces.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="embed-district" className="mb-2 block text-sm font-semibold text-foreground">
                    İlçe seçiniz
                  </label>
                  <select
                    id="embed-district"
                    value={selectedDistrict || "__all"}
                    onChange={(event) => handleDistrictChange(event.target.value)}
                    disabled={districtQuery.isLoading}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="__all">Tüm ilçeler</option>
                    {districts.map((district) => (
                      <option key={district.slug} value={district.slug}>{district.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="embed-height" className="mb-2 block text-sm font-semibold text-foreground">
                    İframe yükseklik (px)
                  </label>
                  <input
                    id="embed-height"
                    type="number"
                    min={160}
                    max={1200}
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary"
                  />
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-foreground">Sitenize eklemek için kod</p>
                <textarea
                  readOnly
                  value={iframeCode}
                  className="h-28 w-full resize-none rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-5 text-foreground"
                />
                <div className="mt-3 flex justify-end">
                  <CopyToClipboardButton text={iframeCode} />
                </div>
              </div>

              <div className="mt-7">
                <p className="text-sm font-semibold text-foreground">
                  Sitenizdeki Görünümü
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (liste içeriği güncel nöbet verisine göre değişir)
                  </span>
                </p>
                <div className="mt-3 max-w-[420px] overflow-hidden rounded border border-border bg-background">
                  <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <EczaneLogoIcon className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        {province?.name ?? selectedCity}
                        {selectedDistrictName ? ` / ${selectedDistrictName}` : ""}
                      </span>
                    </div>
                    <a
                      href={detailPath}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      Liste
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <iframe
                    title={`${province?.name ?? selectedCity} embed preview`}
                    src={`${BASE_URL}${embedPath}`}
                    width="100%"
                    height={height}
                    style={{ border: "none" }}
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-2 text-sm text-muted-foreground">
                <p>Nöbetçi eczaneler (Sitene Ekle) uygulamamız ücretsizdir ve reklam içermez.</p>
                <p>Web sitenizde sorun yaşarsanız iletişim sayfasından bize yazabilirsiniz.</p>
              </div>
            </section>

            <aside className="rounded-lg border border-border bg-card shadow-sm">
              <h2 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-foreground">
                Şehir Seç
              </h2>
              <div className="border-b border-border bg-muted/30 px-3 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {province?.name ?? selectedCity} İlçeleri
                </p>
                {districtQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">İlçeler yükleniyor...</p>
                ) : districts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Bu il için ilçe verisi bulunamadı.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => handleDistrictChange("__all")}
                      className={`rounded px-2 py-1 text-left text-xs transition ${
                        !selectedDistrict ? "bg-primary/15 font-semibold text-primary" : "hover:bg-background"
                      }`}
                    >
                      Tüm ilçeler
                    </button>
                    {districts.map((district) => (
                      <button
                        key={district.slug}
                        type="button"
                        onClick={() => handleDistrictChange(district.slug)}
                        className={`rounded px-2 py-1 text-left text-xs transition ${
                          selectedDistrict === district.slug
                            ? "bg-primary/15 font-semibold text-primary"
                            : "text-foreground hover:bg-background"
                        }`}
                      >
                        {district.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="max-h-[640px] overflow-auto p-1">
                {sortedProvinces.map((p) => {
                  const active = p.slug === selectedCity;
                  return (
                    <div
                      key={p.slug}
                      ref={(node) => {
                        cityItemRefs.current[p.slug] = node;
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleCityChange(p.slug)}
                        className={`block w-full border-b border-dashed border-border px-3 py-2 text-left text-sm transition ${
                          active ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted/60"
                        }`}
                      >
                        {p.name}
                      </button>
                      {active && districts.length > 0 && (
                        <div className="border-b border-dashed border-border bg-muted/30 px-2 py-2">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            İlçeler
                          </p>
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => handleDistrictChange("__all")}
                              className={`block w-full rounded px-2 py-1 text-left text-xs transition ${
                                !selectedDistrict ? "bg-primary/15 font-semibold text-primary" : "hover:bg-background"
                              }`}
                            >
                              Tüm ilçeler
                            </button>
                            {districts.map((district) => (
                              <button
                                key={district.slug}
                                type="button"
                                onClick={() => handleDistrictChange(district.slug)}
                                className={`block w-full rounded px-2 py-1 text-left text-xs transition ${
                                  selectedDistrict === district.slug
                                    ? "bg-primary/15 font-semibold text-primary"
                                    : "text-foreground hover:bg-background"
                                }`}
                              >
                                {district.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
