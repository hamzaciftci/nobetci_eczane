# Release Checklist

## Pre-Release
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm smoke` (staging URL with live services)
- [ ] Migration script applied (`infra/postgres/migrations/20260220_sprint2.sql`)

## Operational
- [ ] `GET /health`
- [ ] `GET /health/ready`
- [ ] `GET /api/admin/ingestion/metrics`
- [ ] Open alerts reviewed (`/api/admin/ingestion/alerts/open`)
- [ ] Degraded provinces checked and recovery triggered where needed

## Security
- [ ] `ADMIN_API_TOKEN` configured
- [ ] `CORS_ORIGIN` restricted
- [ ] Secrets rotated and deployment logs stored

## Post-Release
- [ ] 30 min monitoring window (latency, cache hit ratio, parser error rate)
- [ ] Conflict ratio compared with previous release
- [ ] Rollback decision window documented
