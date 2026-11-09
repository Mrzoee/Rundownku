# Rundownku — Perencana Rute & Itinerary Perjalanan Multi-Hari (Stippl-Style)

**Rundownku** adalah aplikasi web perencana perjalanan (*itinerary & visual route planner*) bergaya **Stippl** yang dibangun dengan **React 19 + TypeScript + Tailwind CSS v4 + Leaflet + Hybrid Database (IndexedDB Dexie + Supabase Cloud Sync)**.

## Fitur Utama

- **Split-Screen Workspace ala Stippl**: Panel jadwal perjalanan multi-hari di sisi kiri dan peta rute interaktif secara berdampingan di layar desktop (serta switcher cepat di layar mobile).
- **Multi-Day & Multi-Stop Itinerary**:
  - Susun perjalanan berdasarkan rentang tanggal (`Mulai` – `Selesai`) atau jumlah hari (`Hari 1`, `Hari 2`, `Hari 3`, dst.).
  - Setiap hari memiliki warna penanda rute & nomor urut pin yang unik serta sinkron 100% antara kartu jadwal dan pin peta.
  - Kategori aktivitas bersih (`Wisata & Spot`, `Kuliner & Kafe`, `Belanja & Oleh-oleh`, `Acara / Kegiatan`, `Istirahat / Santai`, `Lainnya`), catatan tips, dan estimasi biaya tanpa kerumitan tiket hotel/transportasi.
- **Visualisasi Garis Rute Lengkung & Kalkulasi Jarak Otomatis**:
  - Garis rute melengkung (*Bezier curve*) antar titik destinasi di atas peta OpenStreetMap.
  - Kalkulasi jarak (`km`) dan estimasi waktu tempuh otomatis di sela-sela kartu destinasi berurutan, lengkap dengan tombol navigasi langsung ke **Google Maps Directions**.
- **Berbagi & Ekspor Tanpa Ribet**:
  - **Salin ke WhatsApp**: Menghasilkan ringkasan teks rapi per hari beserta tautan Google Maps dan total estimasi biaya.
  - **Bagikan Link (`?share=...`)**: Bagikan seluruh jadwal perjalanan lewat satu URL tanpa perlu login.
  - **Cetak / Simpan PDF**: Dukungan cetak halaman bersih.
- **Database Hybrid (Offline IndexedDB + Supabase Cloud)**:
  - Berjalan **langsung secara lokal (Offline-First)** menggunakan IndexedDB (`Dexie.js`).
  - Dapat dihubungkan kapan saja ke **Supabase** melalui file `.env` ataupun langsung lewat tombol **Mode Lokal / Supabase Aktif** di pojok kanan atas aplikasi.

## Cara Menjalankan Proyek

```bash
npm install
npm run dev
```

## Cara Menghubungkan ke Database Gratis Supabase (Opsional)

1. Buat project baru gratis di [Supabase](https://supabase.com).
2. Buka menu **SQL Editor** di dashboard Supabase Anda, lalu jalankan isi file [`supabase/schema.sql`](./supabase/schema.sql) (atau klik tombol **Salin SQL Schema** langsung dari modal database di dalam aplikasi).
3. Masukkan `Project URL` dan `Anon Key` melalui salah satu cara berikut:
   - **Cara 1 (Langsung di UI)**: Klik tombol **Mode Lokal** di pojok kanan atas aplikasi, tempel URL & Anon Key, lalu klik **Simpan & Sinkronkan**.
   - **Cara 2 (Via File `.env`)**: Salin `.env.example` menjadi `.env` dan isi:
     ```env
     VITE_SUPABASE_URL=https://project-anda.supabase.co
     VITE_SUPABASE_ANON_KEY=anon-key-anda
     ```
