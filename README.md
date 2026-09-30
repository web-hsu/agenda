# Panduan Deploy: GitHub Pages + Apps Script (Spreadsheet & Drive)

Struktur:
- `site/`        → diunggah ke GitHub (halaman web)
- `apps-script/` → `Kode.gs` ditempel ke Apps Script (JANGAN diunggah ke GitHub)

Cara kerja: halaman di GitHub Pages memanggil Apps Script (Web App) lewat `fetch`.
Data tetap di Spreadsheet (dan Calendar) milik akun Google Anda. Tidak ada database baru.

## Langkah 1 - Perbarui Apps Script
1. Buka proyek Apps Script yang terhubung ke Spreadsheet (Extensions > Apps Script).
2. Ganti seluruh isi `Kode.gs` dengan file `apps-script/Kode.gs`.
3. File HTML lama di proyek Apps Script (Index, Admin, BukuTamu, DaftarTamu) tidak dipakai lagi. Boleh dihapus setelah semuanya berjalan.
4. Deploy > **New deployment** > jenis **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Klik Deploy, izinkan akses (Spreadsheet, Calendar), lalu salin **Web app URL** (`https://script.google.com/macros/s/.../exec`).
6. Buka URL itu di browser. Jika muncul `{"ok":true,"service":"Agenda Pimpinan API",...}`, API aktif.

Setiap kali Kode.gs diubah: Deploy > Manage deployments > ikon pensil > Version: **New version** > Deploy.
Kalau tidak, URL yang sama tetap menjalankan kode lama.

## Langkah 2 - Isi URL API
Buka `site/config.js`, ganti `PASTE_URL_WEB_APP_DI_SINI` dengan Web app URL tadi.

## Langkah 3 - Unggah ke GitHub
1. Buat repository baru di GitHub (mis. `agenda-pimpinan`).
2. Unggah **isi folder `site/`** (index.html, admin.html, bukutamu.html, daftartamu.html, config.js, gas-shim.js, .nojekyll) ke root repository.
3. Settings > Pages > Source: **Deploy from a branch** > Branch: `main` / `(root)` > Save.
4. Tunggu 1-2 menit. Alamat: `https://USERNAME.github.io/NAMA-REPO/`

## Alamat halaman baru
| Fungsi | Sebelumnya | Sekarang |
|---|---|---|
| Pengajuan tamu | `/exec` | `/index.html` |
| Admin | `?page=admin` | `/admin.html` |
| Buku Tamu Bupati | `?page=bukutamu&pimpinan=bupati` | `/bukutamu.html?pimpinan=bupati` |
| Buku Tamu Wabup | `...pimpinan=wabup` | `/bukutamu.html?pimpinan=wabup` |
| Buku Tamu Sekda | `...pimpinan=sekda` | `/bukutamu.html?pimpinan=sekda` |
| Daftar Tamu | `?page=daftartamu` | `/daftartamu.html` (opsional `?pimpinan=...`) |

Link dan QR code di halaman Daftar Tamu otomatis memakai alamat GitHub yang baru.

## Langkah 4 (opsional) - Link/QR lama tetap hidup
Isi `GITHUB_PAGES_URL` di `Kode.gs` dengan alamat GitHub Pages Anda, lalu deploy versi baru. Link lama `script.google.com/...?page=...` akan menampilkan tombol yang mengarah ke halaman baru. Tetap disarankan mencetak ulang QR dengan alamat baru.

## Sheet Users (tanpa kolom Password)
Kolom sheet `Users` sekarang: A=Username, B=Role, C=NamaLengkap, D=Pimpinan, E=Modul.
Jika masih ada kolom Password, kode akan menghapusnya otomatis; jika sudah dihapus manual, tidak perlu melakukan apa-apa.

## Keamanan (penting)
- Repository publik = semua orang bisa membaca `config.js` (URL API). Itu tidak bisa dihindari pada model ini. Karena itu API dibatasi:
  - Fungsi admin (tambah/ubah/hapus agenda, status pengajuan, kalender) hanya jalan dengan token login.
  - Daftar Tamu publik tidak menerima nomor WA tamu.
  - Fungsi selain daftar API (mis. `simulasiData`) tidak bisa dipanggil dari luar.
- Login masih **hanya username**, dan akun bawaan (`SAdmin@2026`, `AdminBupati@2026`, dst.) tertulis di Kode.gs. Ganti username di sheet `Users` dengan yang sulit ditebak sebelum dipublikasikan.
- Jangan unggah `Kode.gs` ke repository publik.

## Uji setelah deploy
1. Buka `bukutamu.html?pimpinan=bupati`, isi dan kirim → baris baru muncul di sheet `Agenda_bupati`.
2. Buka `index.html`, kirim pengajuan → muncul di sheet `Pengajuan`, lalu cek kodenya.
3. Buka `admin.html`, login → agenda & pengajuan tampil, coba setujui pengajuan.
4. Buka `daftartamu.html` → tamu yang disetujui tampil.

## Catatan
- Panggilan pertama setelah lama tidak dipakai bisa lambat 2-5 detik (Apps Script "cold start").
- Kuota Apps Script (Web App & Calendar) tetap berlaku seperti sebelumnya.
- Google Drive: kode ini tidak memakai DriveApp. Data tersimpan di Spreadsheet (yang berada di Drive Anda), jadi tidak ada pengaturan tambahan.
