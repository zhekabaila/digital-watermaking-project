# Watermaking — Digital Watermarking Jalur Ganda (LSB + DCT)

Tugas Kriptografi / Keamanan Informasi · **Universitas Siliwangi**

Topik C — menerapkan sekaligus dua jalur watermarking pada satu aplikasi web:

| Jalur | Metode | Karakter |
|---|---|---|
| Fragile | **LSB** pada PNG/BMP, posisi piksel acak ber-seed stego-key | Rusak oleh manipulasi sekecil apa pun → deteksi tampering |
| Robust | **DCT 2D 8×8** (ditulis manual) + QIM pada koefisien frekuensi menengah | Tahan kompresi JPEG 90/70/50, noise, brightness/contrast |

Semua payload **dienkripsi AES-256-GCM** sebelum disisipkan (primitif `node:crypto`,
satu-satunya bagian kripto yang memakai pustaka teruji sesuai ketentuan tugas).
Kegagalan verifikasi `authTag` = bukti key salah atau citra dimanipulasi.

## Anggota Kelompok

| Nama | NPM | Peran |
|---|---|---|
| _isi nama anggota A_ | _19105…_ | Core crypto & LSB |
| _isi nama anggota B_ | _19105…_ | Core DCT & robust |
| _isi nama anggota C_ | _19105…_ | UI, pengujian, laporan |

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:3000
npx vitest run       # 24 unit test (LSB, DCT, AES-GCM, metrics, shared)
```

Alur demo: **Embed** → unduh stego PNG → **Attack Lab** (matriks citra × metode × serangan)
→ **Compare** (grafik NC/BER LSB vs DCT + ekspor `hasil-uji.xlsx`) → **Extract** untuk
verifikasi kerapuhan via peta paritas blok.

## Arsitektur

```
app/                     # Next.js 16 App Router (halaman + API routes)
  api/watermark/{lsb,dct}/{embed,extract}   # orkestrasi formData → lib, tanpa logika algoritma
  api/attack             # JPEG 90/70/50, crop, resize, noise, brightness, contrast (sharp)
  api/metrics            # PSNR/MSE, NC/BER, histogram
  api/export/xlsx        # exceljs → hasil-uji.xlsx
lib/
  crypto/aes-gcm.ts      # encryptPayload/decryptPayload — format [salt|iv|tag|ciphertext]
  watermark/shared.ts    # PRNG mulberry32 manual, scrypt KDF, length-prefix header, bit ops
  watermark/lsb.ts       # embedLSB/extractLSB + paritas per blok 8 bit + peta LSB-plane
  watermark/dct.ts       # dct2d/idct2d manual 8×8, QIM coef (4,1)-(3,2), margin QIM
  metrics/…              # psnr.ts, nc-ber.ts, entropy-histogram.ts
  image/sharp-utils.ts   # decode/encode RGB buffer + semua serangan
test/                    # vitest — ≥5 unit test (syarat wajib)
data-uji/                # 5 citra uji (foto, gradasi, ilustrasi, dokumen, tekstur)
hasil-uji/               # matriks-pengujian.json + run-matrix.cjs (regenerasi via API)
```

### Desain kunci

- **Stego-key user** → `scrypt` → (a) AES-256 key, (b) seed PRNG posisi piksel/blok.
  Tidak ada key hardcoded; tidak ada `Math.random()` untuk posisi (PRNG seeded ditulis manual).
- **Header 32-bit length-prefix** + bit paritas setiap 8 bit → memungkinkan peta area
  termodifikasi sekaligus deteksi korupsi header.
- **QIM DCT**: bit 1 bila `coef(4,1) − coef(3,2) > 0` setelah dipaksa berjarak ≥ margin.
  Margin default **60** — hasil eksperimen: margin 18 gagal di JPEG-50, 40 masih borderline, 60 lolos
  semua kualitas uji dengan PSNR ±42 dB (trade-off margin vs PSNR didokumentasikan di laporan).
- Pemrosesan penuh in-memory (Buffer) — file upload tidak pernah ditulis ke disk.

## Ringkasan Hasil Uji (lihat `hasil-uji/matriks-pengujian.json`)

Keberhasilan ekstraksi dari 5 citra uji:

| Serangan | LSB | DCT |
|---|---|---|
| Tanpa serangan | 5/5 | 5/5 |
| JPEG 90 / 70 / 50 | 0/5 | 5/5 |
| Crop 75% | 0/5 | 0/5* |
| Resize ×0.5 | 0/5 | 3/5 |
| Noise σ=8 | 0/5 | 5/5 |
| Brightness/Contrast +20% | 0/5 | 3/5 |

\* Crop menggeser kisi blok — keterbatasan yang diterima kedua jalur (dibahas di laporan).

LSB membuktikan sifat **fragile** (PSNR 82–83 dB tapi gagal total pada semua serangan);
DCT membuktikan sifat **robust** (NC≈1 / BER≈0 pasca-JPEG).

## Keamanan

- AES-256-GCM (bukan ECB/DES/RC4), key derivasi scrypt, IV/salt acak per embed.
- Stego-key hanya lewat form, tidak pernah disimpan/di-log.
- `.env*` di `.gitignore`; tidak ada kredensial di repo.
