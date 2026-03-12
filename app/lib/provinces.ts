/**
 * 81 il — statik liste.
 * slug → görüntü adı eşlemesi için kullanılır.
 */

export interface Province {
  name: string;
  slug: string;
  popular?: boolean;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const POPULAR_SLUGS = new Set([
  "istanbul", "ankara", "izmir", "antalya", "bursa", "gaziantep", "adana",
]);

const PROVINCE_NAMES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya",
  "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın",
  "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
  "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce",
  "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep",
  "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
  "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu",
  "Kayseri", "Kilis", "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli",
  "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla",
  "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya",
  "Samsun", "Siirt", "Sinop", "Sivas", "Şanlıurfa", "Şırnak", "Tekirdağ",
  "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat",
  "Zonguldak",
];

export const provinces: Province[] = PROVINCE_NAMES.map((name) => ({
  name,
  slug: toSlug(name),
  popular: POPULAR_SLUGS.has(toSlug(name)),
}));

/** Slug'dan Province nesnesi döner. */
export function findProvince(slug: string): Province | undefined {
  return provinces.find((p) => p.slug === slug);
}

/** Slug'dan il adını döner (bulunamazsa slug'u capitalize eder). */
export function getProvinceName(slug: string): string {
  return findProvince(slug)?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

export { toSlug };
