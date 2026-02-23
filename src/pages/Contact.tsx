import { motion } from "framer-motion";
import { Mail, MessageSquare } from "lucide-react";
import MainLayout from "@/components/MainLayout";
import ContactForm from "@/components/ContactForm";

export default function ContactPage() {
  return (
    <MainLayout>
      <div className="container py-12 md:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-12 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">Yanlış Bilgi Bildir</h1>
              <p className="leading-relaxed text-muted-foreground">
                Nöbetçi eczane bilgilerinde hata olduğunu düşünüyorsanız lütfen bildirin.
                Ekibimiz en kısa sürede inceleyecektir.
              </p>
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Eczane adı, il/ilçe ve tarih bilgisini mümkün olduğunca net belirtin.
                    Bu bilgiler düzeltmeyi hızlandırır.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-2xl border border-border bg-card p-6 shadow-card md:p-8"
            >
              <ContactForm />
            </motion.div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
