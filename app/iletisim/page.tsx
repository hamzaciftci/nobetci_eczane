import type { Metadata } from "next";
import Link from "next/link";

import { ContactForm } from "@/app/components/ContactForm";
import { provinces } from "@/app/lib/provinces";

export const metadata: Metadata = {
  title: { absolute: "İletişim – Bugün Nöbetçi Eczaneler" },
  description:
    "Yanlış eczane bilgisi, hata bildirimi veya dilek ve şikayetleriniz için iletişim formunu kullanın.",
  alternates: {
    canonical: "https://www.bugunnobetcieczaneler.com/iletisim",
  },
};

export default function ContactPage() {
  return (
    <div className="container py-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm md:p-6">
            <h1 className="text-center text-2xl font-bold text-foreground md:text-3xl">İletişim</h1>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground md:text-base">
              Her türlü dilek, istek ve şikayetinizi aşağıdaki formu kullanarak bize iletebilirsiniz.
            </p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Lütfen formu göndermeden önce aşağıdaki hususlara dikkat ediniz.
            </p>

            <div className="mt-6 space-y-5 text-sm leading-6 text-foreground">
              <div>
                <h2 className="text-base font-bold">Eczaneler</h2>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
                  <li>
                    Belirli bir eczane için yazıyorsanız eczane adıyla birlikte <strong>il ve ilçeyi</strong> belirtiniz.
                  </li>
                  <li>Eczane iletişim bilgilerinde hata varsa bağlı olduğunuz Oda üzerinden de güncelleme yapınız.</li>
                  <li>Acil güncelleme gereken durumlarda iletişim formu üzerinden detaylı bilgi iletiniz.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-bold">Kullanıcılar</h2>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
                  <li>
                    İlaç temini, reçete ve genel sağlık danışmanlığı konularında destek veremiyoruz. Bu konular için en yakın
                    eczaneden destek alın.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-center text-xl font-bold text-foreground">İletişim Formu</h2>
              <div className="mt-4 rounded-xl border border-border bg-background p-4 md:p-6">
                <ContactForm />
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-border bg-card shadow-sm">
            <h2 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wide text-foreground">
              Şehir Seç
            </h2>
            <div className="max-h-[700px] overflow-auto p-1">
              {provinces.map((province) => (
                <Link
                  key={province.slug}
                  href={`/nobetci-eczane/${province.slug}`}
                  className="block w-full border-b border-dashed border-border px-3 py-2 text-sm text-foreground transition hover:bg-muted/60"
                >
                  {province.name}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
