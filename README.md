# UNSIA Library Backend

REST API untuk UNSIA Digital Library. Aplikasi ini menyediakan autentikasi pengguna, pengelolaan katalog buku dan anggota, transaksi peminjaman/pengembalian, riwayat aktivitas, serta ringkasan dashboard.

## Teknologi

- Node.js (ES module) dan Express 5
- MongoDB dengan Mongoose
- JWT dan bcrypt untuk autentikasi
- Zod untuk validasi input
- Pino untuk request logging, Helmet untuk security headers, dan CORS
- Vitest, ESLint, dan Prettier untuk pengujian serta kualitas kode

## Fitur

- Registrasi, login, dan pengambilan profil pengguna yang sedang masuk menggunakan JWT.
- CRUD buku dengan data jumlah salinan dan jumlah pinjaman aktif.
- CRUD anggota dengan kode keanggotaan yang dibuat otomatis dalam format `UNSIA` diikuti angka.
- Pembuatan peminjaman untuk satu atau beberapa buku, termasuk pemeriksaan ketersediaan salinan dan pencegahan buku duplikat dalam satu transaksi.
- Pengembalian buku yang memperbarui jumlah pinjaman aktif.
- Riwayat audit untuk perubahan buku, anggota, serta transaksi peminjaman dan pengembalian.
- Dashboard dengan total buku, anggota, pinjaman aktif, pinjaman terlambat, status pinjaman bulan berjalan, dan lima aktivitas terbaru.
- Health check publik, respons error terstruktur, validasi request, security headers, CORS, dan batas payload JSON 1 MB.

## Menjalankan Server di Lokal

### Prasyarat

- Node.js versi 24 atau lebih baru
- npm
- MongoDB yang dapat diakses, baik MongoDB lokal maupun MongoDB Atlas

### 1. Instal dependensi

Jalankan dari folder `unsia-library-backend`:

```bash
npm install
```

### 2. Siapkan environment

Salin template environment menjadi file `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Kemudian isi nilai berikut di `.env`:

| Variabel         | Keterangan                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`       | Environment aplikasi; gunakan `development` untuk pengembangan lokal.                                               |
| `PORT`           | Port HTTP server; default `3000`.                                                                                   |
| `MONGODB_URI`    | URI MongoDB. Wajib diisi karena template `.env.example` menyediakan nilai kosong.                                   |
| `CORS_ORIGIN`    | Origin frontend yang diizinkan; default aplikasi adalah `http://localhost:5173`.                                    |
| `JWT_SECRET`     | Secret acak minimal 32 karakter. Wajib untuk semua environment selain `test`; jangan simpan nilainya di repository. |
| `JWT_EXPIRES_IN` | Masa berlaku token JWT; default `1d`.                                                                               |

### 3. Jalankan development server

Pastikan MongoDB dapat diakses melalui `MONGODB_URI`, lalu jalankan:

```bash
npm run dev
```

Perintah ini menjalankan server melalui Nodemon sehingga server akan dimuat ulang saat file aplikasi berubah. Setelah database tersambung, server tersedia di `http://localhost:<PORT>`; jika `PORT` tidak diubah, gunakan `http://localhost:3000`.

Untuk menjalankan server tanpa mode watch, gunakan:

```bash
npm start
```

Verifikasi server dengan health check publik:

```text
GET http://localhost:3000/api/v1/health
```

## Rute API

Kecuali yang diberi status publik, rute membutuhkan header berikut:

```text
Authorization: Bearer <JWT_TOKEN>
```

| Rute                         | Akses          | Keterangan                         |
| ---------------------------- | -------------- | ---------------------------------- |
| `GET /api/v1/health`         | Publik         | Memeriksa status layanan.          |
| `POST /api/auth/register`    | Publik         | Membuat akun pengguna.             |
| `POST /api/auth/login`       | Publik         | Masuk dan memperoleh JWT.          |
| `GET /api/auth/me`           | Terautentikasi | Mengambil profil pengguna aktif.   |
| `GET /api/books`             | Terautentikasi | Mengambil daftar buku.             |
| `POST /api/books`            | Terautentikasi | Menambahkan buku.                  |
| `PUT /api/books/:id`         | Terautentikasi | Memperbarui buku.                  |
| `DELETE /api/books/:id`      | Terautentikasi | Menghapus buku.                    |
| `GET /api/members`           | Terautentikasi | Mengambil daftar anggota.          |
| `POST /api/members`          | Terautentikasi | Menambahkan anggota.               |
| `PUT /api/members/:id`       | Terautentikasi | Memperbarui anggota.               |
| `DELETE /api/members/:id`    | Terautentikasi | Menghapus anggota.                 |
| `GET /api/loans`             | Terautentikasi | Mengambil daftar peminjaman.       |
| `POST /api/loans`            | Terautentikasi | Membuat transaksi peminjaman.      |
| `PUT /api/loans/:id/return`  | Terautentikasi | Memproses pengembalian peminjaman. |
| `GET /api/dashboard/summary` | Terautentikasi | Mengambil ringkasan dashboard.     |

## Verifikasi

Jalankan pemeriksaan berikut dari folder backend:

```bash
npm run lint
npm run format:check
npm test
```

Untuk menjalankan test dalam mode watch, gunakan `npm run test:watch`.

## Struktur Proyek

- `src/config` — konfigurasi environment, database, dan logger.
- `src/controllers` — logika request untuk autentikasi, buku, anggota, peminjaman, dashboard, dan health check.
- `src/middleware` — autentikasi route serta penanganan error dan route yang tidak ditemukan.
- `src/models` — model MongoDB untuk pengguna, buku, anggota, peminjaman, dan riwayat.
- `src/routes` — definisi endpoint API.
- `tests` — pengujian API dengan Vitest dan Supertest.
