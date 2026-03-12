"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, Send, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";
type SorunTuru = "telefon_yanlis" | "adres_yanlis" | "nobette_degil" | "kapali" | "diger";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (form: FormData) => {
    const errs: Record<string, string> = {};
    if (!form.get("eczane_adi")) errs.eczane_adi = "Eczane adı gerekli";
    if (!form.get("il")) errs.il = "İl gerekli";
    if (!form.get("sorun_turu")) errs.sorun_turu = "Sorun türü seçin";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStatus("loading");
    try {
      const res = await fetch("/api/yanlis-bilgi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eczane_adi: form.get("eczane_adi"),
          il: form.get("il"),
          ilce: form.get("ilce") || undefined,
          sorun_turu: form.get("sorun_turu") as SorunTuru,
          not: form.get("not") || undefined,
          iletisim_izni: false,
        }),
      });
      if (!res.ok) throw new Error("server_error");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center">
        <CheckCircle className="h-12 w-12 text-accent" />
        <h3 className="text-lg font-semibold text-foreground">Mesajınız alınmıştır</h3>
        <p className="text-sm text-muted-foreground">Teşekkür ederiz, en kısa sürede dönüş yapacağız.</p>
        <button onClick={() => setStatus("idle")}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
          Yeni bildir
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Bir hata oluştu, lütfen tekrar deneyin.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="eczane_adi" className="text-sm font-medium text-foreground">Eczane Adı</label>
        <input id="eczane_adi" name="eczane_adi" placeholder="Hata bildirdiğiniz eczanenin adı"
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        {errors.eczane_adi && <p className="text-xs text-destructive">{errors.eczane_adi}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="il" className="text-sm font-medium text-foreground">İl</label>
          <input id="il" name="il" placeholder="örn. istanbul"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          {errors.il && <p className="text-xs text-destructive">{errors.il}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ilce" className="text-sm font-medium text-foreground">İlçe (opsiyonel)</label>
          <input id="ilce" name="ilce" placeholder="örn. kadikoy"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sorun_turu" className="text-sm font-medium text-foreground">Sorun Türü</label>
        <select id="sorun_turu" name="sorun_turu"
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Sorun türünü seçin</option>
          <option value="telefon_yanlis">Telefon numarası yanlış</option>
          <option value="adres_yanlis">Adres bilgisi hatalı</option>
          <option value="nobette_degil">Nöbetçi değil / kapalı</option>
          <option value="kapali">Kapalı / ulaşılamıyor</option>
          <option value="diger">Diğer</option>
        </select>
        {errors.sorun_turu && <p className="text-xs text-destructive">{errors.sorun_turu}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="not" className="text-sm font-medium text-foreground">Ek Not (opsiyonel)</label>
        <textarea id="not" name="not" placeholder="Tarih, saat veya ek bilgi..." rows={4}
          className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      <button type="submit" disabled={status === "loading"}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {status === "loading" ? "Gönderiliyor..." : "Gönder"}
      </button>
    </form>
  );
}

export default ContactForm;
