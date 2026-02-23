import { AlertTriangle, Clock, RefreshCcw } from "lucide-react";
import { formatTimeAgo } from "@/lib/date";

interface DegradedBannerProps {
  lastSuccessful: string;
  onRetry?: () => void;
}

const DegradedBanner = ({ lastSuccessful, onRetry }: DegradedBannerProps) => {
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 flex items-start gap-2.5" role="alert">
      <AlertTriangle className="h-4 w-4 text-accent-foreground shrink-0 mt-0.5" />
      <div className="text-xs flex-1">
        <p className="font-semibold text-accent-foreground">Kaynaklar yenileniyor</p>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          Son başarılı güncelleme: {formatTimeAgo(lastSuccessful)}
        </p>
        <p className="text-muted-foreground mt-0.5">
          Bazı bilgiler güncel olmayabilir. Lütfen eczaneyi aramadan önce telefonla doğrulayın.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1.5 inline-flex items-center gap-1 text-primary font-semibold hover:text-primary/80 transition-colors"
          >
            <RefreshCcw className="h-2.5 w-2.5" />
            Tekrar dene
          </button>
        )}
      </div>
    </div>
  );
};

export default DegradedBanner;
