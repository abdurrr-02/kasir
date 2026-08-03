# 🍯 Kasir AG — Rumah Herbal & Madu Murni Abdul Ghani

Aplikasi **kasir POS mobile-first** berbasis web (PWA) yang bisa diakses via Android Chrome dan di-install ke homescreen seperti aplikasi native.

**🔗 Link Aplikasi:** [https://abdurrr-02.github.io/kasir/](https://abdurrr-02.github.io/kasir/)

---

## ✨ Fitur

| Fitur | Keterangan |
|-------|-----------|
| 🧾 **Kasir** | Tampilan produk grid, tambah ke keranjang, checkout cepat |
| 🔍 **Pencarian** | Filter produk realtime saat mengetik |
| 💰 **Nominal Cepat** | Tombol bayar cepat (uang pas, bulat ke atas) |
| 📦 **Manajemen Produk** | Tambah, ubah, hapus produk dengan konfirmasi |
| 🕘 **Riwayat Transaksi** | Histori lengkap, cetak ulang struk |
| 🏠 **Dashboard** | Omzet hari ini, minggu ini, produk terlaris |
| 🖨️ **Printer Bluetooth** | ESC/POS via Web Bluetooth API (Chrome Android) |
| 💾 **Backup Data** | Ekspor/impor JSON untuk backup data |
| 📴 **Offline** | Bekerja tanpa internet setelah pertama kali dibuka |

---

## 📱 Cara Pasang di Android

1. Buka Chrome Android, kunjungi link app
2. Tap menu **⋮** → **"Tambahkan ke layar utama"**
3. Tap **Tambahkan** — App akan muncul di homescreen!

---

## 🖨️ Printer Bluetooth (Thermal)

App mendukung printer thermal BLE (Bluetooth Low Energy) generik seperti EPPOS, Goojprt, dsb.

1. Buka tab **Atur** → **Printer Bluetooth**
2. Tap **Hubungkan Printer**
3. Pilih printer dari daftar Bluetooth
4. Tap **Tes Cetak** untuk verifikasi

> **Catatan:** Web Bluetooth hanya berfungsi di **Chrome Android** (bukan Firefox/Safari)

---

## 🚀 Deploy ke GitHub Pages

```bash
# Clone repo
git clone https://github.com/abdurrr-02/kasir.git
cd kasir

# Copy semua file ke folder repo
# (index.html, style.css, app.js, printer.js, sw.js, manifest.json, icon-*.png)

# Push ke GitHub
git add .
git commit -m "Deploy POS Kasir AG"
git push origin main
```

Lalu aktifkan **GitHub Pages** di Settings repo → Pages → Source: `main branch / root`.

---

## 💻 Teknologi

- **HTML/CSS/JavaScript** murni (tanpa framework)
- **PWA** (Progressive Web App) dengan Service Worker
- **Web Bluetooth API** untuk printer ESC/POS BLE
- **localStorage** untuk penyimpanan data lokal

---

## 📄 Lisensi

MIT — bebas digunakan dan dimodifikasi.

---

*Dibuat dengan ❤️ untuk Rumah Herbal & Madu Murni Abdul Ghani*
