# UNSIA Library Backend

REST API Express.js untuk UNSIA Digital Library.

## Persyaratan

- Node.js 24 atau lebih baru
- MongoDB lokal atau MongoDB Atlas

## Menjalankan aplikasi

```bash
npm install
copy .env.example .env
npm run dev
```

API tersedia pada `http://localhost:3000/api/v1`. Endpoint awal yang tersedia adalah `GET /health`.

## Verifikasi

```bash
npm run lint
npm run format:check
npm test
```

Struktur kode memisahkan konfigurasi, controller, middleware, route, dan test agar fitur domain berikutnya dapat ditambahkan secara modular.
