"use client";

import { useEffect, useRef, useState } from "react";

const SAMPLES = [
  "foto-pohon.png",
  "gradasi-halus.png",
  "ilustrasi-bentuk.png",
  "dokumen-scan.png",
  "tekstur-checker.png",
];

const PRESETS: Record<string, string> = {
  "Kecil (≤ 20 char)": "19105123@unsi",
  "Sedang (≈ 80 char)":
    "NPM 19105123 - Nama Anggota - Tugas Kriptografi Watermarking Universitas Siliwangi 2026",
  "Besar (≈ 300 char)":
    "Identitas: 19105123 Universitas Siliwangi. ".repeat(8),
};

interface EmbedOutcome {
  method: "LSB" | "DCT";
  url: string;
  bits: string;
  capacity: string;
  psnr: string;
  mse: string;
  extra?: string;
}

interface HistData {
  channels: [number[], number[], number[]];
  shannonEntropy: number;
}

function HistCanvas({ hist, label }: { hist: HistData; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const colors = ["#ff6f61", "#1fb8a6", "#7c5cff"];
    for (let ch = 0; ch < 3; ch++) {
      const bins = hist.channels[ch];
      const max = Math.max(...bins, 1);
      ctx.strokeStyle = colors[ch];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * c.width;
        const y = c.height - (bins[i] / max) * (c.height - 4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [hist]);
  return (
    <div>
      <canvas
        ref={ref}
        width={256}
        height={96}
        className="w-full rounded-2xl border-2 border-line bg-paper"
      />
      <p className="mt-1 text-xs font-semibold text-muted">
        {label} · entropi {hist.shannonEntropy.toFixed(3)} bit/px
      </p>
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border-2 border-line bg-paper px-3 py-2 text-sm font-semibold text-foreground placeholder:font-normal placeholder:text-muted/70 transition-colors focus:border-sun";

export default function EmbedPage() {
  const [sample, setSample] = useState<string>(SAMPLES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState(PRESETS["Kecil (≤ 20 char)"]);
  const [key, setKey] = useState("");
  const [method, setMethod] = useState<"lsb" | "dct" | "both">("both");
  const [margin, setMargin] = useState("60");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EmbedOutcome[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [hists, setHists] = useState<{ cover: HistData | null; stego: HistData | null }>({ cover: null, stego: null });

  async function getCoverFile(): Promise<File> {
    if (file) return file;
    const res = await fetch(`/data-uji/${sample}`);
    if (!res.ok) throw new Error("gagal memuat citra sampel");
    return new File([await res.blob()], sample, { type: "image/png" });
  }

  async function embedOne(methodName: "LSB" | "DCT", cover: File): Promise<EmbedOutcome> {
    const form = new FormData();
    form.set("cover", cover);
    form.set("payload", payload);
    form.set("stegoKey", key);
    if (methodName === "DCT") form.set("margin", margin);
    const res = await fetch(`/api/watermark/${methodName.toLowerCase()}/embed`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(j.error ?? "embed gagal");
    }
    const blob = await res.blob();
    const h = res.headers;
    return {
      method: methodName,
      url: URL.createObjectURL(blob),
      bits: h.get("X-Payload-Bits") ?? "?",
      capacity: h.get("X-Capacity-Bits") ?? "?",
      psnr: h.get("X-Psnr") ?? "?",
      mse: h.get("X-Mse") ?? "?",
      extra: methodName === "DCT" ? `margin ${h.get("X-Margin")}` : h.get("X-Max-Payload-Bytes") ? `maks payload ${h.get("X-Max-Payload-Bytes")} B` : undefined,
    };
  }

  async function run() {
    setError(null);
    setResults([]);
    setHists({ cover: null, stego: null });
    if (!key.trim()) {
      setError("stego-key wajib diisi (tidak ada key default).");
      return;
    }
    setBusy(true);
    try {
      const cover = await getCoverFile();
      setCoverUrl(URL.createObjectURL(cover));
      const methods: ("LSB" | "DCT")[] =
        method === "both" ? ["LSB", "DCT"] : method === "lsb" ? ["LSB"] : ["DCT"];
      const outs: EmbedOutcome[] = [];
      for (const m of methods) outs.push(await embedOne(m, cover));
      setResults(outs);

      const hf = new FormData();
      hf.set("imageA", cover);
      const stegoBlob = await fetch(outs[0].url).then((r) => r.blob());
      hf.set("imageB", new File([stegoBlob], "stego.png", { type: "image/png" }));
      hf.set("histogram", "true");
      const mres = await fetch("/api/metrics", { method: "POST", body: hf });
      if (mres.ok) {
        const mj = await mres.json();
        setHists({ cover: mj.histogramA ?? null, stego: mj.histogramB ?? null });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="pop-in">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-sun-deep">
          langkah 1 · sisip
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Embed <span className="text-sun-deep">Watermark</span>
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          className="pop-in pop-in-1 flex flex-col gap-5 rounded-blobby border-2 border-sun/50 bg-paper p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm font-extrabold">Citra sumber</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${inputCls} max-w-56`}
                value={file ? "" : sample}
                onChange={(e) => {
                  setFile(null);
                  if (e.target.value) setSample(e.target.value);
                }}
              >
                <option value="">— sampel data-uji —</option>
                {SAMPLES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="file"
                accept="image/png,image/bmp,image/jpeg"
                className="text-sm font-semibold file:mr-2 file:rounded-full file:border-0 file:bg-sky/20 file:px-3 file:py-1.5 file:text-xs file:font-extrabold file:text-foreground hover:file:bg-sky/35"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {file && <p className="mt-1.5 text-xs font-semibold text-sky">Upload aktif: {file.name}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-extrabold">
              Payload <span className="font-semibold text-muted">(teks identitas / NPM)</span>
            </label>
            <textarea
              className={`${inputCls} h-24 resize-y`}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {Object.entries(PRESETS).map(([label, v]) => (
                <button
                  type="button"
                  key={label}
                  className="rounded-full border-2 border-line bg-background px-2.5 py-1 font-extrabold text-muted transition-colors hover:border-teal hover:text-teal-deep active:scale-[0.97]"
                  onClick={() => setPayload(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-extrabold">Stego-key (rahasia)</label>
            <input
              type="password"
              className={inputCls}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="key hanya lewat form, tidak pernah disimpan"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="text-sm font-extrabold">
              Metode{" "}
              <select
                className={`${inputCls} mt-1.5 inline-block w-36`}
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
              >
                <option value="both">Keduanya</option>
                <option value="lsb">LSB saja</option>
                <option value="dct">DCT saja</option>
              </select>
            </label>
            {method !== "lsb" && (
              <label className="text-sm font-extrabold">
                Margin DCT{" "}
                <input
                  type="number"
                  min={8}
                  className={`${inputCls} mt-1.5 inline-block w-24`}
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                />
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-1 self-start rounded-full bg-sun px-7 py-3 text-sm font-extrabold text-foreground shadow-pop-sun transition-all duration-200 hover:-translate-y-0.5 hover:bg-sun-deep hover:text-paper active:scale-[0.98] disabled:translate-y-0 disabled:opacity-50"
          >
            {busy ? "Memproses…" : "Embed →"}
          </button>
          {error && (
            <p role="alert" className="rounded-2xl border-2 border-coral/50 bg-coral/10 p-3 text-sm font-semibold text-coral-deep">
              {error}
            </p>
          )}
        </form>

        <div className="pop-in pop-in-2 flex flex-col gap-5 rounded-blobby border-2 border-line bg-paper/60 p-6">
          {!coverUrl && results.length === 0 && (
            <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-center">
              <div className="flex gap-1.5">
                <span className="blob h-5 w-5 rounded-full bg-sun/70" />
                <span className="blob h-5 w-5 rounded-full bg-teal/70 [animation-delay:-3s]" />
                <span className="blob h-5 w-5 rounded-full bg-grape/70 [animation-delay:-6s]" />
              </div>
              <p className="text-sm font-semibold text-muted">
                Hasil akan muncul di sini — cover &amp; stego berdampingan, PSNR, kapasitas, dan histogram.
              </p>
            </div>
          )}
          {coverUrl && (
            <figure>
              <figcaption className="mb-1.5 text-[11px] font-extrabold uppercase tracking-widest text-muted">
                Cover asli
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt={`citra cover ${file?.name ?? sample}`}
                className="max-h-60 rounded-2xl border-2 border-line shadow-card"
              />
            </figure>
          )}
          {results.map((r) => (
            <figure key={r.method} className="pop-in">
              <figcaption className="mb-1.5 text-[11px] font-extrabold uppercase tracking-widest text-muted">
                Stego · {r.method === "LSB" ? <span className="text-sun-deep">LSB fragile</span> : <span className="text-teal-deep">DCT robust</span>}
              </figcaption>
              <div className="flex flex-wrap items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.url}
                  alt={`citra stego metode ${r.method}`}
                  className="max-h-60 rounded-2xl border-2 border-line shadow-card"
                />
                <div className="text-xs font-semibold leading-6 text-muted">
                  <p>
                    PSNR <strong className="rounded-md bg-leaf/15 px-1.5 py-0.5 text-sm text-teal-deep">{r.psnr} dB</strong>{" "}
                    · MSE {r.mse}
                  </p>
                  <p>Bit tersisip {r.bits} / kapasitas {r.capacity}</p>
                  {r.extra && <p>{r.extra}</p>}
                  <a
                    className="inline-block rounded-full bg-grape/15 px-3 py-1 font-extrabold text-grape-deep transition-colors hover:bg-grape hover:text-paper"
                    href={r.url}
                    download={`stego-${r.method.toLowerCase()}.png`}
                  >
                    ⬇ unduh PNG
                  </a>
                </div>
              </div>
            </figure>
          ))}
          {hists.cover && hists.stego && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-muted">Histogram cover</p>
                <HistCanvas hist={hists.cover} label="R/G/B" />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-extrabold uppercase tracking-widest text-muted">Histogram stego</p>
                <HistCanvas hist={hists.stego} label="R/G/B" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
