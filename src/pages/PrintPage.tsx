import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDutyByDistrict, fetchDutyByProvince } from "@/lib/api";
import { formatIsoDate, resolveActiveDutyDate } from "@/lib/date";

const PrintPage = () => {
  const { il, ilce } = useParams<{ il: string; ilce?: string }>();
  const query = useQuery({
    queryKey: ["print-duty", il, ilce],
    queryFn: () => (ilce ? fetchDutyByDistrict(il || "", ilce) : fetchDutyByProvince(il || "")),
    enabled: Boolean(il),
    staleTime: 1000 * 60
  });

  const pharmacies = query.data?.data ?? [];
  const cityName = pharmacies[0]?.city ?? titleFromSlug(il || "");
  const districtName = ilce ? pharmacies[0]?.district ?? titleFromSlug(ilce) : null;
  const now = new Date();
  const backHref = ilce ? `/il/${il}/${ilce}` : `/il/${il}`;

  if (query.isError) {
    return (
      <div className="p-8">
        <p className="text-destructive">Yazdirma verisi alinamadi.</p>
        <Link to={backHref} className="text-primary text-sm mt-2 inline-block">
          ← Geri
        </Link>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="max-w-[210mm] mx-auto p-8">
        <div className="h-6 w-48 rounded bg-muted animate-pulse mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-8 rounded bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[210mm] mx-auto p-6 font-body text-foreground bg-background print:p-2 print:bg-white print:text-black">
      <div className="no-print flex items-center gap-3 mb-6">
        <Link to={backHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          Geri
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Yazdir
        </button>
      </div>

      <header className="text-center mb-5 border-2 border-black p-4">
        <h1 className="font-display text-[28px] leading-tight font-black uppercase tracking-wide">
          {districtName ? `${districtName} / ${cityName}` : cityName}
        </h1>
        <p className="text-[20px] mt-1 font-semibold uppercase">Nobetci Eczaneler</p>
        <p className="text-sm mt-2">{formatIsoDate(resolveActiveDutyDate(now))}</p>
      </header>

      {pharmacies.length === 0 ? (
        <p className="text-base py-10 text-center border-2 border-black">
          Bu secim icin aktif nobetci eczane kaydi bulunamadi.
        </p>
      ) : (
        <div className="space-y-4">
          {pharmacies.map((item) => (
            <article key={item.id} className="border-2 border-black p-4 print:break-inside-avoid">
              <div className="border-b-2 border-black pb-2 mb-3 text-center">
                <h2 className="text-[34px] leading-none font-black uppercase">{item.name}</h2>
                <p className="text-[22px] mt-1 font-semibold uppercase">{item.district}</p>
              </div>
              <p className="text-[25px] leading-tight font-medium">{item.address}</p>
              <p className="text-[34px] leading-none font-black mt-4 tracking-wide">{item.phone}</p>
            </article>
          ))}
        </div>
      )}

      <footer className="mt-5 border-2 border-black p-3 text-[11px] text-center uppercase tracking-wide">
        Kaynak: {pharmacies[0]?.source || "Eczaci Odasi"} | Lutfen gitmeden once telefonla teyit edin.
      </footer>
    </div>
  );
};

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default PrintPage;

