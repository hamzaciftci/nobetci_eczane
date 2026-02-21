# Nobetci Eczane Platform Architecture

## Core Principles
- Dogruluk > hiz
- Kaynak seffafligi zorunlu
- Scraping fallback olarak kademeli
- KVKK privacy-by-design

## Runtime Components
- `apps/web`: Next.js App Router, ISR + stale-while-revalidate, OSM+Leaflet map, client-side nearest
- `apps/api`: NestJS public read API + correction endpoint
- `apps/worker`: BullMQ ingestion worker, cross-check, conflict queue
- `postgres`: canonical storage + snapshot/conflict history
- `redis`: hot cache + queue backend

## Data Flow
1. Worker `source_endpoints` tablosundan aktif kaynaklari province bazli yukler.
2. Primer endpoint fetch + parse + `ingestion_runs`/`source_snapshots` kayitlari yazilir.
3. Primer hata verirse varsayilan davranis fallback kullanmamak ve son dogru veriyi korumaktir (fallback sadece explicit acil durum bayragi ile acilir).
4. Sekonder kaynakla kayit bazli eslestirme ve confidence skorlama yapilir.
5. Cakisma olursa `duty_conflicts` tablosuna yazilir.
6. Onayli kayit `duty_records` + `duty_evidence` ile yayinlanir.
7. API Redis cache ile cevap verir, Web ISR route'lari bu veriyi sunar.

## Observability
- `GET /api/admin/ingestion/metrics`: parser error rate, coverage ratio, conflict ratio, in-memory API cache hit ratio.
- `GET /api/admin/ingestion/overview`: il bazli run ozeti.
- `GET /api/admin/ingestion/{il}`: il bazli son run/alert detaylari.
- `GET /api/admin/ingestion/alerts/open`: acik operasyon alarmlari.
- `POST /api/admin/ingestion/recovery/{il}/trigger`: acil yeniden cekim tetikleme.

## Degraded Mode
- Primer kaynak basarisiz, sekonder varsa `is_degraded = true`.
- UI banner: son basarili guncelleme zamani + stale dakika + son alarm bilgisi.

## KVKK Notes
- Konum verisi varsayilan olarak server'a gonderilmez.
- Cerez paneli opt-in mantiginda.
- Analytics MVP'de kapali veya self-hosted.
