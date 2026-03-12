/**
 * Türkiye 81 İl — Bölge Grupları ve Yakınlık Haritası
 *
 * 2 amaç:
 *  1. İl sayfalarında "Yakın İllerde Nöbetçi Eczane" iç link bölümü
 *  2. Coğrafi kümeleme ile SEO authority distribution
 *
 * Kaynak: Türkiye İBBS (İstatistiki Bölge Birimleri Sınıflandırması) Düzey-1
 */

export const REGIONS: Record<string, string[]> = {
  "Marmara": [
    "istanbul", "tekirdag", "edirne", "kirklareli",
    "balikesir", "canakkale", "bursa", "kocaeli",
    "sakarya", "duzce", "bolu", "yalova", "bilecik",
  ],
  "Ege": [
    "izmir", "manisa", "aydin", "denizli",
    "mugla", "afyonkarahisar", "kutahya", "usak",
  ],
  "Akdeniz": [
    "antalya", "isparta", "burdur", "mersin",
    "adana", "osmaniye", "hatay", "kahramanmaras",
  ],
  "İç Anadolu": [
    "ankara", "konya", "eskisehir", "aksaray",
    "karaman", "nigde", "nevsehir", "kirsehir",
    "kirikkale", "cankiri", "kayseri", "sivas",
  ],
  "Karadeniz": [
    "trabzon", "rize", "artvin", "giresun",
    "ordu", "samsun", "sinop", "kastamonu",
    "bartin", "zonguldak", "karabuk", "amasya",
    "tokat", "gumushane", "bayburt",
  ],
  "Doğu Anadolu": [
    "erzurum", "erzincan", "malatya", "elazig",
    "bingol", "tunceli", "van", "mus",
    "bitlis", "agri", "igdir", "ardahan", "kars",
  ],
  "Güneydoğu Anadolu": [
    "gaziantep", "adiyaman", "sanliurfa", "diyarbakir",
    "mardin", "siirt", "batman", "sirnak", "kilis", "hakkari",
  ],
};

/** Slug'ın ait olduğu bölgeyi döner. */
export function getRegion(ilSlug: string): string | null {
  for (const [region, slugs] of Object.entries(REGIONS)) {
    if (slugs.includes(ilSlug)) return region;
  }
  return null;
}

/**
 * Aynı bölgedeki diğer illeri döner (ilSlug hariç).
 * İç linkleme için kullanılır.
 * max parametresi ile kaç il döneceği sınırlanır.
 */
export function getSameRegionProvinces(
  ilSlug: string,
  max = 8
): string[] {
  for (const slugs of Object.values(REGIONS)) {
    if (slugs.includes(ilSlug)) {
      return slugs.filter((s) => s !== ilSlug).slice(0, max);
    }
  }
  return [];
}
