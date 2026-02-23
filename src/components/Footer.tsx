import { Link } from "react-router-dom";
import { Cross, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface no-print">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Cross className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-base font-bold text-foreground">Nöbetçi Eczane</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Türkiye genelinde nöbetçi eczane rehberi</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Veriler resmi eczacı odalarından alınmaktadır. Gitmeden önce telefonla
              arayın. Gece nöbetinde kapı kapalı olabilir, zil ile hizmet verilebilir.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Link to="/iletisim" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Yanlış bilgi bildir
            </Link>
            <Link to="/sitene-ekle" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Sitene ekle
            </Link>
            <Link to="/iletisim" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              İletişim
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nöbetçi Eczane · Bu bir kamu hizmeti projesidir. Bilgilerin doğruluğu garanti edilmez.
        </div>
      </div>
    </footer>
  );
}
