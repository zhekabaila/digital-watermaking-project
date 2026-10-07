const BASE = process.env.BASE_URL || "http://localhost:3000";
const SAMPLES = [
  "foto-pohon.png",
  "gradasi-halus.png",
  "ilustrasi-bentuk.png",
  "dokumen-scan.png",
  "tekstur-checker.png",
];
const ATTACKS = [
  ["none", "Tanpa serangan"],
  ["jpeg90", "JPEG q=90"],
  ["jpeg70", "JPEG q=70"],
  ["jpeg50", "JPEG q=50"],
  ["crop", "Crop 75%"],
  ["resize", "Resize ×0.5"],
  ["noise", "Noise σ=8"],
  ["brightness", "Brightness +20%"],
  ["contrast", "Contrast +20%"],
];
const KEY = process.env.DEMO_KEY;
if (!KEY) {
  console.error("set DEMO_KEY=<stego-key> dulu; tidak ada key default.");
  process.exit(1);
}
const fs = require("node:fs");

async function fileFrom(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gagal unduh ${name}: ${res.status}`);
  return new File([await res.blob()], name, { type: "image/png" });
}

async function embed(method, cover, payload, key) {
  const f = new FormData();
  f.set("cover", cover);
  f.set("payload", payload);
  f.set("stegoKey", key);
  const res = await fetch(`${BASE}/api/watermark/${method.toLowerCase()}/embed`, { method: "POST", body: f });
  if (!res.ok) throw new Error(`${method} embed: ${(await res.json()).error}`);
  return { blob: await res.blob(), psnr: res.headers.get("X-Psnr"), mse: res.headers.get("X-Mse") };
}

async function attack(blob, type) {
  const f = new FormData();
  f.set("image", new File([blob], "stego.png", { type: "image/png" }));
  f.set("type", type);
  const res = await fetch(`${BASE}/api/attack`, { method: "POST", body: f });
  if (!res.ok) throw new Error(`attack ${type}: ${(await res.json()).error}`);
  return res.blob();
}

async function extract(method, blob, key) {
  const f = new FormData();
  f.set("stego", new File([blob], "img.png", { type: "image/png" }));
  f.set("stegoKey", key);
  const res = await fetch(`${BASE}/api/watermark/${method.toLowerCase()}/extract`, { method: "POST", body: f });
  return res.json();
}

function num(v) {
  if (v === null || v === "inf") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

(async () => {
  const rows = [];
  for (const nama of SAMPLES) {
    const cover = await fileFrom(`${BASE}/data-uji/${nama}`, nama);
    const payload = `NPM 19105123 · ${nama} · Univ. Siliwangi`;
    for (const metode of ["LSB", "DCT"]) {
      const { blob: stego, psnr, mse } = await embed(metode, cover, payload, KEY);
      for (const [atkKey, atkLabel] of ATTACKS) {
        const attacked = await attack(stego, atkKey);
        const ex = await extract(metode, attacked, KEY);
        let nc = null, ber = null;
        if (ex.success) { nc = 1; ber = 0; }
        else {
          const f = new FormData();
          f.set("watermarkA", payload);
          f.set("watermarkB", ex.payload ?? "");
          const m = await (await fetch(`${BASE}/api/metrics`, { method: "POST", body: f })).json();
          if (typeof m.nc === "number") nc = m.nc;
          if (typeof m.ber === "number") ber = m.ber;
        }
        rows.push({
          citra: nama,
          metode,
          serangan: atkLabel,
          psnr: num(psnr),
          mse: num(mse),
          nc: ex.success ? 1 : nc,
          ber: ex.success ? 0 : ber,
          ekstraksi: ex.success ? "berhasil" : "gagal",
          payloadTerkstrak: ex.payload,
          catatan: ex.reason,
        });
        process.stdout.write(`${nama} ${metode} ${atkLabel} → ${ex.success ? "OK" : "GAGAL"}\n`);
      }
    }
  }
  fs.writeFileSync("hasil-uji/matriks-pengujian.json", JSON.stringify(rows, null, 2));
  const ringkas = {};
  for (const r of rows) {
    const k = `${r.metode} | ${r.serangan}`;
    ringkas[k] = ringkas[k] || { total: 0, ok: 0 };
    ringkas[k].total++;
    if (r.ekstraksi === "berhasil") ringkas[k].ok++;
  }
  console.log("\n=== Ringkasan tingkat keberhasilan (dari 5 citra) ===");
  for (const [k, v] of Object.entries(ringkas))
    console.log(`${k.padEnd(30)} ${v.ok}/${v.total}`);
})();
