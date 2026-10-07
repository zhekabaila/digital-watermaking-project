"use client";

import { useRef, useState } from "react";

interface ExtractResp {
  success: boolean;
  payload?: string;
  reason?: string;
  error?: string;
  ber_estimate?: number;
  blockMap?: number[];
}

function BlockMapStrip({ map }: { map: number[] }) {
  return (
    <div className="flex max-h-24 flex-wrap gap-1 overflow-hidden rounded-2xl border-2 border-line bg-paper p-3">
      {map.map((ok, i) => (
        <span
          key={i}
          title={`blok ${i}: ${ok ? "utuh" : "berubah"}`}
          className={`h-3 w-3 rounded-[4px] ${ok ? "bg-leaf" : "bg-coral"}`}
        />
      ))}
    </div>
  );
}

/** Peta area termodifikasi §3.4: bandingkan LSB-plane cover vs citra uji per blok piksel. */
async function lsbPlaneMap(
  coverFile: File,
  testFile: File,
  blockSize: number
): Promise<{ cols: number; rows: number; modified: Uint8Array } | null> {
  const a = await createImageBitmap(coverFile);
  const b = await createImageBitmap(testFile);
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const grab = async (img: ImageBitmap) => {
    const cv = new OffscreenCanvas(img.width, img.height);
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height).data;
  };
  const da = await grab(a);
  const db = await grab(b);
  const cols = Math.ceil(w / blockSize);
  const rows = Math.ceil(h / blockSize);
  const modified = new Uint8Array(cols * rows);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * a.width + x) * 4;
      const j = (y * b.width + x) * 4;
      if ((da[i + 2] & 1) !== (db[j + 2] & 1)) {
        modified[Math.floor(y / blockSize) * cols + Math.floor(x / blockSize)] = 1;
      }
    }
  }
  a.close();
  b.close();
  return { cols, rows, modified };
}

const inputCls =
  "w-full rounded-2xl border-2 border-line bg-paper px-3 py-2 text-sm font-semibold text-foreground placeholder:font-normal placeholder:text-muted/70 transition-colors focus:border-teal";

export default function ExtractPage() {
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [key, setKey] = useState("");
  const [method, setMethod] = useState<"lsb" | "dct">("lsb");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ExtractResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planeMap, setPlaneMap] = useState<{ cols: number; rows: number; modified: Uint8Array } | null>(null);
  const urlRef = useRef<string | null>(null);

  async function run() {
    setError(null);
    setRes(null);
    setPlaneMap(null);
    if (!file || !key.trim()) {
      setError("citra stego dan stego-key wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("stego", file);
      form.set("stegoKey", key);
      const r = await fetch(`/api/watermark/${method}/extract`, { method: "POST", body: form });
      const j: ExtractResp = await r.json();
      setRes(j);
      if (coverFile) {
        const map = await lsbPlaneMap(coverFile, file, 16);
        setPlaneMap(map);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const preview = file
    ? (urlRef.current ??= URL.createObjectURL(file))
    : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="pop-in">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-teal-deep">
          langkah 2 · verifikasi
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Extract &amp; <span className="text-teal-deep">Verifikasi</span> Watermark
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          className="pop-in pop-in-1 flex flex-col gap-5 rounded-blobby border-2 border-teal/50 bg-paper p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm font-extrabold">Citra stego</label>
            <input
              type="file"
              accept="image/png,image/bmp,image/jpeg"
              className="text-sm font-semibold file:mr-2 file:rounded-full file:border-0 file:bg-teal/20 file:px-3 file:py-1.5 file:text-xs file:font-extrabold file:text-teal-deep hover:file:bg-teal/35"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                urlRef.current = null;
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-extrabold">
              Cover asli <span className="font-semibold text-muted">(opsional — peta area LSB-plane)</span>
            </label>
            <input
              type="file"
              accept="image/png,image/bmp"
              className="text-sm font-semibold file:mr-2 file:rounded-full file:border-0 file:bg-sky/20 file:px-3 file:py-1.5 file:text-xs file:font-extrabold file:text-foreground hover:file:bg-sky/35"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-extrabold">Metode</label>
            <div className="flex gap-2">
              {(
                [
                  ["lsb", "LSB fragile", "border-sun bg-sun/15 text-sun-deep"],
                  ["dct", "DCT robust", "border-teal bg-teal/15 text-teal-deep"],
                ] as const
              ).map(([val, label, cls]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setMethod(val)}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-extrabold transition-all duration-200 active:scale-[0.97] ${
                    method === val
                      ? cls
                      : "border-line bg-background text-muted hover:border-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-extrabold">Stego-key</label>
            <input
              type="password"
              className={inputCls}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-1 self-start rounded-full bg-teal px-7 py-3 text-sm font-extrabold text-paper shadow-pop-teal transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-deep active:scale-[0.98] disabled:translate-y-0 disabled:opacity-50"
          >
            {busy ? "Mengekstraksi…" : "Extract →"}
          </button>
          {error && (
            <p role="alert" className="rounded-2xl border-2 border-coral/50 bg-coral/10 p-3 text-sm font-semibold text-coral-deep">
              {error}
            </p>
          )}
        </form>

        <div className="pop-in pop-in-2 flex flex-col gap-5 rounded-blobby border-2 border-line bg-paper/60 p-6">
          {!preview && (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center">
              <div className="flex gap-1.5">
                <span className="blob h-5 w-5 rounded-full bg-teal/70" />
                <span className="blob h-5 w-5 rounded-full bg-sun/70 [animation-delay:-4s]" />
              </div>
              <p className="text-sm font-semibold text-muted">
                Unggah citra stego di kiri, masukkan key yang sama saat embed, lalu jalankan ekstraksi.
              </p>
            </div>
          )}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="pratinjau citra stego"
              className="max-h-52 self-start rounded-2xl border-2 border-line shadow-card"
            />
          )}
          {res && (
            <div
              role="status"
              className={`pop-in rounded-blobby border-2 p-4 text-sm ${
                res.success
                  ? "border-leaf bg-leaf/10"
                  : "border-coral bg-coral/10"
              }`}
            >
              <p className={`font-display text-lg font-bold ${res.success ? "text-teal-deep" : "text-coral-deep"}`}>
                {res.success ? "Ekstraksi berhasil" : "Ekstraksi gagal"}
              </p>
              {res.success ? (
                <p className="mt-1 break-all rounded-xl bg-paper px-3 py-2 font-mono text-xs">{res.payload}</p>
              ) : (
                <p className="mt-1 font-semibold text-coral-deep">{res.reason ?? res.error ?? "tidak diketahui"}</p>
              )}
              {typeof res.ber_estimate === "number" && (
                <p className="mt-2 text-xs font-semibold text-muted">
                  perkiraan BER blok: {(res.ber_estimate * 100).toFixed(1)}%
                </p>
              )}
            </div>
          )}
          {res?.blockMap && (
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-muted">
                Peta paritas per blok payload ·{" "}
                <span className="text-leaf">hijau utuh</span> / <span className="text-coral-deep">merah berubah</span>
              </p>
              <BlockMapStrip map={res.blockMap} />
            </div>
          )}
          {planeMap && (
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-muted">
                Peta area LSB-plane berubah (blok 16×16 px vs cover)
              </p>
              <div className="flex max-h-40 flex-wrap gap-0.5 overflow-hidden rounded-2xl border-2 border-line bg-paper p-3">
                {Array.from(planeMap.modified).map((m, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 ${m ? "bg-coral" : "bg-line"}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
