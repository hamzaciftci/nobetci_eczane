# Nobetci Eczane Platform (MVP Start)

Bu repo, `business_plan.pdf` referansina sadik kalarak baslatilan teknik MVP iskeletidir.

## Stack
- Web: Next.js App Router (ISR)
- API: NestJS + PostgreSQL + Redis
- Ingestion: BullMQ worker (primer/sekonder adapter + cross-check)

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
3. Neon schema + migration:
   - `pnpm db:bootstrap`
4. Web Vercel env:
   - `NEXT_PUBLIC_API_BASE_URL=https://<api-domain>.vercel.app`

### Mevcut DB'yi Sprint 2'ye guncelleme
- Mevcut volume kullaniyorsaniz migration scriptini calistirin:
  - `Get-Content infra/postgres/migrations/20260220_sprint2.sql -Raw | docker exec -i nobetci-postgres psql -U postgres -d nobetci`
  - `Get-Content infra/postgres/migrations/20260220_live_realdata.sql -Raw | docker exec -i nobetci-postgres psql -U postgres -d nobetci`

## Endpoints
- `GET /api/iller`
- `GET /api/il/{il}/nobetci`
- `GET /api/il/{il}/{ilce}/nobetci`
- `GET /api/nearest?lat=&lng=`
- `POST /api/yanlis-bilgi`
- `GET /api/admin/ingestion/metrics`
- `GET /api/admin/ingestion/overview`
- `GET /api/admin/ingestion/{il}`
- `GET /api/admin/ingestion/alerts/open`
- `POST /api/admin/ingestion/alerts/{id}/resolve`
- `POST /api/admin/ingestion/recovery/{il}/trigger`
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
- Parser veya kaynak hatasinda static fallback devreye girer ve `ingestion_alerts` tablosuna olay yazilir.
- `source_endpoints` bos ise worker dahili pilot endpoint konfigu ile calismayi surdurur.
- Web sayfalarinda OSM + Leaflet harita ve tamamen client-side "en yakin" modulu aktif.
- `ADMIN_API_TOKEN` tanimliysa admin endpointlerinde `x-admin-token` gerekir.
- `20260220_live_realdata.sql` migration'i `Eczaneler.gen.tr` kaynaklarini pasiflestirir; Adana ve Osmaniye resmi kaynaklarini aktif eder.

## Utility Scripts
- `pnpm smoke`
- `pnpm test:manual-override`
- `pnpm db:bootstrap`
- `scripts/deploy-staging.ps1`
- `scripts/deploy-production.ps1`
