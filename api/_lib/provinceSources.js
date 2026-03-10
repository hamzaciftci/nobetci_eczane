/**
 * Canonical province source catalog (81 provinces).
 * Keep this file as code-level source of truth; DB endpoint rows are validated against it.
 */
import { PROVINCES } from "./provinces.js";

/** @typedef {"adana" | "adiyaman" | "afyonkarahisar" | "agri" | "aksaray" | "amasya" | "ankara" | "antalya" | "ardahan" | "artvin" | "aydin" | "balikesir" | "bartin" | "batman" | "bayburt" | "bilecik" | "bingol" | "bitlis" | "bolu" | "burdur" | "bursa" | "canakkale" | "cankiri" | "corum" | "denizli" | "diyarbakir" | "duzce" | "edirne" | "elazig" | "erzincan" | "erzurum" | "eskisehir" | "gaziantep" | "giresun" | "gumushane" | "hakkari" | "hatay" | "igdir" | "isparta" | "istanbul" | "izmir" | "kahramanmaras" | "karabuk" | "karaman" | "kars" | "kastamonu" | "kayseri" | "kilis" | "kirikkale" | "kirklareli" | "kirsehir" | "kocaeli" | "konya" | "kutahya" | "malatya" | "manisa" | "mardin" | "mersin" | "mugla" | "mus" | "nevsehir" | "nigde" | "ordu" | "osmaniye" | "rize" | "sakarya" | "samsun" | "sanliurfa" | "siirt" | "sinop" | "sirnak" | "sivas" | "tekirdag" | "tokat" | "trabzon" | "tunceli" | "usak" | "van" | "yalova" | "yozgat" | "zonguldak"} ProvinceCode */

/**
 * @typedef {Object} ProvinceSourceConfig
 * @property {ProvinceCode} code
 * @property {string} displayName
 * @property {"chamber_html" | "json_api" | "third_party_html"} officialSourceType
 * @property {string} officialSourceUrl
 * @property {string} parserKey
 * @property {"html" | "api"} format
 * @property {string} sourceName
 * @property {string} baseUrl
 * @property {{ itemSelector: string, nameSelector: string, addressSelector?: string, phoneSelector?: string, districtSelector?: string }=} htmlSelectors
 */

