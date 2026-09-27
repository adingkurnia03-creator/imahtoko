# ImahKu — Marketplace Bahan Pokok & Perkebunan, Peternakan, Perikanan

Frontend statis (HTML/CSS/JS murni) untuk marketplace ImahKu. Backend berjalan terpisah di Google Apps Script sebagai REST API (lihat folder `backend/` di paket instalasi, atau berkas `Kode.gs` yang dikirim terpisah).

## Struktur Folder

```
├── index.html          ← Halaman utama (root, WAJIB di sini untuk GitHub Pages)
│                          Berisi juga konfigurasi GAS_URL (cari <script> di dekat penutup </body>)
├── css/
│   └── style.css        ← Semua styling (token warna, layout, komponen)
├── js/
│   ├── api.js             ← Jembatan komunikasi ke backend (fetch)
│   └── app.js              ← Seluruh logika aplikasi (katalog, checkout, admin)
├── README.md
└── PANDUAN-INSTALASI.md
```

## Sebelum Deploy

1. Deploy backend (`Kode.gs`) di Google Apps Script sebagai Web App.
2. Salin URL yang diakhiri `/exec`.
3. Buka `index.html`, cari baris `const GAS_URL = 'PASTE_URL_APPS_SCRIPT_ANDA_DISINI/exec';` (dekat bagian bawah file, sebelum `</body>`), ganti dengan URL tersebut.

Lihat `PANDUAN-INSTALASI.md` untuk langkah lengkap deploy ke GitHub Pages.

## Arsitektur

- **Backend**: Google Apps Script — REST API murni (JSON via `doGet`/`doPost`), Google Sheets sebagai database, Google Drive sebagai storage foto/bukti bayar, Gmail untuk notifikasi.
- **Frontend**: HTML/CSS/JS vanilla (tanpa framework/build step), berkomunikasi ke backend lewat `fetch()`.
- **Admin**: Login berbasis token (disimpan di `sessionStorage`), tervalidasi di server lewat `CacheService`.

## Fitur

- Katalog produk publik dengan pencarian & filter kategori
- Checkout multi-langkah dengan upload bukti transfer
- Lacak status pesanan
- Dashboard admin: kelola pesanan, produk, pelanggan, laporan, pengaturan toko
- Notifikasi email otomatis + tombol kirim invoice manual via WhatsApp
