import { motion } from "framer-motion";
import { Clock, MapPin, Shield, ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CitySelector from "@/components/CitySelector";
import MainLayout from "@/components/MainLayout";

const features = [
  {
    icon: Clock,
    title: "Anlık ve Güncel Veri",
    description: "Nöbetçi eczane bilgileri saatlik olarak güncellenir.",
  },
  {
    icon: MapPin,
    title: "81 İl Kapsamı",
    description: "Türkiye'nin tüm illerindeki nöbetçi eczanelere erişin.",
  },
  {
    icon: Shield,
    title: "Resmi Kaynaklardan",
    description: "Veriler eczacı odalarından doğrulanarak sunulmaktadır.",
  },
];

const steps = [
  { num: "1", title: "Şehrini Seç", desc: "81 il arasından bulunduğun şehri seç." },
  { num: "2", title: "Eczaneyi Bul", desc: "O günkü nöbetçi eczaneleri listele." },
  { num: "3", title: "Yol Tarifini Al", desc: "Google Maps ile yol tarifini al ve git." },
];

const popularCities = [
  { name: "İstanbul", slug: "istanbul" },
  { name: "Ankara", slug: "ankara" },
  { name: "İzmir", slug: "izmir" },
  { name: "Antalya", slug: "antalya" },
  { name: "Bursa", slug: "bursa" },
  { name: "Gaziantep", slug: "gaziantep" },
  { name: "Adana", slug: "adana" },
];

export default function HomePage() {
  const today = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  return (
    <MainLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-surface py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />
        <div className="container relative flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-6"
          >
            <Badge variant="secondary" className="gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium">
              <Shield className="h-3.5 w-3.5 text-accent" />
              Resmi kaynaklardan doğrulanan veri
            </Badge>

            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Bugün Nöbetçi Eczane{" "}
              <span className="text-primary">Nerede?</span>
            </h1>

            <p className="max-w-xl text-lg text-muted-foreground">
              Türkiye'nin 81 ilinde resmi kaynaklardan alınan güncel nöbetçi eczane bilgisi.
            </p>

            <p className="text-sm text-muted-foreground">{today}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-10 w-full max-w-lg"
          >
            <CitySelector />
          </motion.div>

          {/* Popular cities */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            <span className="mr-1 text-xs text-muted-foreground">Popüler:</span>
            {popularCities.map((city) => (
              <Link
                key={city.slug}
                to={`/il/${city.slug}`}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                {city.name}
              </Link>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-card-foreground">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface py-16 md:py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">Nasıl Çalışır?</h2>
            <p className="mt-3 text-muted-foreground">3 basit adımda nöbetçi eczanene ulaş.</p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
                {i < steps.length - 1 && (
                  <ChevronRight className="absolute -right-4 top-5 hidden h-6 w-6 text-border md:block" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Nearest pharmacy CTA */}
      <section className="py-16 md:py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-10 text-center text-primary-foreground md:p-14"
          >
            <MapPin className="h-10 w-10" />
            <h2 className="text-2xl font-bold md:text-3xl">En Yakın Nöbetçi Eczane</h2>
            <p className="max-w-md text-sm opacity-90">
              Konumunu paylaş, sana en yakın nöbetçi eczaneleri anında gösterelim.
            </p>
            <Link to="/en-yakin">
              <Button variant="secondary" size="lg" className="gap-2 rounded-xl">
                Konumumu Kullan
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
