import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import MainLayout from "@/components/MainLayout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <MainLayout>
      <div className="container flex flex-col items-center justify-center py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted">
            <MapPin className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-6xl font-extrabold text-foreground">404</h1>
            <p className="mt-2 text-xl font-medium text-muted-foreground">Sayfa bulunamadı</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aradığınız sayfa mevcut değil veya taşınmış olabilir.
            </p>
          </div>
          <Link to="/">
            <Button size="lg" className="gap-2 rounded-xl">
              Ana Sayfaya Dön
            </Button>
          </Link>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default NotFound;
