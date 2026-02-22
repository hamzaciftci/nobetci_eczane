# Nobetci Eczane Platform (MVP Start)

Bu repo, `business_plan.pdf` referansina sadik kalarak baslatilan teknik MVP iskeletidir.

## Stack
- Web: Next.js App Router (Node runtime, revalidate=0)
- API: NestJS + PostgreSQL + Redis
- Ingestion: BullMQ worker (03:00 full sync + 10 dk il bazli validate + realtime override)

## Quick Start
1. Kopya env dosyasi:
   - `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
2. Altyapi servisleri:
   - `pnpm db:up`
   - Not: Redis host portu `6380` olarak ayarlandi.
3. Paketleri kur:
   - `pnpm install`
4. Uygulamalari baslat:
   - `pnpm dev`

## Vercel + Neon Backend
1. Neon'dan pooled `DATABASE_URL` alin (`sslmode=require`).
2. API icin ayri Vercel projesi acin:
   - Root Directory: `apps/api`
   - Environment Variables:
     - `DATABASE_URL`
     - `REDIS_MODE=memory` (ya da `REDIS_URL`)
     - `CORS_ORIGIN=https://<web-domain>.vercel.app`
     - `ADMIN_API_TOKEN`
     - `CRON_SECRET`
     - `REALTIME_OVERRIDE_STALE_HOURS=6`
3. Neon schema + migration:
   - `pnpm db:bootstrap`
4. Web Vercel env:
   - `NEXT_PUBLIC_API_BASE_URL=https://<api-domain>.vercel.app`

## Otomatik Veri Guncelleme (GitHub Actions Cron)
1. Bu repo'da `.github/workflows/ingestion-cron.yml`:
  - her 10 dakikada bir (`*/10 * * * *`) validate/pull yapar.
   - her gun 03:00'te (`0 3 * * *`) full sync calistirir.
   - her calismada `pnpm ingest:once` kullanir.
   - Workflow, ingestion oncesi `pnpm sources:sync` calistirarak endpoint listesini DB ile esitler.
2. GitHub repository secret ekleyin:
   - `DATABASE_URL` (Neon pooled URL, `sslmode=require`)
3. Opsiyonel repository variable:
   - `INGESTION_PROVINCES=all`
   - `ENABLE_TITCK_SECONDARY=0|1` (default `0`)
4. Manuel tetikleme:
   - `Actions > Ingestion Cron > Run workflow`

## 81 Il Kaynak Onboarding
1. `infra/sources/province-links.csv` dosyasina linkleri ekleyin.
   - Kolonlar: `province_slug,primary_url,secondary_url,...`
   - `primary_url` zorunlu, `secondary_url` opsiyonel.
2. Kaynaklari DB'ye senkronlayin:
   - `pnpm sources:sync`
3. Tum illerde primer link oldugunu zorunlu kilmak isterseniz:
   - `REQUIRE_ALL_81=1 pnpm sources:sync`
4. Guncel listede olmayan endpointleri otomatik pasiflestirmek icin:
   - `PRUNE_MISSING_ENDPOINTS=1 pnpm sources:sync`
5. e-Devlet secondary endpointlerini aktif etmek icin (varsayilan kapali):
   - `ENABLE_TITCK_SECONDARY=1 pnpm sources:sync`
6. Sonrasinda ingestion calistirin:
   - `pnpm ingest:once`

### Mevcut DB'yi Sprint 2'ye guncelleme
- Mevcut volume kullaniyorsaniz migration scriptini calistirin:
  - `Get-Content infra/postgres/migrations/20260220_sprint2.sql -Raw | docker exec -i nobetci-postgres psql -U postgres -d nobetci`
  - `Get-Content infra/postgres/migrations/20260220_live_realdata.sql -Raw | docker exec -i nobetci-postgres psql -U postgres -d nobetci`

