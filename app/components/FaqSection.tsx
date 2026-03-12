/**
 * SSS (Sık Sorulan Sorular) bileşeni + FAQPage JSON-LD şeması.
 *
 * Google'ın "People Also Ask" kutularında görünmek için:
 *  - FAQPage schema eklenir
 *  - Her soru <details>/<summary> yerine açık HTML olarak render edilir
 *    (Googlebot JS çalıştırmadan görebilsin)
 */

import { HelpCircle } from "lucide-react";
import { SchemaMarkup } from "./SchemaMarkup";
import { faqSchema } from "@/app/lib/schema";
import type { FaqItem } from "@/app/lib/content";

interface Props {
  faqs: FaqItem[];
  heading?: string;
}

export function FaqSection({ faqs, heading = "Sık Sorulan Sorular" }: Props) {
  if (faqs.length === 0) return null;

  return (
    <>
      <SchemaMarkup schemas={[faqSchema(faqs)]} />

      <section aria-labelledby="faq-heading" className="mb-10">
        <h2
          id="faq-heading"
          className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2"
        >
          <HelpCircle className="h-5 w-5 text-blue-600" />
          {heading}
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-lg border border-gray-200 bg-white open:shadow-sm transition-shadow"
            >
              {/* Soru — her zaman görünür */}
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-medium text-gray-800 hover:text-blue-700 transition-colors select-none">
                <span>{faq.question}</span>
                {/* Chevron animasyonu */}
                <svg
                  className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>

              {/* Cevap — açıldığında görünür */}
              <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-600 leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
