import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, ChevronRight } from "lucide-react";
import { provinces } from "@/lib/cities";
import { cn } from "@/lib/utils";

export default function CitySelector({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!query) return provinces.slice(0, 10);
    const q = query
      .toLowerCase()
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
      .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
    return provinces.filter((p) =>
      p.name.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .includes(q) || p.slug.includes(q)
    );
  }, [query]);

  const handleSelect = (slug: string) => {
    setOpen(false);
    setQuery("");
    navigate(`/il/${slug}`);
  };

  return (
    <div className={cn("relative w-full max-w-lg", className)}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="İl ara... (örn. İstanbul)"
          className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base text-foreground shadow-card outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-premium">
          <div className="max-h-72 overflow-y-auto p-1">
            {filtered.map((p) => (
              <button
                key={p.slug}
                onClick={() => handleSelect(p.slug)}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 font-medium text-foreground">{p.name}</span>
                {p.popular && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Popüler
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {open && query && filtered.length === 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-surface p-6 text-center shadow-premium">
          <p className="text-sm text-muted-foreground">Sonuç bulunamadı</p>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
