# Source Onboarding (81 Il)

Bu dosya, resmi kaynak linkleri geldikce tum illeri hizli sekilde sisteme baglamak icindir.

## Girdi Dosyasi
- Dosya: `infra/sources/province-links.csv`
- Kolonlar:
  - `province_slug` (zorunlu)
  - `primary_url` (zorunlu)
  - `secondary_url` (opsiyonel)
  - `primary_format`, `secondary_format` (opsiyonel)
  - `primary_parser_key`, `secondary_parser_key` (opsiyonel)
  - `primary_source_name`, `secondary_source_name` (opsiyonel)
  - `poll_cron` (opsiyonel, default `0 * * * *`)

## Senkron Komutu
- `pnpm sources:sync`

## Katı Modlar
- Tum 81 il primer kaynak zorunlu:
  - `REQUIRE_ALL_81=1 pnpm sources:sync`
- Dosyada olmayan endpointleri pasiflestir:
  - `PRUNE_MISSING_ENDPOINTS=1 pnpm sources:sync`
- e-Devlet secondary endpointlerini aktif et:
  - `ENABLE_TITCK_SECONDARY=1 pnpm sources:sync`
  - Not: varsayilan `0` (kapali), cunku bu endpointte kurumsal entegrasyon/kimlik adimi gerekebilir.

## Parser/Fallback Kurallari
- Ozel parserlar otomatik atanir:
  - Osmaniye, Adana, Istanbul bilinen endpointleri
- Diger HTML kaynaklar:
  - `generic_auto_v1`
- `pdf/api` formatlari icin parser anahtari dosyada acik girilmelidir.
