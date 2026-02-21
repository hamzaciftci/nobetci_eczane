# Deployment Plan

## Web (Vercel)
- Project root: `apps/web`
- Build command: `pnpm --filter @nobetci/web build`
- Runtime env:
  - `NEXT_PUBLIC_API_BASE_URL` (Vercel backend domain, örn `https://nobetci-api.vercel.app`)
  - `NEXT_PUBLIC_SITE_URL`
  - `NEXT_PUBLIC_DEFAULT_CITY`

## API (Vercel + Neon)
- Project root: `apps/api`
- Entry: `api/[[...route]].ts` (NestJS serverless handler)
- Runtime env:
  - `DATABASE_URL` (Neon pooled URL, `sslmode=require`)
  - `REDIS_URL` (opsiyonel, Upstash vb.) veya `REDIS_MODE=memory`
  - `CORS_ORIGIN` (`https://<web-domain>.vercel.app`)
  - `ADMIN_API_TOKEN`
  - `RATE_LIMIT_TTL`
  - `RATE_LIMIT_LIMIT`
  - `DB_POOL_MAX=1` (serverless icin onerilir)
- DB bootstrap:
  - `pnpm db:bootstrap`
  - Script once-off calisir, init/migration SQL dosyalarini uygular.
  - Kaynak endpoint dosyasini DB'ye basmak icin: `pnpm sources:sync`

## Worker (VPS)
- Start Worker: `pnpm --filter @nobetci/worker start`
- Required env:
  - `DATABASE_URL` (Neon URL da olabilir)
  - `REDIS_URL`
  - `PROVINCE_SLUGS`
  - `ALLOW_STATIC_FALLBACK` (`0` onerilir)
  - `ALLOW_FALLBACK_FOR_SECONDARY`

## Worker Alternative (GitHub Actions Cron)
- Workflow: `.github/workflows/ingestion-cron.yml`
- Schedule: her saat basi (`0 * * * *`)
- Required secret:
  - `DATABASE_URL`
- Optional variable:
  - `INGESTION_PROVINCES` (`all`)
- Command:
  - `pnpm ingest:once`

## Data Layer
- Neon PostgreSQL (daily backup + PITR)
- Redis (Upstash/managed) veya API icin memory fallback

## Release Flow
1. `pnpm db:bootstrap` ile Neon schema/migration uygula
2. `pnpm sources:sync` ile `infra/sources/province-links.csv` kayitlarini DB'ye yukle
3. API deploy (Vercel, `apps/api`)
4. Web deploy (Vercel, `apps/web`)
5. Smoke checks (`/api/health/ready`, `/api/iller`, il endpointleri)
6. Worker deploy (VPS) ve ingestion log kontrolu
   - Alternatif: GitHub Actions cron run success kontrolu

## Scripts
- `scripts/deploy-staging.ps1`
- `scripts/deploy-production.ps1`
- `scripts/smoke.mjs`
- `apps/api/scripts/db-bootstrap.mjs` (wrapper: `pnpm db:bootstrap`)

## Compose Files
- `infra/deploy/docker-compose.staging.yml`
- `infra/deploy/docker-compose.production.yml`