/** @type {readonly ProvinceSourceConfig[]} */
export const PROVINCE_SOURCES = Object.freeze([
  {
    "code": "adana",
    "displayName": "Adana",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.adanaeo.org.tr/nobetci-eczaneler",
    "parserKey": "adana_secondary_v1",
    "format": "html",
    "sourceName": "Adana Eczaci Odasi",
    "baseUrl": "https://www.adanaeo.org.tr"
  },
  {
    "code": "adiyaman",
    "displayName": "Adiyaman",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.adiyamaneo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Adiyaman Eczaci Odasi",
    "baseUrl": "https://www.adiyamaneo.org.tr"
  },
  {
    "code": "afyonkarahisar",
    "displayName": "Afyonkarahisar",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.afyoneczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Afyonkarahisar Eczaci Odasi",
    "baseUrl": "https://www.afyoneczaciodasi.org.tr"
  },
  {
    "code": "agri",
    "displayName": "Agri",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.agrieo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Agri Eczaci Odasi",
    "baseUrl": "https://www.agrieo.org.tr"
  },
  {
    "code": "aksaray",
    "displayName": "Aksaray",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.aksarayeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Aksaray Eczaci Odasi",
    "baseUrl": "https://www.aksarayeo.org.tr"
  },
  {
    "code": "amasya",
    "displayName": "Amasya",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.amasyaeo.org.tr/nobet-listesi/",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Amasya Eczaci Odasi",
    "baseUrl": "https://www.amasyaeo.org.tr"
  },
  {
    "code": "ankara",
    "displayName": "Ankara",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.aeo.org.tr/nobetci-eczaneler",
    "parserKey": "ankara_ajax_v1",
    "format": "html",
    "sourceName": "Ankara Eczaci Odasi",
    "baseUrl": "https://www.aeo.org.tr"
  },
  {
    "code": "antalya",
    "displayName": "Antalya",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.antalyaeo.org.tr/tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Antalya Eczaci Odasi",
    "baseUrl": "https://www.antalyaeo.org.tr"
  },
  {
    "code": "ardahan",
    "displayName": "Ardahan",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.erzurumeo.org.tr/nobetci-eczaneler/75",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Ardahan Eczaci Odasi",
    "baseUrl": "https://www.erzurumeo.org.tr"
  },
  {
    "code": "artvin",
    "displayName": "Artvin",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.trabzoneczaciodasi.org.tr/nobetci-eczaneler/8",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Artvin Eczaci Odasi",
    "baseUrl": "https://www.trabzoneczaciodasi.org.tr"
  },
  {
    "code": "aydin",
    "displayName": "Aydin",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.aydineczaciodasi.org.tr/nobetci-4",
    "parserKey": "teknoecza_v2",
    "format": "html",
    "sourceName": "Aydin Eczaci Odasi",
    "baseUrl": "https://www.aydineczaciodasi.org.tr"
  },
  {
    "code": "balikesir",
    "displayName": "Balikesir",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.balikesireczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Balikesir Eczaci Odasi",
    "baseUrl": "https://www.balikesireczaciodasi.org.tr"
  },
  {
    "code": "bartin",
    "displayName": "Bartin",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.zeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Bartin Eczaci Odasi",
    "baseUrl": "https://www.zeo.org.tr"
  },
  {
    "code": "batman",
    "displayName": "Batman",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.batmaneczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Batman Eczaci Odasi",
    "baseUrl": "https://www.batmaneczaciodasi.org.tr"
  },
  {
    "code": "bayburt",
    "displayName": "Bayburt",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.erzurumeo.org.tr/nobetci-eczaneler/69",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Bayburt Eczaci Odasi",
    "baseUrl": "https://www.erzurumeo.org.tr"
  },
  {
    "code": "bilecik",
    "displayName": "Bilecik",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.eskisehireo.org.tr/bilecik-nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Bilecik Eczaci Odasi",
    "baseUrl": "https://www.eskisehireo.org.tr"
  },
  {
    "code": "bingol",
    "displayName": "Bingol",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.elazigeczaciodasi.org.tr/nobetci-eczaneler/bingol",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Bingol Eczaci Odasi",
    "baseUrl": "https://www.elazigeczaciodasi.org.tr"
  },
  {
    "code": "bitlis",
    "displayName": "Bitlis",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.vaneczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Bitlis Eczaci Odasi",
    "baseUrl": "https://www.vaneczaciodasi.org.tr"
  },
  {
    "code": "bolu",
    "displayName": "Bolu",
    "officialSourceType": "third_party_html",
    "officialSourceUrl": "https://seobit.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Bolu Il Saglik Mudurlugu",
    "baseUrl": "https://seobit.org.tr"
  },
  {
    "code": "burdur",
    "displayName": "Burdur",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.burdureo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Burdur Eczaci Odasi",
    "baseUrl": "https://www.burdureo.org.tr"
  },
  {
    "code": "bursa",
    "displayName": "Bursa",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.beo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Bursa Eczaci Odasi",
    "baseUrl": "https://www.beo.org.tr"
  },
  {
    "code": "canakkale",
    "displayName": "Canakkale",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.canakkaleeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Canakkale Eczaci Odasi",
    "baseUrl": "https://www.canakkaleeo.org.tr"
  },
  {
    "code": "cankiri",
    "displayName": "Cankiri",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.kastamonueo.org.tr/nobetci-eczaneler/18",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Cankiri Eczaci Odasi",
    "baseUrl": "https://www.kastamonueo.org.tr"
  },
  {
    "code": "corum",
    "displayName": "Corum",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.corumeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Corum Eczaci Odasi",
    "baseUrl": "https://www.corumeo.org.tr"
  },
  {
    "code": "denizli",
    "displayName": "Denizli",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://denizlieczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Denizli Eczaci Odasi",
    "baseUrl": "https://denizlieczaciodasi.org.tr"
  },
  {
    "code": "diyarbakir",
    "displayName": "Diyarbakir",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.diyarbakireo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Diyarbakir Eczaci Odasi",
    "baseUrl": "https://www.diyarbakireo.org.tr"
  },
  {
    "code": "duzce",
    "displayName": "Duzce",
    "officialSourceType": "third_party_html",
    "officialSourceUrl": "https://www.duzceeo.org/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Duzce Il Saglik Mudurlugu",
    "baseUrl": "https://www.duzceeo.org"
  },
  {
    "code": "edirne",
    "displayName": "Edirne",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.edirneeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Edirne Eczaci Odasi",
    "baseUrl": "https://www.edirneeo.org.tr"
  },
  {
    "code": "elazig",
    "displayName": "Elazig",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.elazigeczaciodasi.org.tr/nobetci-eczaneler/elazig",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Elazig Eczaci Odasi",
    "baseUrl": "https://www.elazigeczaciodasi.org.tr"
  },
  {
    "code": "erzincan",
    "displayName": "Erzincan",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://erzincaneo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Erzincan Eczaci Odasi",
    "baseUrl": "https://erzincaneo.org.tr"
  },
  {
    "code": "erzurum",
    "displayName": "Erzurum",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.erzurumeo.org.tr/nobetci-eczaneler/25",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Erzurum Eczaci Odasi",
    "baseUrl": "https://www.erzurumeo.org.tr"
  },
  {
    "code": "eskisehir",
    "displayName": "Eskisehir",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.eskisehireo.org.tr/eskisehir-nobetci-eczaneler/",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Eskisehir Eczaci Odasi",
    "baseUrl": "https://www.eskisehireo.org.tr"
  },
  {
    "code": "gaziantep",
    "displayName": "Gaziantep",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://gaziantepeczaciodasi.com.gaziantepeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Gaziantep Eczaci Odasi",
    "baseUrl": "https://gaziantepeczaciodasi.com.gaziantepeo.org.tr"
  },
  {
    "code": "giresun",
    "displayName": "Giresun",
    "officialSourceType": "json_api",
    "officialSourceUrl": "https://www.giresuneczaciodasi.org.tr/api/pharmacies",
    "parserKey": "generic_api_v1",
    "format": "api",
    "sourceName": "Giresun Eczaci Odasi",
    "baseUrl": "https://www.giresuneczaciodasi.org.tr"
  },
  {
    "code": "gumushane",
    "displayName": "Gumushane",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.trabzoneczaciodasi.org.tr/nobetci-eczaneler/29",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Gumushane Eczaci Odasi",
    "baseUrl": "https://www.trabzoneczaciodasi.org.tr"
  },
  {
    "code": "hakkari",
    "displayName": "Hakkari",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.vaneczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Hakkari Eczaci Odasi",
    "baseUrl": "https://www.vaneczaciodasi.org.tr"
  },
  {
    "code": "hatay",
    "displayName": "Hatay",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.hatayeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Hatay Eczaci Odasi",
    "baseUrl": "https://www.hatayeo.org.tr"
  },
  {
    "code": "igdir",
    "displayName": "Igdir",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.erzurumeo.org.tr/nobetci-eczaneler/76",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Igdir Eczaci Odasi",
    "baseUrl": "https://www.erzurumeo.org.tr"
  },
  {
    "code": "isparta",
    "displayName": "Isparta",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.ispartaeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Isparta Eczaci Odasi",
    "baseUrl": "https://www.ispartaeo.org.tr"
  },
  {
    "code": "istanbul",
    "displayName": "Istanbul",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.istanbuleczaciodasi.org.tr/nobetci-eczane/",
    "parserKey": "istanbul_secondary_v1",
    "format": "html",
    "sourceName": "Istanbul Eczaci Odasi",
    "baseUrl": "https://www.istanbuleczaciodasi.org.tr"
  },
  {
    "code": "izmir",
    "displayName": "Izmir",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.izmireczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Izmir Eczaci Odasi",
    "baseUrl": "https://www.izmireczaciodasi.org.tr"
  },
  {
    "code": "kahramanmaras",
    "displayName": "Kahramanmaras",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.kahramanmaraseo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kahramanmaras Eczaci Odasi",
    "baseUrl": "https://www.kahramanmaraseo.org.tr"
  },
  {
    "code": "karabuk",
    "displayName": "Karabuk",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.kastamonueo.org.tr/nobetci-eczaneler/78",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Karabuk Eczaci Odasi",
    "baseUrl": "https://www.kastamonueo.org.tr"
  },
  {
    "code": "karaman",
    "displayName": "Karaman",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.karamaneo.org.tr/nobet-listesi",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Karaman Eczaci Odasi",
    "baseUrl": "https://www.karamaneo.org.tr"
  },
  {
    "code": "kars",
    "displayName": "Kars",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.erzurumeo.org.tr/nobetci-eczaneler/36",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kars Eczaci Odasi",
    "baseUrl": "https://www.erzurumeo.org.tr"
  },
  {
    "code": "kastamonu",
    "displayName": "Kastamonu",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.kastamonueo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kastamonu Eczaci Odasi",
    "baseUrl": "https://www.kastamonueo.org.tr"
  },
  {
    "code": "kayseri",
    "displayName": "Kayseri",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.kayserieo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kayseri Eczaci Odasi",
    "baseUrl": "https://www.kayserieo.org.tr"
  },
  {
    "code": "kilis",
    "displayName": "Kilis",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://gaziantepeczaciodasi.com.gaziantepeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kilis Eczaci Odasi",
    "baseUrl": "https://gaziantepeczaciodasi.com.gaziantepeo.org.tr"
  },
  {
    "code": "kirikkale",
    "displayName": "Kirikkale",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.aeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kirikkale Eczaci Odasi",
    "baseUrl": "https://www.aeo.org.tr"
  },
  {
    "code": "kirklareli",
    "displayName": "Kirklareli",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.kirklarelieo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kirklareli Eczaci Odasi",
    "baseUrl": "https://www.kirklarelieo.org.tr"
  },
  {
    "code": "kirsehir",
    "displayName": "Kirsehir",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.aksarayeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kirsehir Eczaci Odasi",
    "baseUrl": "https://www.aksarayeo.org.tr"
  },
  {
    "code": "kocaeli",
    "displayName": "Kocaeli",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.kocaelieo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kocaeli Eczaci Odasi",
    "baseUrl": "https://www.kocaelieo.org.tr"
  },
  {
    "code": "konya",
    "displayName": "Konya",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "http://www.konyanobetcieczaneleri.com",
    "parserKey": "konya_v1",
    "format": "html",
    "sourceName": "Konya Eczaci Odasi",
    "baseUrl": "https://keo.org.tr"
  },
  {
    "code": "kutahya",
    "displayName": "Kutahya",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.kutahyaeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Kutahya Eczaci Odasi",
    "baseUrl": "https://www.kutahyaeo.org.tr"
  },
  {
    "code": "malatya",
    "displayName": "Malatya",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.malatyaeczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Malatya Eczaci Odasi",
    "baseUrl": "https://www.malatyaeczaciodasi.org.tr"
  },
  {
    "code": "manisa",
    "displayName": "Manisa",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.manisaeczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Manisa Eczaci Odasi",
    "baseUrl": "https://www.manisaeczaciodasi.org.tr"
  },
  {
    "code": "mardin",
    "displayName": "Mardin",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.mardineczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Mardin Eczaci Odasi",
    "baseUrl": "https://www.mardineczaciodasi.org.tr"
  },
  {
    "code": "mersin",
    "displayName": "Mersin",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.mersineczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Mersin Eczaci Odasi",
    "baseUrl": "https://www.mersineczaciodasi.org.tr"
  },
  {
    "code": "mugla",
    "displayName": "Mugla",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.muglaeczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Mugla Eczaci Odasi",
    "baseUrl": "https://www.muglaeczaciodasi.org.tr"
  },
  {
    "code": "mus",
    "displayName": "Mus",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.batmaneczaciodasi.org.tr/nobetci-eczaneler/49",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Mus Eczaci Odasi",
    "baseUrl": "https://www.batmaneczaciodasi.org.tr"
  },
  {
    "code": "nevsehir",
    "displayName": "Nevsehir",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.nevsehireo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Nevsehir Eczaci Odasi",
    "baseUrl": "https://www.nevsehireo.org.tr"
  },
  {
    "code": "nigde",
    "displayName": "Nigde",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.neo.org.tr/nobetci-eczaneler",
    "parserKey": "teknoecza_v1",
    "format": "html",
    "sourceName": "Nigde Eczaci Odasi",
    "baseUrl": "https://www.neo.org.tr"
  },
  {
    "code": "ordu",
    "displayName": "Ordu",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://ordueczaciodasi.org.tr/nobetci-eczaneler/",
    "parserKey": "eczanesistemi_iframe_v1",
    "format": "html",
    "sourceName": "Ordu Eczaci Odasi",
    "baseUrl": "https://ordueczaciodasi.org.tr"
  },
  {
    "code": "osmaniye",
    "displayName": "Osmaniye",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.osmaniyeeczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "osmaniye_eo_v1",
    "format": "html",
    "sourceName": "Osmaniye Eczaci Odasi",
    "baseUrl": "https://www.osmaniyeeczaciodasi.org.tr",
    "htmlSelectors": {
      "itemSelector": "div.col-lg-6.col-md-6.col-sm-6.col-xs-12",
      "nameSelector": "h4, h5, h6, .eczane-baslik",
      "addressSelector": "p:nth-of-type(1)",
      "phoneSelector": "p:nth-of-type(2)"
    }
  },
  {
    "code": "rize",
    "displayName": "Rize",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.trabzoneczaciodasi.org.tr/nobetci-eczaneler/53",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Rize Eczaci Odasi",
    "baseUrl": "https://www.trabzoneczaciodasi.org.tr"
  },
  {
    "code": "sakarya",
    "displayName": "Sakarya",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.seo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Sakarya Eczaci Odasi",
    "baseUrl": "https://www.seo.org.tr"
  },
  {
    "code": "samsun",
    "displayName": "Samsun",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.samsuneczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Samsun Eczaci Odasi",
    "baseUrl": "https://www.samsuneczaciodasi.org.tr"
  },
  {
    "code": "sanliurfa",
    "displayName": "Sanliurfa",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.sanliurfaeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Sanliurfa Eczaci Odasi",
    "baseUrl": "https://www.sanliurfaeo.org.tr"
  },
  {
    "code": "siirt",
    "displayName": "Siirt",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://siirteo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Siirt Eczaci Odasi",
    "baseUrl": "https://siirteo.org.tr"
  },
  {
    "code": "sinop",
    "displayName": "Sinop",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.samsuneczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Sinop Eczaci Odasi",
    "baseUrl": "https://www.samsuneczaciodasi.org.tr"
  },
  {
    "code": "sirnak",
    "displayName": "Sirnak",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://sirnakeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Sirnak Eczaci Odasi",
    "baseUrl": "https://sirnakeo.org.tr"
  },
  {
    "code": "sivas",
    "displayName": "Sivas",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.sivaseo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Sivas Eczaci Odasi",
    "baseUrl": "https://www.sivaseo.org.tr"
  },
  {
    "code": "tekirdag",
    "displayName": "Tekirdag",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.teo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Tekirdag Eczaci Odasi",
    "baseUrl": "https://www.teo.org.tr"
  },
  {
    "code": "tokat",
    "displayName": "Tokat",
    "officialSourceType": "third_party_html",
    "officialSourceUrl": "https://www.tokateo.org/nobetcieczane.aspx",
    "parserKey": "tokat_schedule_v1",
    "format": "html",
    "sourceName": "Tokat Il Saglik Mudurlugu",
    "baseUrl": "https://www.tokateo.org"
  },
  {
    "code": "trabzon",
    "displayName": "Trabzon",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.trabzoneczaciodasi.org.tr/nobetci-eczaneler/61",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Trabzon Eczaci Odasi",
    "baseUrl": "https://www.trabzoneczaciodasi.org.tr"
  },
  {
    "code": "tunceli",
    "displayName": "Tunceli",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.elazigeczaciodasi.org.tr/nobetci-eczaneler/tunceli",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Tunceli Eczaci Odasi",
    "baseUrl": "https://www.elazigeczaciodasi.org.tr"
  },
  {
    "code": "usak",
    "displayName": "Usak",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://usakeczaciodasi.org.tr/usak-nobetci-eczaneler",
    "parserKey": "usak_ajax_v1",
    "format": "html",
    "sourceName": "Usak Eczaci Odasi",
    "baseUrl": "https://usakeczaciodasi.org.tr"
  },
  {
    "code": "van",
    "displayName": "Van",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.vaneczaciodasi.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Van Eczaci Odasi",
    "baseUrl": "https://www.vaneczaciodasi.org.tr"
  },
  {
    "code": "yalova",
    "displayName": "Yalova",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.istanbuleczaciodasi.org.tr/nobetci-eczane/",
    "parserKey": "istanbul_secondary_v1",
    "format": "html",
    "sourceName": "Istanbul Eczaci Odasi",
    "baseUrl": "https://www.istanbuleczaciodasi.org.tr"
  },
  {
    "code": "yozgat",
    "displayName": "Yozgat",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.yozgateo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Yozgat Eczaci Odasi",
    "baseUrl": "https://www.yozgateo.org.tr"
  },
  {
    "code": "zonguldak",
    "displayName": "Zonguldak",
    "officialSourceType": "chamber_html",
    "officialSourceUrl": "https://www.zeo.org.tr/nobetci-eczaneler",
    "parserKey": "generic_auto_v1",
    "format": "html",
    "sourceName": "Zonguldak Eczaci Odasi",
    "baseUrl": "https://www.zeo.org.tr"
  }
]);