## Endpoints
- `GET /api/iller`
- `GET /api/il/{il}/nobetci`
- `GET /api/il/{il}/nobetci?date=YYYY-MM-DD`
- `GET /api/il/{il}/{ilce}/nobetci`
- `GET /api/il/{il}/{ilce}/nobetci?date=YYYY-MM-DD`
- `GET /api/nearest?lat=&lng=`
- `POST /api/yanlis-bilgi`
- `GET /api/admin/ingestion/metrics`
- `GET /api/admin/ingestion/overview`
- `GET /api/admin/ingestion/{il}`
- `GET /api/admin/ingestion/alerts/open`
- `POST /api/admin/ingestion/alerts/{id}/resolve`
- `POST /api/admin/ingestion/recovery/{il}/trigger`
- `GET/POST /api/cron/full-sync` (`CRON_SECRET` gerekir)
- `GET/POST /api/cron/validate-all` (`CRON_SECRET` gerekir)
- `GET/POST /api/cron/validate/{il}` (`CRON_SECRET` gerekir)
- `POST /api/realtime-override/{il}/refresh` (`x-admin-token` gerekir)
- `GET /health/ready`
- `GET /api/health/ready` (Vercel API route uyumlulugu)

## Web Routes
- `/nobetci-eczane/{il}/yazdir` (A4 cikti sayfasi)
- `/nobetci-eczane/{il}/ekran` (menuler gizli, pano modu)
- `/nobetci-{il}` (legacy uyumluluk, canonical route'a yonlendirilir)

## Notlar
- Konum verisi server'a zorunlu olarak gonderilmez; nearest endpoint opsiyoneldir.
- Worker, `source_endpoints` tablosunda aktif olan primer/sekonder kaynaklari kullanir.
- `PROVINCE_SLUGS=all` iken worker sadece DB'de aktif kaynagi olan illeri otomatik yukler.
- Static fallback varsayilan olarak kapalidir (`ALLOW_STATIC_FALLBACK=0`); acil durumda bilincli olarak acilabilir.
- Production'da static fallback zorla kapatilir; sistem sahte/static eczane listesi yayinlamaz.
- API endpointleri `Cache-Control: no-store` ile doner; CDN/server cache kaynakli stale cevap engellenir.
- Ankara (`https://www.aeo.org.tr/nobetci-eczaneler`) icin worker her run'da bugun + `ANKARA_AEO_FUTURE_DAYS` (varsayilan `6`) gunu da ingest eder.
- `source_endpoints` bos ise worker dahili pilot endpoint konfigu ile calismayi surdurur.
- Web sayfalarinda OSM + Leaflet harita ve tamamen client-side "en yakin" modulu aktif.
- `ADMIN_API_TOKEN` tanimliysa admin endpointlerinde `x-admin-token` gerekir.
- `20260220_live_realdata.sql` migration'i `Eczaneler.gen.tr` kaynaklarini pasiflestirir; Adana ve Osmaniye resmi kaynaklarini aktif eder.
- `20260221_osmaniye_endpoint_refresh.sql` migration'i Osmaniye endpointini `nobetkarti` olarak sabitler.

## Utility Scripts
- `pnpm smoke`
- `pnpm verify:live`
- `pnpm test:manual-override`
- `pnpm db:bootstrap`
- `pnpm sources:sync`
- `pnpm hybrid:full-sync`
- `pnpm hybrid:accuracy-report`
- `scripts/deploy-staging.ps1`
- `scripts/deploy-production.ps1`

## Canli Cron + Worker E2E
Canli API + Web + cron tetik + realtime override + DB probe icin:

`VERIFY_API_BASE_URL=https://nobetci-eczane-api-ten.vercel.app VERIFY_WEB_BASE_URL=https://nobetci-eczane-tau.vercel.app pnpm verify:live`

Opsiyonel env:
- `CRON_SECRET` (cron endpoint korumaliysa)
- `ADMIN_API_TOKEN` (realtime override endpointi icin)
- `DATABASE_URL` (canli DB probe icin)
- `VERIFY_PROVINCE=osmaniye`
