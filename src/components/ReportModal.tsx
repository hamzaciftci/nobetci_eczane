import { useState } from "react";
import { X, AlertTriangle, Send, Loader2 } from "lucide-react";
import { Pharmacy, ReportFormData } from "@/types/pharmacy";
import { useToast } from "@/hooks/use-toast";
import { postCorrectionReport } from "@/lib/api";

interface ReportModalProps {
  pharmacy: Pharmacy;
  onClose: () => void;
}

const REASONS: { value: ReportFormData["sorun_turu"]; label: string }[] = [
  { value: "telefon_yanlis", label: "Telefon numarası yanlış" },
  { value: "adres_yanlis", label: "Adres bilgisi hatalı" },
  { value: "nobette_degil", label: "Nöbetçi değil / kapalı" },
  { value: "kapali", label: "Kapali / ulasilamiyor" },
  { value: "diger", label: "Diğer" },
];

const ReportModal = ({ pharmacy, onClose }: ReportModalProps) => {
  const [reason, setReason] = useState<ReportFormData["sorun_turu"] | "">("");
  const [note, setNote] = useState("");
  const [contactConsent, setContactConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setSubmitting(true);

    try {
      await postCorrectionReport({
        il: pharmacy.city,
        ilce: pharmacy.district,
        eczane_adi: pharmacy.name,
        sorun_turu: reason,
        not: note.trim().slice(0, 500),
        iletisim_izni: contactConsent
      });

      toast({
        title: "Bildiriminiz alındı",
        description: "Teşekkürler, en kısa sürede incelenecek.",
      });
      onClose();
    } catch {
      toast({
        title: "Bir hata oluştu",
        description: "Bildirim gönderilemedi. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Yanlış bilgi bildir"
    >
      <div
        className="w-full max-w-md bg-card rounded-t-xl sm:rounded-xl border shadow-lg p-5 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="font-display font-bold text-foreground">Yanlış Bilgi Bildir</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Kapat"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Prefilled info */}
          <div className="text-xs text-muted-foreground space-y-0.5 p-2.5 rounded-md bg-muted/50">
            <p><strong className="text-foreground">{pharmacy.name}</strong></p>
            <p>{pharmacy.district}, {pharmacy.city}</p>
          </div>

          {/* Reason */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold text-foreground">Sorun nedir?</legend>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    reason === r.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Note */}
          <div className="space-y-1.5">
            <label htmlFor="report-note" className="text-xs font-semibold text-foreground">
              Ek not <span className="font-normal text-muted-foreground">(opsiyonel)</span>
            </label>
            <textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Detay varsa yazabilirsiniz..."
            />
            <p className="text-[10px] text-muted-foreground text-right">{note.length}/500</p>
          </div>

          {/* Contact consent */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={contactConsent}
              onChange={(e) => setContactConsent(e.target.checked)}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-xs text-muted-foreground">
              Gerektiğinde benimle iletişime geçilebilir
            </span>
          </label>

          <button
            type="submit"
            disabled={!reason || submitting}
            className="w-full py-2.5 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-40 hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Bildirimi Gönder
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;
