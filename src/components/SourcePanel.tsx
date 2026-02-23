import { Shield, Clock, ExternalLink, AlertTriangle, RefreshCcw } from "lucide-react";
import { SourceInfo } from "@/types/pharmacy";
import { formatTimeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";

interface SourcePanelProps {
  sourceInfo: SourceInfo;
  onRefresh?: () => void;
}

const SourcePanel = ({ sourceInfo, onRefresh }: SourcePanelProps) => {
  const isDegraded = sourceInfo.status === "degraded";

  return (
    <div
      className={cn(
        "rounded-lg border p-3.5 space-y-2",
        isDegraded ? "border-accent/50 bg-accent/5" : "bg-card"
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-trust" />
          Veri Durumu
        </h4>
        <span
          className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            isDegraded
              ? "bg-accent/20 text-accent-foreground"
              : "bg-trust/10 text-trust"
          )}
        >
          {isDegraded ? "Kısmi Güncelleme" : "Güncel"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground text-[10px] mb-0.5">Kaynak</p>
          {sourceInfo.url ? (
            <a
              href={sourceInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-medium flex items-center gap-1 hover:text-primary transition-colors"
            >
              {sourceInfo.name}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ) : (
            <p className="text-foreground font-medium">{sourceInfo.name}</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] mb-0.5">Son Güncelleme</p>
          <p className="text-foreground font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(sourceInfo.lastUpdated)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] mb-0.5">Doğrulama</p>
          <p className="text-foreground font-medium">{sourceInfo.verificationCount} kaynak</p>
        </div>
      </div>

      {isDegraded && (
        <div className="flex items-start gap-2 pt-1.5 border-t border-accent/30">
          <AlertTriangle className="h-3.5 w-3.5 text-accent-foreground shrink-0 mt-0.5" />
          <div className="text-[10px] text-accent-foreground space-y-1">
            <p className="font-medium">Kaynaklar tam olarak yenilenemiyor</p>
            {sourceInfo.hint ? <p className="text-muted-foreground">{sourceInfo.hint}</p> : null}
            {sourceInfo.recentAlert ? (
              <p className="text-muted-foreground">Son alarm: {sourceInfo.recentAlert}</p>
            ) : null}
            {sourceInfo.lastSuccessfulUpdate && (
              <p className="text-muted-foreground">
                Son başarılı: {formatTimeAgo(sourceInfo.lastSuccessfulUpdate)}
              </p>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="inline-flex items-center gap-1 text-primary font-semibold hover:text-primary/80 transition-colors"
              >
                <RefreshCcw className="h-2.5 w-2.5" />
                Tekrar dene
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SourcePanel;
