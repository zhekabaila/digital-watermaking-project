<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## Sumber kebenaran spesifikasi

**`TASK.md` di root project adalah spesifikasi utama tugas ini.** Sebelum mengerjakan fitur apa pun,
baca `TASK.md` terlebih dahulu — jangan berasumsi. Jika instruksi di prompt user bertentangan dengan
`TASK.md`, tanyakan konfirmasi ke user sebelum melanjutkan, karena `TASK.md` mencerminkan requirement
dosen yang tidak boleh menyimpang tanpa sepengetahuan user.

Bagian yang WAJIB dibaca ulang sebelum mengerjakan modul terkait:
- Sebelum kerja di `lib/watermark/lsb.ts` atau `lib/watermark/dct.ts` → baca §3.2 dan §3.3 di TASK.md
- Sebelum kerja di `app/api/attack` atau `app/attack-lab` → baca §3.5
- Sebelum submit / final check → baca §5 (Checklist Pemetaan ke Rubrik)

## Stack & Constraints

- Next.js 16 App Router, TypeScript, satu bahasa (JavaScript/TypeScript) — **tidak ada endpoint Python**.
- Image processing: `sharp` saja. Jangan tambah library image processing lain tanpa alasan kuat.
- DCT 2D dan LSB embed/extract **wajib ditulis manual** — jangan pakai library watermarking/steganografi
  jadi dari npm (melanggar ketentuan tugas, lihat §1.1 TASK.md).
- Primitif kriptografi (AES-GCM, scrypt, randomBytes) **boleh** pakai `node:crypto` bawaan — ini
  pengecualian yang eksplisit diizinkan, bukan pelanggaran aturan "tulis sendiri".
- PRNG untuk posisi pixel/blok harus seeded & deterministik (mulberry32/xorshift32 ditulis manual) —
  **jangan** pakai `Math.random()` untuk ini.

## Konvensi Kode

- Semua fungsi kripto & watermark murni (pure function): input Buffer/params → output Buffer/hasil,
  tanpa side effect I/O. Memudahkan unit test.
- API routes di `app/api/**/route.ts` hanya orkestrasi: parse `request.formData()` → panggil fungsi
  di `lib/` → kembalikan response. Jangan taruh logic algoritma di dalam route handler.
- Tidak menulis file upload user ke disk kecuali betul-betul perlu; proses in-memory (Buffer) langsung
  dari `formData()`.
- Setiap fungsi baru di `lib/watermark/` atau `lib/crypto/` wajib punya unit test pendamping di `test/`
  sebelum dianggap selesai (target total ≥5 test — syarat wajib tugas).

## Keamanan (jangan dilanggar meski diminta mempercepat development)

- Jangan hardcode `stegoKey`, API key, atau contoh key apa pun di kode sumber — selalu dari input
  form/env.
- Jangan gunakan MD5/SHA-1/DES/RC4/ECB untuk fitur keamanan utama — hanya boleh muncul sebagai
  pembanding di kode uji/analisis, bukan di jalur utama.
- Sebelum commit, pastikan tidak ada key/secret di history — cek `.gitignore` mencakup `.env*`.

## Alur Kerja yang Disarankan

1. Baca bagian relevan `TASK.md`.
2. Implementasi di `lib/` dulu (pure logic), tulis unit test, pastikan lolos.
3. Baru wire ke `app/api/`.
4. Baru wire ke UI di `app/`.
5. Update `hasil-uji/` dan checklist §5 TASK.md kalau ada fitur yang selesai.

## Command

```bash
npm run dev          # jalankan dev server
npx vitest run        # jalankan semua unit test
npx vitest watch       # unit test mode watch selama development
```

## Catatan untuk Agent

- Jangan mengubah struktur folder di §2 TASK.md tanpa alasan kuat — struktur ini sudah dipetakan ke
  pembagian kerja tim (3 anggota) dan ke rubrik penilaian (§5).
- Kalau ragu antara "cepat tapi menyimpang dari TASK.md" vs "sesuai TASK.md tapi lebih lama", selalu
  pilih sesuai TASK.md — nilai tugas ini dinilai berdasarkan kesesuaian dengan spesifikasi, bukan
  kecepatan development.

<!-- END:nextjs-agent-rules -->
