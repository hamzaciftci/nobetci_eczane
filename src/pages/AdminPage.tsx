import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RefreshCcw, AlertCircle, CheckCircle2, Play, Loader2, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import MainLayout from "@/components/MainLayout";
import { IngestionOverview, IngestionAlert } from "@/types/pharmacy";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/date";
import { fetchAdminOpenAlerts, fetchAdminOverview, resolveAdminAlert, triggerAdminRecovery } from "@/lib/api";

const TOKEN_STORAGE_KEY = "nobetci_admin_token";

const AdminPage = () => {
  const [overview, setOverview] = useState<IngestionOverview[]>([]);
  const [alerts, setAlerts] = useState<IngestionAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [triggeringProvince, setTriggeringProvince] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    const envValue = (import.meta.env.VITE_ADMIN_API_TOKEN ?? "").trim();
    setAdminToken(stored || envValue);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, alertData] = await Promise.all([
        fetchAdminOverview(adminToken),
        fetchAdminOpenAlerts(adminToken)
      ]);
      setOverview(overviewData);
      setAlerts(alertData);
    } catch {
      toast({
        title: "Admin verisi alinamadi",
        description: "Token veya baglanti ayarlarini kontrol edin.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [adminToken, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const saveToken = () => {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, adminToken.trim());
    toast({ title: "Admin token kaydedildi" });
    void fetchData();
  };

  const resolveAlert = async (alertId: number) => {
    setResolvingId(alertId);
    try {
      const response = await resolveAdminAlert(alertId, adminToken);
      if (response.resolved) {
        setAlerts((prev) => prev.filter((item) => item.id !== alertId));
        toast({ title: "Alert cozuldu olarak isaretlendi" });
      } else {
        toast({ title: "Alert zaten kapanmis olabilir", description: "Liste yenileniyor." });
        void fetchData();
      }
    } catch {
      toast({ title: "Hata", description: "Islem basarisiz", variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  const triggerRecovery = async (provinceSlug: string) => {
    setTriggeringProvince(provinceSlug);
    try {
      await triggerAdminRecovery(provinceSlug, adminToken);
      toast({ title: `${provinceSlug} icin recovery tetiklendi` });
      void fetchData();
    } catch {
      toast({ title: "Hata", description: "Recovery baslatilamadi", variant: "destructive" });
    } finally {
      setTriggeringProvince(null);
    }
  };

  const openAlerts = alerts;

  return (
    <MainLayout>
      <div className="container py-4 sm:py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="font-display text-xl font-bold text-foreground">Admin · Ingestion</h1>
          </div>
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={cn("h-3 w-3", loading && "animate-spin")} />
            Yenile
          </button>
        </div>

        <section className="mb-6 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-primary" />
            Admin Token
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="x-admin-token degeri"
              autoComplete="off"
            />
            <button
              onClick={saveToken}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
            >
              Kaydet
            </button>
          </div>
        </section>

        {openAlerts.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Acik Alertler ({openAlerts.length})
            </h2>
            <div className="space-y-2">
              {openAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-foreground">{titleFromSlug(alert.il)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                        {alert.alert_type}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(alert.created_at)}</p>
                  </div>
                  <button
                    onClick={() => void resolveAlert(alert.id)}
                    disabled={resolvingId === alert.id}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-trust/10 text-trust text-[10px] font-semibold hover:bg-trust/20 transition-colors disabled:opacity-50"
                  >
                    {resolvingId === alert.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Cozuldu
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Kaynak Durumu</h2>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left py-2.5 px-3 font-semibold text-foreground">Il</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-foreground">Son Calisma</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-foreground">Basarili</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-foreground">Kismi</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-foreground">Hatali</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-foreground">Alert</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-foreground">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map((row) => {
                    const hasIssue = row.failed_count > 0 || row.partial_count > 0;
                    return (
                      <tr key={row.il} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{titleFromSlug(row.il)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{row.last_run_at ? formatTimeAgo(row.last_run_at) : "-"}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{row.success_count}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{row.partial_count}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{row.failed_count}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{row.alert_count}</td>
                        <td className="py-2.5 px-3 text-right">
                          {hasIssue && (
                            <button
                              onClick={() => void triggerRecovery(row.il)}
                              disabled={triggeringProvince === row.il}
                              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-semibold transition-colors disabled:opacity-50"
                            >
                              {triggeringProvince === row.il ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                              Recovery
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!overview.length && !loading && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        Gosterilecek ingestion kaydi bulunamadi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default AdminPage;

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
