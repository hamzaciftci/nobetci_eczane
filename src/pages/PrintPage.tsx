import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDutyByDistrict, fetchDutyByProvince } from "@/lib/api";
import { formatDate, formatTimeAgo } from "@/lib/date";

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
  const latestUpdate = query.data?.son_guncelleme ?? pharmacies[0]?.lastUpdated ?? null;
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
    <div className="max-w-[210mm] mx-auto p-8 font-body text-foreground bg-background print:p-0 print:bg-white print:text-black">
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

      <header className="text-center mb-6 border-b-2 border-foreground/20 pb-4 print:border-black/30">
        <h1 className="font-display text-2xl font-bold mb-1">
          {districtName ? `${districtName}, ${cityName}` : cityName} Nobetci Eczaneler
        </h1>
        <p className="text-sm">{formatDate(now)}</p>
        <p className="text-xs text-muted-foreground mt-1 print:text-gray-600">
          {pharmacies.length} nobetci eczane · Olusturulma: {now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          {latestUpdate ? ` · Son veri: ${formatTimeAgo(latestUpdate)}` : ""}
        </p>
      </header>

      {pharmacies.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Bu secim icin aktif nobetci eczane kaydi bulunamadi.</p>
      ) : (
        <table className="w-full text-xs border-collapse print:text-[10pt]">
          <thead>
            <tr className="border-b-2 border-foreground/20 print:border-black/40">
              <th className="text-left py-2 font-bold w-[24%]">Eczane</th>
              <th className="text-left py-2 font-bold w-[37%]">Adres</th>
              <th className="text-left py-2 font-bold w-[16%]">Telefon</th>
              <th className="text-left py-2 font-bold w-[11%]">Ilce</th>
              <th className="text-left py-2 font-bold w-[12%]">Dogrulama</th>
            </tr>
          </thead>
          <tbody>
            {pharmacies.map((item, index) => (
              <tr
                key={item.id}
                className={`border-b border-border/50 print:border-gray-300 ${index % 2 === 1 ? "bg-muted/30 print:bg-gray-50" : ""}`}
              >
                <td className="py-2 pr-2 font-semibold align-top">
                  {item.name}
                  <div className="text-[10px] text-muted-foreground">{item.source}</div>
                </td>
                <td className="py-2 pr-2 align-top leading-relaxed">{item.address}</td>
                <td className="py-2 pr-2 whitespace-nowrap align-top font-mono">{item.phone}</td>
                <td className="py-2 align-top">{item.district}</td>
                <td className="py-2 align-top">{item.verificationCount} kaynak</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="mt-6 pt-3 border-t border-foreground/10 text-[9px] text-muted-foreground print:text-gray-500 print:border-gray-300">
        <div className="flex justify-between">
          <span>Kaynak: {pharmacies[0]?.source || "Eczaci Odasi"}</span>
          <span>Lutfen gitmeden once telefonla teyit edin.</span>
        </div>
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

