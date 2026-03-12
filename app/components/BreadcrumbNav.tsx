/**
 * Breadcrumb navigasyon bileşeni.
 * Hem görsel breadcrumb hem de BreadcrumbList schema'sı üretir.
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SchemaMarkup } from "./SchemaMarkup";
import { breadcrumbSchema } from "@/app/lib/schema";

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export function BreadcrumbNav({ items }: Props) {
  return (
    <>
      <SchemaMarkup schemas={[breadcrumbSchema(items)]} />

      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                )}
                {isLast ? (
                  <span className="font-medium text-gray-700" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-blue-600 hover:underline transition-colors"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
