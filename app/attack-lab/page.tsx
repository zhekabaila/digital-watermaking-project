"use client";

import { useState } from "react";

const SAMPLES = [
  "foto-pohon.png",
  "gradasi-halus.png",
  "ilustrasi-bentuk.png",
  "dokumen-scan.png",
  "tekstur-checker.png",
];

export const ATTACKS = [
  { key: "none", label: "Tanpa serangan" },
  { key: "jpeg90", label: "JPEG q=90" },
  { key: "jpeg70", label: "JPEG q=70" },
  { key: "jpeg50", label: "JPEG q=50" },
  { key: "crop", label: "Crop 75%" },
  { key: "resize", label: "Resize ×0.5" },
  { key: "noise", label: "Noise σ=8" },
  { key: "brightness", label: "Brightness +20%" },
  { key: "contrast", label: "Contrast +20%" },
] as const;

export interface UjiRow {
  citra: string;
  metode: "LSB" | "DCT";
  serangan: string;
  psnr: number | null;
  mse: number | null;
  nc: number | null;
  ber: number | null;
  ekstraksi: "berhasil" | "gagal";
  payloadTerkstrak?: string;
  catatan?: string;
}

export const LS_KEY = "hasil-uji-matrix-v1";

async function toFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gagal unduh ${name}`);
  return new File([await res.blob()], name, { type: "image/png" });
}

function payloadFor(citra: string): string {
  return `NPM 19105123 · ${citra} · Univ. Siliwangi`;
}

async function embed(method: "LSB" | "DCT", cover: File, payload: string, key: string) {
  const form = new FormData();
  form.set("cover", cover);
  form.set("payload", payload);
  form.set("stegoKey", key);
  const res = await fetch(`/api/watermark/${method.toLowerCase()}/embed`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`${method} embed: ${(await res.json()).error ?? res.statusText}`);
  return {
    blob: await res.blob(),
    psnr: res.headers.get("X-Psnr"),
    mse: res.headers.get("X-Mse"),
  };
}

async function attack(stegoBlob: Blob, type: string): Promise<Blob> {
  const form = new FormData();
  form.set("image", new File([stegoBlob], "stego.png", { type: "image/png" }));
  form.set("type", type);
  const res = await fetch("/api/attack", { method: "POST", body: form });
  if (!res.ok) throw new Error(`attack ${type}: ${(await res.json()).error ?? res.statusText}`);
  return res.blob();
}

async function extract(method: "LSB" | "DCT", imgBlob: Blob, key: string) {
  const form = new FormData();
  form.set("stego", new File([imgBlob], "img.png", { type: "image/png" }));
  form.set("stegoKey", key);
  const res = await fetch(`/api/watermark/${method.toLowerCase()}/extract`, { method: "POST", body: form });
  return res.json() as Promise<{
    success: boolean;
    payload?: string;
    reason?: string;
    ber_estimate?: number;
  }>;
}

function num(v: string | null): number | null {
  if (v === null || v === "inf") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const inputCls =
  "w-full rounded-2xl border-2 border-line bg-paper px-3 py-2 text-sm font-semibold text-foreground transition-colors focus:border-coral";

export default function AttackLabPage() {
  const [key, setKey] = useState("");
  const [only, setOnly] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [rows, setRows] = useState<UjiRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runMatrix() {
    setError(null);
    if (!key.trim()) {
      setError("stego-key wajib diisi untuk seluruh matriks uji.");
      return;
    }
    setRunning(true);
    setRows([]);
    const out: UjiRow[] = [];
    try {
      const images = only ? [only] : SAMPLES;
      for (const nama of images) {
        const cover = await toFile(`/data-uji/${nama}`, nama);
        const payload = payloadFor(nama);
        for (const metode of ["LSB", "DCT"] as const) {
          const { blob: stego, psnr, mse } = await embed(metode, cover, payload, key);
          const psnrN = num(psnr);
          const mseN = num(mse);
          for (const atk of ATTACKS) {
            setProgress(`${nama} · ${metode} · ${atk.label}`);
            const attacked = await attack(stego, atk.key);
            const ex = await extract(metode, attacked, key);
            let nc: number | null = null;
            let ber: number | null = null;
            if (!(ex.success && ex.payload)) {
              const mf = new FormData();
              mf.set("watermarkA", payload);
              mf.set("watermarkB", ex.payload ?? "");
              const m = await (await fetch("/api/metrics", { method: "POST", body: mf })).json();
              nc = typeof m.nc === "number" ? m.nc : null;
              ber = typeof m.ber === "number" ? m.ber : null;
            }
            out.push({
              citra: nama,
              metode,
              serangan: atk.label,
              psnr: psnrN,
              mse: mseN,
              nc: ex.success ? 1 : nc,
              ber: ex.success ? 0 : ber,
              ekstraksi: ex.success ? "berhasil" : "gagal",
              payloadTerkstrak: ex.payload,
              catatan: ex.reason,
            });
            setRows([...out]);
          }
        }
      }
      localStorage.setItem(LS_KEY, JSON.stringify(out));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="pop-in">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-coral-deep">
          langkah 3 · siksa
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Attack Lab — <span className="text-coral-deep">Matriks Pengujian</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {SAMPLES.length} citra × 2 metode × {ATTACKS.length} serangan. Untuk tiap kombinasi:
          embed → serang → ekstrak → hitung PSNR (cover vs stego), NC &amp; BER (payload asli vs
          terkstrak). Hasil disimpan otomatis untuk halaman{" "}
          <a href="/compare" className="font-extrabold text-grape-deep underline decoration-grape/40 underline-offset-2 hover:decoration-grape">
            Compare
          </a>
          .
        </p>
      </header>

      <form
        className="pop-in pop-in-1 flex flex-wrap items-end gap-5 rounded-blobby border-2 border-coral/50 bg-paper p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          runMatrix();
        }}
      >
        <label className="text-sm font-extrabold">
          Stego-key
          <input
            type="password"
            className={`${inputCls} mt-1.5 w-64`}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <label className="text-sm font-extrabold">
          Citra uji
          <select
            className={`${inputCls} mt-1.5 w-56`}
            value={only}
            onChange={(e) => setOnly(e.target.value)}
          >
            <option value="">— semua 5 citra —</option>
            {SAMPLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={running}
          className="relative overflow-hidden rounded-full bg-coral px-7 py-3 text-sm font-extrabold text-paper shadow-pop-coral transition-all duration-200 hover:-translate-y-0.5 hover:bg-coral-deep active:scale-[0.98] disabled:translate-y-0 disabled:opacity-70"
        >
          {running ? `⚡ ${progress}` : "Jalankan Matriks"}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-coral/50 bg-coral/10 p-3 text-sm font-semibold text-coral-deep">
          {error}
        </p>
      )}

      {rows.length === 0 && !running && (
        <div className="pop-in pop-in-2 rounded-blobby border-2 border-dashed border-line bg-paper/60 p-10 text-center">
          <div className="mb-3 flex justify-center gap-2">
            <span className="blob h-6 w-6 rounded-full bg-coral/60" />
            <span className="blob h-6 w-6 rounded-full bg-sun/60 [animation-delay:-3s]" />
            <span className="blob h-6 w-6 rounded-full bg-teal/60 [animation-delay:-5s]" />
          </div>
          <p className="text-sm font-semibold text-muted">
            Belum ada hasil. Isi stego-key di atas lalu jalankan matriks — tabel akan terisi baris
            demi baris secara live.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="pop-in overflow-hidden rounded-blobby border-2 border-line bg-paper shadow-card">
          <table className="w-full min-w-[880px] text-left text-xs">
            <caption className="sr-only">Hasil matriks pengujian watermark</caption>
            <thead className="bg-coral/15 text-coral-deep">
              <tr>
                {["Citra", "Metode", "Serangan", "PSNR (dB)", "MSE", "NC", "BER", "Ekstraksi"].map((h) => (
                  <th key={h} className="px-4 py-3 font-extrabold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line/70 odd:bg-background/60">
                  <td className="px-4 py-2 font-semibold">{r.citra}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 font-extrabold ${
                        r.metode === "LSB" ? "bg-sun/20 text-sun-deep" : "bg-teal/20 text-teal-deep"
                      }`}
                    >
                      {r.metode}
                    </span>
                  </td>
                  <td className="px-4 py-2">{r.serangan}</td>
                  <td className="px-4 py-2">{r.psnr?.toFixed(2) ?? "∞"}</td>
                  <td className="px-4 py-2">{r.mse?.toFixed(4) ?? "0"}</td>
                  <td className="px-4 py-2">{r.nc?.toFixed(3) ?? "–"}</td>
                  <td className="px-4 py-2">{r.ber?.toFixed(3) ?? "–"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 font-extrabold ${
                        r.ekstraksi === "berhasil"
                          ? "bg-leaf/20 text-teal-deep"
                          : "bg-coral/20 text-coral-deep"
                      }`}
                    >
                      {r.ekstraksi}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
