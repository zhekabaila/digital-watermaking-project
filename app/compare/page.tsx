"use client";

import { useEffect, useMemo, useState } from "react";
import { ATTACKS, LS_KEY, UjiRow } from "@/app/attack-lab/page";

interface Agg {
  serangan: string;
  lsbSukses: number;
  dctSukses: number;
  lsbNc: number;
  dctNc: number;
  lsbBer: number;
  dctBer: number;
  total: number;
}

const ATTACK_LABELS = ATTACKS.map((a) => a.label);

function Bar({ v, color }: { v: number; color: string }) {
  return (
    <div className="h-2.5 w-full rounded-full bg-line/70">
      <div
        className={`h-2.5 rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.max(1.5, Math.min(v, 1) * 100)}%` }}
      />
    </div>
  );
}

export default function ComparePage() {
  const [rows, setRows] = useState<UjiRow[]>([]);
  const [exportErr, setExportErr] = useState<string | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      try {
        setRows(JSON.parse(raw) as UjiRow[]);
      } catch {
        /* abaikan */
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const agg = useMemo<Agg[]>(() => {
    return ATTACK_LABELS.map((label) => {
      const sub = rows.filter((r) => r.serangan === label);
      const lsb = sub.filter((r) => r.metode === "LSB");
      const dct = sub.filter((r) => r.metode === "DCT");
      const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      return {
        serangan: label,
        total: lsb.length,
        lsbSukses: lsb.filter((r) => r.ekstraksi === "berhasil").length,
        dctSukses: dct.filter((r) => r.ekstraksi === "berhasil").length,
        lsbNc: mean(lsb.map((r) => r.nc ?? -1)),
        dctNc: mean(dct.map((r) => r.nc ?? -1)),
        lsbBer: mean(lsb.map((r) => r.ber ?? 1)),
        dctBer: mean(dct.map((r) => r.ber ?? 1)),
      };
    });
  }, [rows]);

  async function exportXlsx() {
    setExportErr(null);
    try {
      const res = await fetch("/api/export/xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: rows }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "ekspor gagal");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "hasil-uji.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setExportErr((e as Error).message);
    }
  }

  const psnrByMethod = useMemo(() => {
    const g = (m: "LSB" | "DCT") => {
      const xs = rows.filter((r) => r.metode === m && r.psnr !== null);
      return xs.length ? Math.min(...xs.map((r) => r.psnr!)) : null;
    };
    return { LSB: g("LSB"), DCT: g("DCT") };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <header className="pop-in">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-grape-deep">
            langkah 4 · simpulkan
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Perbandingan <span className="text-grape-deep">LSB vs DCT</span>
          </h1>
        </header>
        <div className="pop-in pop-in-1 rounded-blobby border-2 border-dashed border-grape/40 bg-paper/60 p-12 text-center">
          <div className="mb-4 flex justify-center gap-2">
            <span className="blob h-6 w-6 rounded-full bg-grape/60" />
            <span className="blob h-6 w-6 rounded-full bg-sun/60 [animation-delay:-3s]" />
          </div>
          <p className="mx-auto max-w-md text-sm font-semibold leading-6 text-muted">
            Masih kosong — jalankan dulu matriks pengujian di Attack Lab, lalu kembali ke sini
            untuk melihat grafiknya.
          </p>
          <a
            href="/attack-lab"
            className="mt-5 inline-block rounded-full bg-coral px-6 py-2.5 text-sm font-extrabold text-paper shadow-pop-coral transition-all hover:-translate-y-0.5 hover:bg-coral-deep active:scale-[0.98]"
          >
            ke Attack Lab →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="pop-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-grape-deep">
            langkah 4 · simpulkan
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Perbandingan <span className="text-grape-deep">LSB vs DCT</span>{" "}
            <span className="text-base font-bold text-muted">— {rows.length} baris hasil</span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Fitur pengayaan: kedua metode diuji pada <strong className="text-foreground">data uji yang sama</strong>.
            PSNR minimum: LSB {psnrByMethod.LSB?.toFixed(2) ?? "∞"} dB · DCT {psnrByMethod.DCT?.toFixed(2) ?? "∞"} dB.
          </p>
        </div>
        <button
          onClick={exportXlsx}
          className="rounded-full bg-grape px-6 py-3 text-sm font-extrabold text-paper shadow-pop-grape transition-all duration-200 hover:-translate-y-0.5 hover:bg-grape-deep active:scale-[0.98]"
        >
          ⬇ Ekspor XLSX
        </button>
      </header>
      {exportErr && (
        <p role="alert" className="rounded-2xl border-2 border-coral/50 bg-coral/10 p-3 text-sm font-semibold text-coral-deep">
          Ekspor gagal: {exportErr}
        </p>
      )}

      <div className="pop-in pop-in-1 overflow-x-auto rounded-blobby border-2 border-line bg-paper shadow-card">
        <table className="w-full min-w-[860px] text-left text-xs">
          <caption className="sr-only">Agregasi keberhasilan ekstraksi per serangan</caption>
          <thead className="bg-grape/12 text-grape-deep">
            <tr>
              <th className="px-4 py-3 font-extrabold">Serangan</th>
              <th className="px-4 py-3 font-extrabold">LSB berhasil</th>
              <th className="px-4 py-3 font-extrabold">DCT berhasil</th>
              <th className="w-44 px-4 py-3 font-extrabold">NC LSB (avg)</th>
              <th className="w-44 px-4 py-3 font-extrabold">NC DCT (avg)</th>
              <th className="px-4 py-3 font-extrabold">BER LSB</th>
              <th className="px-4 py-3 font-extrabold">BER DCT</th>
            </tr>
          </thead>
          <tbody>
            {agg.map((a) => (
              <tr key={a.serangan} className="border-t border-line/70 odd:bg-background/60">
                <td className="px-4 py-2.5 font-extrabold">{a.serangan}</td>
                <td className="px-4 py-2.5">
                  <span className={`font-extrabold ${a.lsbSukses === 0 ? "text-coral-deep" : "text-teal-deep"}`}>
                    {a.lsbSukses}
                  </span>
                  <span className="text-muted">/{a.total}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`font-extrabold ${a.dctSukses === a.total && a.total > 0 ? "text-teal-deep" : "text-sun-deep"}`}>
                    {a.dctSukses}
                  </span>
                  <span className="text-muted">/{a.total}</span>
                </td>
                <td className="px-4 py-2.5">
                  <Bar v={Math.max(a.lsbNc, 0)} color="bg-sun" />
                  <span className="text-muted">{a.lsbNc.toFixed(3)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <Bar v={Math.max(a.dctNc, 0)} color="bg-teal" />
                  <span className="text-muted">{a.dctNc.toFixed(3)}</span>
                </td>
                <td className="px-4 py-2.5">{a.lsbBer.toFixed(3)}</td>
                <td className="px-4 py-2.5">{a.dctBer.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="pop-in pop-in-2 rounded-blobby border-2 border-sun/40 bg-paper p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Keberhasilan ekstraksi per serangan</h2>
          <svg viewBox="0 0 320 170" className="mt-3 w-full" role="img" aria-label="Grafik batang keberhasilan LSB versus DCT per serangan">
            {agg.map((a, i) => {
              const x = i * (320 / agg.length);
              const w = 320 / agg.length;
              const hL = (a.lsbSukses / Math.max(a.total, 1)) * 140;
              const hD = (a.dctSukses / Math.max(a.total, 1)) * 140;
              return (
                <g key={a.serangan}>
                  <rect x={x + w * 0.16} y={150 - hL} width={w * 0.3} height={hL} rx={2.5} fill="#ffb638" />
                  <rect x={x + w * 0.54} y={150 - hD} width={w * 0.3} height={hD} rx={2.5} fill="#1fb8a6" />
                  <text x={x + w / 2} y={164} textAnchor="middle" fontSize={7} fontWeight={700} fill="#8a8073">
                    {a.serangan.slice(0, 10)}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-2 text-xs font-semibold text-muted">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-sun align-middle" /> LSB ·{" "}
            <span className="ml-2 mr-1 inline-block h-2.5 w-2.5 rounded-full bg-teal align-middle" /> DCT
          </p>
        </section>
        <section className="pop-in pop-in-3 rounded-blobby border-2 border-grape/40 bg-grape/5 p-6">
          <h2 className="font-display text-lg font-bold">Interpretasi</h2>
          <ul className="mt-3 space-y-2.5 text-sm leading-6 text-muted">
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sun" />
              LSB: PSNR sangat tinggi (perubahan &lt;2 nilai piksel) tapi gagal total pada JPEG, crop, resize, noise — bukti sifat <strong className="text-sun-deep">fragile</strong>, berguna sebagai detektor manipulasi.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal" />
              DCT: PSNR lebih rendah karena margin QIM, tapi payload tetap terbaca pada JPEG 90/70/50 dan noise — bukti sifat <strong className="text-teal-deep">robust</strong>.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" />
              Crop menggeser kisi posisi — keduanya gagal; keterbatasan yang didokumentasikan di laporan.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-grape" />
              Semua payload terenkripsi AES-256-GCM: kegagalan authTag = bukti integritas, bukan sekadar bit error.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
