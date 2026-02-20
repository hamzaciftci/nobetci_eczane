# MVP Sprint Plan (8 Weeks)

## Sprint 1 (Week 1-2)
- Monorepo setup (web/api/worker/shared)
- PostgreSQL schema + Redis + Docker compose
- API endpoint skeleton (`/api/iller`, `/api/il/:il/nobetci`, `/api/il/:il/:ilce/nobetci`)
- Initial pages: home + il route

## Sprint 2 (Week 3-4)
- BullMQ worker + adapter registry
- Primer/sekonder cross-check and confidence scoring
- Conflict persistence (`duty_conflicts`)
- `source_endpoints` tabanli fetch + parser + fallback
- Ingestion run/snapshot/alert kayitlari (`ingestion_runs`, `source_snapshots`, `ingestion_alerts`)

## Sprint 3 (Week 5-6)
- District page + source transparency badges
- Wrong info report flow (`/yanlis-bilgi-bildir`)
- Structured data JSON-LD (Pharmacy)
- Legal pages and cookie preference panel
- OSM + Leaflet map section (province/district pages)
- Client-side nearest pharmacy flow (location never sent to server)
- Admin ingestion advanced metrics endpoint and dashboard

## Sprint 4 (Week 7-8)
- Degraded mode UI and recovery path
- Alert and operational logs baseline
- Smoke tests + production hardening
- Staging deployment scripts and release checklist
- Health readiness checks (`/health/ready`)
- Admin recovery trigger + alert resolve actions

## KPI Targets
- API p95 latency < 250 ms (cache-hit path)
- Parse success rate >= 95% (pilot adapters)
- Conflict ratio tracked daily
- Source transparency coverage = 100% in UI
