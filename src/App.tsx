import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";

// New pages
import Index from "./pages/Index";
import CityPage from "./pages/CityPage";
import NearestPharmacy from "./pages/NearestPharmacy";
import Contact from "./pages/Contact";
import EmbedPage from "./pages/EmbedPage";
import EmbedWidget from "./pages/EmbedWidget";
import NotFound from "./pages/NotFound";

// Existing utility pages (kept as-is)
import PrintPage from "./pages/PrintPage";
import ScreenPage from "./pages/ScreenPage";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Redirect components for legacy /nobetci-eczane/:il[/:ilce] routes
function LegacyProvinceRedirect() {
  const { il } = useParams<{ il: string }>();
  return <Navigate to={`/il/${il}`} replace />;
}

function LegacyDistrictRedirect() {
  const { il, ilce } = useParams<{ il: string; ilce: string }>();
  return <Navigate to={`/il/${il}/${ilce}`} replace />;
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* ── Main routes ─────────────────────────────────────── */}
              <Route path="/" element={<Index />} />
              <Route path="/il/:il" element={<CityPage />} />
              <Route path="/il/:il/:ilce" element={<CityPage />} />
              <Route path="/en-yakin" element={<NearestPharmacy />} />
              <Route path="/iletisim" element={<Contact />} />
              <Route path="/sitene-ekle" element={<EmbedPage />} />
              <Route path="/embed/:il" element={<EmbedWidget />} />

              {/* ── Utility pages (print / screen display) ─────────── */}
              <Route path="/il/:il/yazdir" element={<PrintPage />} />
              <Route path="/il/:il/ekran" element={<ScreenPage />} />
              <Route path="/il/:il/:ilce/yazdir" element={<PrintPage />} />
              <Route path="/il/:il/:ilce/ekran" element={<ScreenPage />} />

              {/* ── Admin ───────────────────────────────────────────── */}
              <Route path="/admin" element={<AdminPage />} />

              {/* ── Legacy /nobetci-eczane/ redirects ──────────────── */}
              <Route path="/nobetci-eczane/:il" element={<LegacyProvinceRedirect />} />
              <Route path="/nobetci-eczane/:il/:ilce" element={<LegacyDistrictRedirect />} />
              <Route path="/nobetci-eczane/:il/yazdir" element={<PrintPage />} />
              <Route path="/nobetci-eczane/:il/ekran" element={<ScreenPage />} />
              <Route path="/nobetci-eczane/:il/:ilce/yazdir" element={<PrintPage />} />
              <Route path="/nobetci-eczane/:il/:ilce/ekran" element={<ScreenPage />} />

              {/* ── 404 ─────────────────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
