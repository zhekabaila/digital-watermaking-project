# Tugas Proyek Kriptografi — Digital Watermarking
**Topik C — Jalur Ganda: Fragile (LSB) + Robust (DCT)**
Mata kuliah Keamanan Informasi · Universitas Siliwangi

Target: memenuhi seluruh fitur wajib, seluruh pengujian wajib, dan fitur pengayaan
"membandingkan dua metode watermarking pada data uji yang sama" sekaligus.

---

## 1. Keputusan Arsitektur

### 1.1 Stack
- **Next.js 16 (App Router)** — satu project, full JavaScript/TypeScript. Tidak ada endpoint Python.
- **Server-side image processing**: `sharp` (native binding libvips) — decode/encode PNG/JPEG, resize,
  crop, compress JPEG, Gaussian blur untuk uji, ekstraksi raw pixel buffer.
- **DCT 2D 8×8**: ditulis manual (tidak boleh pakai library DCT jadi — sesuai ketentuan tugas bahwa
  logika watermark wajib ditulis sendiri).
- **LSB**: ditulis manual, beroperasi di buffer RGB mentah dari `sharp`.
- **Enkripsi payload** (wajib sebelum disisipkan): AES-256-GCM via `node:crypto` (built-in, sudah teruji
  — ini SATU-SATUNYA bagian kripto yang boleh pakai library, sesuai instruksi PDF).
- **Penyimpanan hasil uji**: tabel JSON di server → diekspor ke XLSX pakai `exceljs` (client bisa
  download langsung dari browser).
- **Tidak perlu database** — semua stateless per-request, file diproses di memory (Buffer) lalu
  dikembalikan sebagai response atau disimpan sementara di `/tmp` untuk sesi demo.