const byCode = new Map(PROVINCE_SOURCES.map((entry) => [entry.code, entry]));

/** @returns {ProvinceSourceConfig | null} */
export function getProvinceSourceConfig(code) {
  return byCode.get(String(code || "").toLowerCase()) ?? null;
}

/** @returns {readonly ProvinceSourceConfig[]} */
export function listProvinceSourceConfigs() {
  return PROVINCE_SOURCES;
}

/**
 * Validates catalog coverage and shape; returns issues without throwing.
 * @returns {string[]}
 */
export function validateProvinceSourceCatalog() {
  const issues = [];
  const provinceSlugs = new Set(PROVINCES.map((p) => p.slug));
  const configSlugs = new Set(PROVINCE_SOURCES.map((p) => p.code));

  for (const slug of provinceSlugs) {
    if (!configSlugs.has(slug)) issues.push(`missing_config:${slug}`);
  }
  for (const slug of configSlugs) {
    if (!provinceSlugs.has(slug)) issues.push(`unknown_config_code:${slug}`);
  }

  const duplicates = new Map();
  for (const entry of PROVINCE_SOURCES) {
    const key = `${entry.format}::${entry.officialSourceUrl}`;
    const arr = duplicates.get(key) ?? [];
    arr.push(entry.code);
    duplicates.set(key, arr);

    if (!/^https?:\/\//i.test(entry.officialSourceUrl)) {
      issues.push(`invalid_url:${entry.code}:${entry.officialSourceUrl}`);
    }
  }

  for (const [key, slugs] of duplicates.entries()) {
    if (slugs.length > 1) {
      issues.push(`shared_endpoint:${key}:${slugs.join(",")}`);
    }
  }

  return issues;
}
