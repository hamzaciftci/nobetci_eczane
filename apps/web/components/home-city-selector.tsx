"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProvinceDto } from "../lib/shared";

interface HomeCitySelectorProps {
  provinces: ProvinceDto[];
}

const POPULAR_SLUGS = ["istanbul", "ankara", "izmir", "antalya", "bursa", "adana", "osmaniye"];

export function HomeCitySelector({ provinces }: HomeCitySelectorProps) {
  const [query, setQuery] = useState("");

  const popular = useMemo(
    () => POPULAR_SLUGS.map((slug) => provinces.find((item) => item.slug === slug)).filter(Boolean) as ProvinceDto[],
    [provinces]
  );

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLocaleLowerCase("tr-TR");
    if (!trimmed) {
      return provinces;
    }

    return provinces.filter((item) => item.name.toLocaleLowerCase("tr-TR").includes(trimmed));
  }, [provinces, query]);

  return (
    <section className="panel home-selector">
      <label className="search-wrap" htmlFor="home-city-search">
        <span className="search-icon" aria-hidden="true">
          O
        </span>
        <input
          id="home-city-search"
          type="search"
          className="search-input"
          placeholder="Il ara..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="popular-grid">
        {popular.map((province) => (
          <Link key={province.code} href={`/nobetci-eczane/${province.slug}`} className="city-chip">
            {province.name}
          </Link>
        ))}
      </div>

      <div className="city-list" role="list">
        {filtered.map((province) => (
          <Link key={province.code} href={`/nobetci-eczane/${province.slug}`} className="city-row" role="listitem">
            <span>{province.name}</span>
            <span className="city-row-path">/nobetci-eczane/{province.slug}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
