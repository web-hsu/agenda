# Panduan Deploy: GitHub Pages + Apps Script (Spreadsheet & Drive)

Struktur:
- `site/`        → diunggah ke GitHub (halaman web)
- `apps-script/` → `Kode.gs` ditempel ke Apps Script (JANGAN diunggah ke GitHub)

Cara kerja: halaman di GitHub Pages memanggil Apps Script (Web App) lewat `fetch`.
Data tetap di Spreadsheet (dan Calendar) milik akun Google Anda. Tidak ada database baru.


## Sheet Users (tanpa kolom Password)
Kolom sheet `Users` sekarang: A=Username, B=Role, C=NamaLengkap, D=Pimpinan, E=Modul.
Jika masih ada kolom Password, kode akan menghapusnya otomatis; jika sudah dihapus manual, tidak perlu melakukan apa-apa.

## Catatan
- Panggilan pertama setelah lama tidak dipakai bisa lambat 2-5 detik (Apps Script "cold start").
- Kuota Apps Script (Web App & Calendar) tetap berlaku seperti sebelumnya.
- Google Drive: kode ini tidak memakai DriveApp. Data tersimpan di Spreadsheet (yang berada di Drive Anda), jadi tidak ada pengaturan tambahan.
