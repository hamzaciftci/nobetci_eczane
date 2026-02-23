import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, AlertCircle, Send } from "lucide-react";
import { postCorrectionReport } from "@/lib/api";

type Status = "idle" | "loading" | "success" | "error";

export default function ContactForm() {
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
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStatus("loading");
    try {
      await postCorrectionReport({
        eczane_adi: String(form.get("eczane_adi") || ""),
        il: String(form.get("il") || ""),
        ilce: String(form.get("ilce") || "") || undefined,
        sorun_turu: form.get("sorun_turu") as "telefon_yanlis" | "adres_yanlis" | "nobette_degil" | "kapali" | "diger",
        not: String(form.get("not") || "") || undefined,
        iletisim_izni: false,
      });
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
        <Button variant="outline" onClick={() => setStatus("idle")}>
          Yeni bildir
        </Button>
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
        <Label htmlFor="eczane_adi">Eczane Adı</Label>
        <Input id="eczane_adi" name="eczane_adi" placeholder="Hata bildirdiğiniz eczanenin adı" className="h-11 rounded-xl" />
        {errors.eczane_adi && <p className="text-xs text-destructive">{errors.eczane_adi}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="il">İl</Label>
          <Input id="il" name="il" placeholder="örn. istanbul" className="h-11 rounded-xl" />
          {errors.il && <p className="text-xs text-destructive">{errors.il}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ilce">İlçe (opsiyonel)</Label>
          <Input id="ilce" name="ilce" placeholder="örn. kadikoy" className="h-11 rounded-xl" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Sorun Türü</Label>
        <Select name="sorun_turu">
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Sorun türünü seçin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="telefon_yanlis">Telefon yanlış</SelectItem>
            <SelectItem value="adres_yanlis">Adres yanlış</SelectItem>
            <SelectItem value="nobette_degil">Nöbette değil</SelectItem>
            <SelectItem value="kapali">Kapalı</SelectItem>
            <SelectItem value="diger">Diğer</SelectItem>
          </SelectContent>
        </Select>
        {errors.sorun_turu && <p className="text-xs text-destructive">{errors.sorun_turu}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="not">Ek Not (opsiyonel)</Label>
        <Textarea
          id="not"
          name="not"
          placeholder="Tarih, saat veya ek bilgi..."
          rows={4}
          className="rounded-xl resize-none"
        />
      </div>

      <Button type="submit" size="lg" className="h-12 rounded-xl gap-2" disabled={status === "loading"}>
        <Send className="h-4 w-4" />
        {status === "loading" ? "Gönderiliyor..." : "Gönder"}
      </Button>
    </form>
  );
}
