# ATHERIA — Open-World Anime RPG (Web)

**Status: TAHAP 1 selesai** — dunia 3D awal, karakter, kamera, movement, dan kontrol.

## Cara menjalankan
Game memakai ES Modules, jadi harus dibuka lewat server lokal (bukan klik dua kali `index.html`):
- VS Code: klik kanan `index.html` → *Open with Live Server*, atau
- Terminal di folder ini: `npx serve .` atau `python -m http.server 8000` lalu buka `http://localhost:8000`

Three.js (r160, lisensi MIT) dimuat dari CDN jsDelivr lewat `importmap` di `index.html` — butuh internet saat pertama dibuka.
Untuk offline: simpan `three.module.js` ke `js/lib/` lalu ubah alamat di `importmap`.

## Kontrol
WASD jalan · Shift lari · Spasi lompat · Mouse kamera · Scroll zoom · Klik kiri serang (kombo 3 hit) ·
Q skill · R ultimate (belum ada elemen sampai TAHAP 3) · E interaksi · Esc jeda · H bantuan ·
Debug: T = +1 jam, Y = ganti cuaca.

## Isi TAHAP 1
- Pulau 3D prosedural (pantai, dataran, hutan, pegunungan bersalju, laut), siklus siang-malam, cuaca hujan, kabut, bayangan, awan, bintang, partikel.
- Pembuatan karakter (gender, rambut, warna rambut, mata, kulit, pakaian, nama) dengan preview 3D.
- Third-person camera + collision terrain, physics (terrain, pohon, batu), animasi idle/jalan/lari/lompat/serang/cast.
- Save otomatis ke LocalStorage (karakter, level, EXP, lokasi, waktu) + Continue. Struktur save sudah menyiapkan elemen/rarity/mastery/skill/inventory/quest/pity.
- Pengaturan kualitas grafis (Rendah/Sedang/Tinggi) untuk PC kelas menengah ke bawah.
- Semua model/tekstur dibuat lewat kode; tidak ada aset pihak ketiga.

## Berikutnya
TAHAP 2: Celestia Village, NPC, eksplorasi · TAHAP 3: Altar Awakening, rarity, pity · TAHAP 4: combat, monster, boss · TAHAP 5: quest, inventory, mastery · TAHAP 6: audio, optimasi, pengujian.
