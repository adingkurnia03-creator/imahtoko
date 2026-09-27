# 📋 PANDUAN INSTALASI — ImahKu (Arsitektur Terpisah)

Arsitektur baru: **Backend** (Google Apps Script, REST API JSON) dan **Frontend** (situs statis di GitHub Pages) berjalan **terpisah sepenuhnya** dan berkomunikasi lewat `fetch()`.

---

## BAGIAN 1 — Deploy Backend (Google Apps Script)

1. Buka [script.google.com](https://script.google.com) → **New Project**.
2. Hapus isi file `Code.gs` bawaan, ganti nama file jadi `Kode` (otomatis jadi `Kode.gs`).
3. Paste seluruh isi `Kode.gs` yang dikirim terpisah (bukan dari dalam ZIP frontend ini).
4. Jalankan setup sekali:
   - Pilih fungsi `setupAppEnvironment` di dropdown atas → klik ▶ **Run**.
   - Klik **Review permissions** → izinkan akses Drive, Sheets, Gmail.
   - Buka **Execution log** — pastikan muncul `✅ Setup ImahKu selesai!`.
   - Cek Google Drive: folder `ImahKu_MarketplaceData` sudah terbuat.
   - ⚠️ **Jangan jalankan `setupAppEnvironment` lebih dari sekali** (nanti data dobel).
5. **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy** → salin URL yang diakhiri **`/exec`**.

> 🔑 Login admin default setelah setup: **username `admin`**, **password `imahku2024`** — segera ganti di sheet `Users` pada spreadsheet `DB_ImahKu`.

---

## BAGIAN 2 — Isi URL Backend ke Frontend

1. Buka file `index.html` di folder frontend ini (pakai Notepad/TextEdit/editor apa saja).
2. Cari baris ini (dekat bagian bawah file, sebelum `</body>`):
   ```html
   const GAS_URL = 'PASTE_URL_APPS_SCRIPT_ANDA_DISINI/exec';
   ```
3. Ganti bagian `'PASTE_URL_APPS_SCRIPT_ANDA_DISINI/exec'` dengan URL `/exec` dari Bagian 1, contoh:
   ```html
   const GAS_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
   ```
4. Simpan file.

> 💡 Kalau sampai lupa mengisi ini, halaman akan menampilkan pita merah besar di atas layar yang menjelaskan persis apa yang harus diperbaiki — jadi tidak akan macet tanpa penjelasan.

---

## BAGIAN 3 — Deploy Frontend ke GitHub Pages

**Folder kerja untuk langkah di bawah ini adalah folder hasil ekstrak ZIP ini** (folder yang berisi `index.html` langsung di dalamnya, sejajar dengan `css/` dan `js/`) — bukan folder induknya.

### 3a. Cek & install Git
```bash
git --version
```
Belum ada? Windows: unduh di [git-scm.com/download/win](https://git-scm.com/download/win). Mac: buka Terminal, ketik `git --version`, ikuti instalasi otomatis.

### 3b. Setup identitas Git (sekali saja)
```bash
git config --global user.name "Nama Anda"
git config --global user.email "email@anda.com"
```

### 3c. Buat repository di GitHub
Di [github.com](https://github.com): tombol **+** → **New repository** → beri nama (mis. `imahku`) → pilih **Public** → **jangan** centang README/gitignore/license → **Create repository**.

### 3d. Masuk ke folder frontend & verifikasi
```bash
cd "path/ke/folder/ini"
dir
```
(Mac/Linux: `ls -la`)

Pastikan `index.html` muncul **langsung** di hasil `dir`/`ls` — bukan di dalam folder lain.

### 3e. Push pertama kali
Jalankan satu per satu:
```bash
git init
git add .
git commit -m "Upload pertama ImahKu"
git branch -M main
git remote add origin https://github.com/USERNAME/imahku.git
git push -u origin main
```
Ganti `USERNAME` dengan username GitHub Anda. Saat diminta password, gunakan **Personal Access Token** (bukan password akun) — buat di [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic) → centang scope **repo**.

### 3f. Aktifkan GitHub Pages
Di repo GitHub: **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main** / **(root)** → **Save**.

Tunggu 1-2 menit → situs live di `https://USERNAME.github.io/imahku/`.

---

## BAGIAN 4 — Uji Coba

1. Buka URL GitHub Pages Anda.
2. Katalog produk harus muncul (bukti `fetch` ke backend berhasil).
3. Coba checkout satu pesanan test.
4. Login admin (username/password di atas) → cek **Kelola Pesanan** menampilkan pesanan test tadi.
5. Buka DevTools (F12) → tab **Network** → pastikan tidak ada error CORS berwarna merah.

---

## Update Selanjutnya

Setiap kali ada perubahan file frontend:
```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```
GitHub Pages otomatis rebuild dalam 1-2 menit (hard refresh `Ctrl+Shift+R` kalau masih tampil versi lama).

Untuk perubahan backend: edit `Kode.gs` di Script Editor → **Deploy → Manage deployments → Edit → Version: New version → Deploy** (URL `/exec` tetap sama, tidak perlu ubah `config.js` lagi).

---

## Troubleshooting Cepat

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman putih/kosong, atau pita merah muncul di atas | `GAS_URL` di `index.html` belum diisi/salah | Cek ulang baris `const GAS_URL = ...` di dalam `index.html` |
| Data tidak muncul tapi tidak ada error | Backend belum di-deploy ulang setelah edit | Deploy → Manage deployments → New version |
| CSS tidak muncul (tampilan polos) | Struktur folder `css/`/`js/` rusak saat upload | Pastikan push via `git`, bukan upload manual lewat web GitHub |
| Foto produk tidak muncul | `setupAppEnvironment` belum dijalankan / folder Drive belum ada | Jalankan `setupAppEnvironment` sekali di Apps Script |
