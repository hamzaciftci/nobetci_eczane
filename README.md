# Nobetci Eczane Web + Vercel Backend

Bu proje Vite + React frontend ve Vercel serverless backend fonksiyonlarindan olusur.
Backend veri katmani Neon PostgreSQL uzerinden calisir.

## API Endpoints

- `GET /api/health`
- `GET /api/iller`
- `GET /api/il/{il}/nobetci`
- `GET /api/il/{il}/{ilce}/nobetci`
- `GET /api/nearest?lat=&lng=`
- `POST /api/yanlis-bilgi`
- `GET /api/admin/ingestion/overview`
- `GET /api/admin/ingestion/alerts/open`
- `POST /api/admin/ingestion/alerts/{id}/resolve`
- `POST /api/admin/ingestion/recovery/{il}/trigger`
- `GET /api/admin/ingestion/accuracy`
- `POST /api/realtime-override/{province}/refresh`

## Kurulum

```bash
npm install
```

`.env.example` dosyasini kopyalayip `.env` olusturun.

Lokalde Vercel fonksiyonlari ile calismak icin:

```bash
npm run dev:vercel
```

## Vercel + Neon Kurulumu

1. Neon uzerinde bir PostgreSQL veritabani olusturun.
2. Connection string'i alin (`postgres://...`).
3. Vercel -> Project -> Settings -> Environment Variables:
   - `DATABASE_URL` = Neon connection string
   - `ADMIN_API_TOKEN` = admin endpoint token (onerilir)
   - `VITE_API_BASE_URL` = bos birakin (same-origin `/api`)
4. Vercel deploy alin.
5. Test:
   - `/api/health`
   - `/api/iller`

Notlar:

- Backend tablolari ilk istekle otomatik olusturulur.
- 81 il kaydi backend tarafinda otomatik seed edilir.
- Nobetci kayitlari `duty_records` tablosundan okunur.
- Lokal Vite gelistirmesinde harici backend'e yonlenmek isterseniz `VITE_API_PROXY_TARGET` kullanabilirsiniz.
- Elle bootstrap icin: `npm run db:init`

## Gelistirme Komutlari

```bash
npm run dev
npm run lint
npm run test
npm run build
```