### 1.2 Kenapa Next.js API Routes cukup (tanpa Python)?
`sharp` menangani semua manipulasi format citra (decode/encode PNG, JPEG re-compress, resize, crop,
noise injection via manual pixel manipulation). DCT 8×8 dan LSB adalah operasi matematis murni atas
array angka — tidak butuh library khusus Python (`numpy`/`opencv`), cukup `Float64Array`/`Uint8Array`
biasa di Node.js. Jadi tidak ada alasan teknis untuk split ke Python; justru dengan satu bahasa,
tim lebih mudah membagi kerja dan konsisten dalam code review demo (Bagian 10 PDF: "setiap anggota
harus mampu menjelaskan kode").

### 1.3 Pembagian kerja (2–3 orang)
| Peran | Tanggung jawab |
|---|---|
| **A — Core Crypto & LSB** | AES-256-GCM payload encryption, LSB embed/extract, PRNG seeded pixel shuffling, kapasitas & validasi |
| **B — Core DCT & Robust** | DCT 2D 8×8 manual, embed di koefisien frekuensi menengah, deteksi/ekstraksi robust, spread spectrum opsional |
| **C — UI, Pengujian, Laporan** | Next.js pages, upload/preview UI, orkestrasi skenario serangan, kalkulasi metrik (PSNR/NC/BER), ekspor XLSX, video demo |

Jika hanya 2 orang: gabungkan A+B pada satu orang (mereka saling terkait erat — sama-sama "core
signal processing"), C tetap terpisah.

---

## 2. Struktur Folder Project

```
watermaking-project/
├── app/
│   ├── page.tsx                      # Landing / pilih mode (embed / extract / compare)
│   ├── embed/page.tsx                # UI upload cover image + payload + pilih metode (LSB/DCT/keduanya)
│   ├── extract/page.tsx              # UI upload stego image + key → ekstraksi & verifikasi
│   ├── attack-lab/page.tsx           # UI simulasi serangan (JPEG/crop/resize/noise/brightness) + metrik
│   ├── compare/page.tsx              # Dashboard perbandingan LSB vs DCT (tabel + grafik)
│   └── api/
│       ├── watermark/lsb/embed/route.ts
│       ├── watermark/lsb/extract/route.ts
│       ├── watermark/dct/embed/route.ts
│       ├── watermark/dct/extract/route.ts
│       ├── attack/route.ts           # terima stego image + jenis serangan → kembalikan citra terserang
│       ├── metrics/route.ts          # hitung PSNR / NC / BER dari dua buffer citra
│       └── export/xlsx/route.ts      # generate laporan XLSX dari hasil uji
├── lib/
│   ├── crypto/
│   │   └── aes-gcm.ts                # encryptPayload(), decryptPayload() — Node crypto builtin
│   ├── watermark/
│   │   ├── lsb.ts                    # embedLSB(), extractLSB(), prngShuffle()
│   │   ├── dct.ts                    # dct2d(), idct2d(), embedDCT(), extractDCT()
│   │   └── shared.ts                 # bitConversion, header length-prefix, capacity calc
│   ├── metrics/
│   │   ├── psnr.ts
│   │   ├── nc-ber.ts                 # Normalized Correlation & Bit Error Rate
│   │   └── entropy-histogram.ts      # (dipakai juga utk skenario Topik A jika relevan; opsional di sini)
│   └── image/
│       └── sharp-utils.ts            # loadRaw(), toRawRGB(), attackJPEG(), attackCrop(),
│                                      # attackResize(), attackGaussianNoise(), attackBrightness()
├── test/
│   ├── lsb.test.ts                   # unit test embed/extract round-trip
│   ├── dct.test.ts
│   ├── aes-gcm.test.ts
│   └── metrics.test.ts               # ≥ 5 unit test total (syarat wajib PDF)
├── data-uji/                         # 5 citra sampel (variasi: foto, ilustrasi, dokumen scan, dst.)
├── hasil-uji/                        # output tabel per serangan (auto-generated, untuk laporan)
├── README.md
└── TASK.md                           # file ini
```

---

## 3. Alur Logic per Fitur Wajib

### 3.1 Payload Preparation (dipakai LSB & DCT)
```
watermark_teks / npm_id
        │
        ▼
AES-256-GCM encrypt (key dari stego-key user, KDF: scrypt)
        │
        ▼
[salt(16B) | iv(12B) | authTag(16B) | ciphertext] → biner
        │
        ▼
Header: 32-bit length prefix + payload biner
```
- `stego-key` yang diinput user di-derive dengan `scrypt` → dipakai untuk (a) AES key, (b) seed PRNG
  posisi pixel/blok. Satu key untuk dua fungsi → alasan keamanan: pemisahan LSB-key dan AES-key
  sebenarnya lebih baik, tapi untuk cakupan tugas ini boleh disatukan dengan HKDF derive 2 subkey dari
  1 master key (opsional pengayaan kecil, sebut di laporan sebagai justifikasi desain).

### 3.2 Jalur Fragile — LSB
```
Cover PNG/BMP → sharp → raw RGB buffer
        │
        ▼
PRNG(seed=stego-key) → urutan indeks pixel acak (tanpa duplikasi)
        │
        ▼
Untuk tiap bit payload (termasuk length header):
   ambil pixel di indeks[i] (channel B, atau R/G/B round-robin)
   set LSB = bit payload
        │
        ▼
Simpan sebagai PNG lossless (WAJIB — LSB rusak jika di-encode ulang ke JPEG)
```
- **Ekstraksi**: ulangi PRNG dengan seed sama → baca LSB di urutan indeks yang sama → rekonstruksi
  length header dulu (32 bit pertama) → baca sisanya sepanjang itu → AES-GCM decrypt → jika `authTag`
  gagal verifikasi → **tolak & tampilkan "ekstraksi gagal / key salah / citra dimanipulasi"**.
- Ini otomatis mengcover requirement fragile: LSB rusak oleh **hampir semua** manipulasi (termasuk
  resize/crop/JPEG), jadi kegagalan dekripsi = bukti area diubah. Untuk fitur wajib "tampilkan peta
  area yang terdeteksi diubah", bandingkan LSB-plane cover asli vs stego per-blok kecil (mis. 8×8) dan
  highlight blok yang authTag/parity-nya tidak match (lihar §3.4).

### 3.3 Jalur Robust — DCT
```
Cover image → sharp → convert ke YCbCr, ambil channel Y (luma)
        │
        ▼
Bagi channel Y jadi blok 8×8 non-overlapping
        │
        ▼
Untuk tiap blok yang dipilih PRNG(seed=stego-key):
   DCT2D(blok) → dapat 64 koefisien
   pilih 2 koefisien frekuensi menengah, mis. posisi (4,1) dan (3,2)
   encode 1 bit payload dengan quantization index modulation (QIM):
     jika bit=1 → paksa coef[a] > coef[b] + margin
     jika bit=0 → paksa coef[a] < coef[b] - margin
   IDCT2D(blok) → tulis balik ke channel Y
        │
        ▼
Gabung Y + Cb + Cr asli → convert RGB → encode PNG (atau JPEG kualitas tinggi utk demo ketahanan)
```
- **Ekstraksi**: PRNG sama → ambil blok yang sama → DCT2D → baca relasi coef[a] vs coef[b] → bit.
  Robust terhadap kompresi JPEG karena kuantisasi JPEG standar tidak banyak mengubah urutan relatif
  koefisien frekuensi menengah jika margin cukup besar.
- **Trade-off margin**: margin besar = lebih tahan serangan tapi PSNR turun (visible artifact).
  Dokumentasikan 2–3 nilai margin di laporan sebagai bagian analisis.

### 3.4 Peta Area Termodifikasi (fragile — fitur wajib)
```
Bagi stego image jadi grid blok kecil (mis. 16×16)
Untuk tiap blok:
   ekstrak sub-bitstream LSB blok itu saja (jika payload didesain per-blok)
   ATAU bandingkan parity-checksum per blok (checksum ringan per blok, disimpan saat embed)
   jika mismatch → tandai blok merah di overlay
Render overlay di atas stego image (canvas / SVG di frontend)
```

### 3.5 Alur Pengujian & Serangan (attack-lab)
```
User upload / pilih dari data-uji/ (5 citra)
        │
        ▼
Embed watermark (LSB dan/atau DCT) → simpan stego + metadata (key, payload asli)
        │
        ▼
Pilih serangan: [JPEG-90, JPEG-70, JPEG-50, Crop, Resize, Gaussian-Noise, Brightness±, Contrast±]
   (semua via sharp: .jpeg({quality}), .extract() utk crop, .resize(), manual noise loop, .modulate())
        │
        ▼
Untuk tiap kombinasi (citra × metode × serangan):
   ekstrak watermark dari citra hasil serangan
   hitung PSNR(stego, cover_asli)   ← sebelum serangan
   hitung NC(watermark_asli, watermark_ekstrak)
   hitung BER(watermark_asli, watermark_ekstrak)
        │
        ▼
Simpan baris hasil ke tabel → tampilkan di /compare → export XLSX
```

---

## 4. API Contract (ringkas)

| Endpoint | Input | Output |
|---|---|---|
| `POST /api/watermark/lsb/embed` | `cover` (file), `payload` (text), `stegoKey` (string) | `stego.png` (blob) |
| `POST /api/watermark/lsb/extract` | `stego` (file), `stegoKey` | `{ success, payload? , reason? }` |
| `POST /api/watermark/dct/embed` | `cover`, `payload`, `stegoKey`, `margin?` | `stego.png` |
| `POST /api/watermark/dct/extract` | `stego`, `stegoKey` | `{ success, payload?, ber_estimate? }` |
| `POST /api/attack` | `image` (file), `type` (enum), `params?` | `attacked-image` (blob) |
| `POST /api/metrics` | `imageA`, `imageB`, (opsional `watermarkA`, `watermarkB`) | `{ psnr, nc?, ber? }` |
| `POST /api/export/xlsx` | `results[]` (JSON tabel uji) | `hasil-uji.xlsx` (blob) |

---

## 5. Checklist Pemetaan ke Rubrik Tugas

| Requirement PDF | Dipenuhi oleh |
|---|---|
| Fitur wajib: LSB pada PNG/BMP | `lib/watermark/lsb.ts` |
| Header panjang pesan | length-prefix 32-bit di §3.1 |
| Posisi pixel/blok acak dari stego-key | PRNG seeded (mis. mulberry32/xorshift, deterministik) |
| Pesan dienkripsi sebelum disisipkan | AES-256-GCM §3.1 |
| Kapasitas maksimum & penolakan | cek `payload.length ≤ capacity` sebelum embed |
| Tampilan cover & stego berdampingan | `app/embed/page.tsx` |
| PSNR & MSE, 5 citra, 3 ukuran pesan | `lib/metrics/psnr.ts` + loop di attack-lab |
| Histogram cover vs stego | `lib/metrics/entropy-histogram.ts` + chart di UI |
| Uji kerapuhan (JPEG re-save) | `/api/attack` type=jpeg |
| Steganalisis visual (LSB plane) | §3.4 peta area |
| **Fragile/Robust pilih jalur** → **keduanya** | LSB = fragile, DCT = robust |
| Watermark logo biner / teks identitas (NPM) | payload = teks NPM/nama, opsional biner logo kecil |
| Kunci rahasia utk posisi | stego-key → PRNG seed |
| PSNR watermark vs asli | sama seperti di atas, per metode |
| Serangan JPEG 90/70/50 | attack-lab |
| Crop, resize, Gaussian noise, brightness, contrast | attack-lab (sharp) |
| NC & BER setelah tiap serangan | `lib/metrics/nc-ber.ts` |
| Jalur fragile → peta area diubah | §3.4 |
| **Pengayaan: bandingkan 2 metode data uji sama** | `/compare` — LSB & DCT dijalankan atas 5 citra × serangan yang sama |
| ≥5 unit test | `test/*.test.ts` |
| README lengkap + NPM anggota | `README.md` |
| Tidak ada key hardcoded | semua key dari input form / env, cek `.gitignore` |

---

## 6. Rencana Hari (mengikuti Bagian 7 PDF)

- **Hari 1**: setup repo, `create-next-app` sudah ada → tambah `sharp`, `exceljs`; buat struktur folder
  di atas; commit skeleton tiap API route (return dummy) agar semua anggota bisa mulai paralel.
- **Hari 2–4**: A kerjakan AES-GCM + LSB penuh (round-trip lolos unit test), B kerjakan DCT2D/IDCT2D +
  embed/extract (validasi dengan citra kecil dulu, mis. 64×64), C bangun UI upload + preview + wiring
  ke API (pakai stub A/B dulu jika belum selesai).
- **Hari 5–6**: integrasi attack-lab, jalankan semua kombinasi 5 citra × 2 metode × serangan, isi tabel,
  generate grafik/histogram, cari margin DCT optimal dari beberapa percobaan.
- **Hari 7**: tulis laporan (Bagian 6 PDF), rekam video demo (skenario §3.5 dipersingkat 3–5 menit),
  export XLSX, isi README, cek checklist §5 di atas, submit.

---

## 7. Catatan Keamanan Implementasi (wajib dihindari)

- **Jangan** taruh `stegoKey` default atau contoh key di kode — selalu dari form input.
- **Jangan** pakai `Math.random()` untuk PRNG posisi — tidak deterministik lintas proses dan tidak
  cocok untuk seeding; pakai PRNG seeded manual (mulberry32/xorshift32 ringan, ditulis sendiri, ~10
  baris) yang di-seed dari hash `stegoKey`.
- **Boleh** pakai `crypto.scrypt`/`crypto.randomBytes` bawaan Node untuk KDF & salt/IV — ini yang
  dimaksud "pustaka kriptografi yang sudah teruji" di PDF, bukan pelanggaran aturan "tulis sendiri"
  (aturan "tulis sendiri" itu khusus untuk logika LSB/DCT/watermark, bukan untuk primitif AES).
- Simpan hasil upload user di `/tmp` dengan nama acak (`crypto.randomUUID()`), hapus setelah response
  dikirim atau pakai in-memory processing penuh tanpa nulis ke disk sama sekali (lebih aman, dan Next.js
  API routes mendukung ini langsung dari `request.formData()` → `Buffer`).

---

## 8. Dependencies untuk ditambahkan

```bash
cd ~/watermaking-project
npm install sharp exceljs
npm install -D vitest @vitest/ui
```

`node:crypto` tidak perlu instalasi (built-in Node.js).