import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Code, Phone, ExternalLink, Cross } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import MainLayout from "@/components/MainLayout";
import CopyToClipboardButton from "@/components/CopyToClipboardButton";
import { provinces } from "@/lib/cities";

const BASE_URL = typeof window !== "undefined"
  ? window.location.origin
  : "https://nobetci-eczane-tau.vercel.app";

export default function EmbedPage() {
  const [selectedCity, setSelectedCity] = useState("istanbul");
  const province = provinces.find((p) => p.slug === selectedCity);

  const iframeCode = `<iframe\n  src="${BASE_URL}/embed/${selectedCity}"\n  width="100%"\n  height="500"\n  style="border:none;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.08);">\n</iframe>`;

  const scriptCode = `<script src="${BASE_URL}/widget.js" async></script>\n<div id="nobetci-eczane-widget" data-il="${selectedCity}"></div>`;

  return (
    <MainLayout>
      <div className="container py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 text-center"
          >
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">
              Sitene Nöbetçi Eczane Ekle
            </h1>
            <p className="mt-3 text-muted-foreground">
              Kendi web sitende bulunduğun il için güncel nöbetçi eczane listesini gösterebilirsin.
              Aşağıdaki kodu kopyalayıp sitene yapıştırman yeterli.
            </p>
          </motion.div>

          {/* City selector */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <label className="mb-2 block text-sm font-medium text-foreground">İl Seçimi</label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="h-12 w-full max-w-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {provinces.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          {/* Iframe embed */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-card-foreground">Iframe Embed</h2>
            </div>
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs text-foreground">
                <code>{iframeCode}</code>
              </pre>
              <div className="mt-3 flex justify-end">
                <CopyToClipboardButton text={iframeCode} />
              </div>
            </div>
          </motion.div>

          {/* Script widget */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <div className="mb-4 flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-card-foreground">Script Widget</h2>
            </div>
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs text-foreground">
                <code>{scriptCode}</code>
              </pre>
              <div className="mt-3 flex justify-end">
                <CopyToClipboardButton text={scriptCode} />
              </div>
            </div>
          </motion.div>

          {/* Widget preview */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h2 className="mb-4 text-lg font-semibold text-foreground">Widget Önizleme</h2>
            <div className="overflow-hidden rounded-2xl border border-border shadow-card">
              <div className="flex items-center justify-between bg-primary px-5 py-3">
                <div className="flex items-center gap-2">
                  <Cross className="h-4 w-4 text-primary-foreground" />
                  <span className="text-sm font-semibold text-primary-foreground">
                    {province?.name} Nöbetçi Eczaneler
                  </span>
                </div>
                <span className="text-[10px] text-primary-foreground/70">
                  powered by Nöbetçi Eczane
                </span>
              </div>
              <div className="divide-y divide-border bg-card">
                {[
                  { name: "Hayat Eczanesi", address: "Bağdat Cad. No:123", phone: "0216 345 67 89" },
                  { name: "Sağlık Eczanesi", address: "İstiklal Cad. No:45", phone: "0212 243 56 78" },
                  { name: "Güven Eczanesi", address: "Atatürk Bulvarı No:89", phone: "0212 523 45 67" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.address}</p>
                    </div>
                    <a
                      href={`tel:${item.phone}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {item.phone}
                    </a>
                  </div>
                ))}
              </div>
              <div className="border-t border-border bg-muted/50 px-5 py-2.5 text-center">
                <a
                  href={`/il/${selectedCity}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Detayları görüntüle
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}
