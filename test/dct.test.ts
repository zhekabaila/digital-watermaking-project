import { describe, it, expect } from "vitest";
import {
  dct2d,
  idct2d,
  embedDCT,
  extractDCT,
  BLOCK,
} from "@/lib/watermark/dct";
import {
  applyAttack,
  encodeJpeg,
  loadRaw,
  rawToPng,
  RawImage,
} from "@/lib/image/sharp-utils";
import { mulberry32 } from "@/lib/watermark/shared";

function smoothRGB(width: number, height: number, seed = 3): RawImage {
  const rand = mulberry32(seed);
  const data = Buffer.alloc(width * height * 3);
  let v = 100 + rand() * 50;
  for (let p = 0; p < width * height; p++) {
    v += (rand() - 0.5) * 6;
    const base = Math.min(255, Math.max(0, v));
    data[p * 3] = base + 10 > 255 ? 255 : base + 10;
    data[p * 3 + 1] = base;
    data[p * 3 + 2] = base > 10 ? base - 10 : 0;
  }
  return { data, width, height, channels: 3 };
}

describe("DCT 8x8 manual", () => {
  it("IDCT(DCT(blok)) = identitas", () => {
    const rand = mulberry32(11);
    const blk = new Float64Array(BLOCK * BLOCK);
    for (let i = 0; i < blk.length; i++) blk[i] = rand() * 255;
    const back = idct2d(dct2d(blk));
    for (let i = 0; i < blk.length; i++)
      expect(back[i]).toBeCloseTo(blk[i], 8);
  });

  it("round-trip embed→extract pada citra halus", () => {
    const img = smoothRGB(512, 512);
    const { stego } = embedDCT(img, "robust 24700611152", "dctKey");
    const res = extractDCT(stego, "dctKey");
    expect(res.success).toBe(true);
    expect(res.payload).toBe("robust 24700611152");
  });

  it("extract key salah gagal", () => {
    const img = smoothRGB(512, 512);
    const { stego } = embedDCT(img, "abcdef", "k1");
    expect(extractDCT(stego, "k2").success).toBe(false);
  });

  it("payload melebihi kapasitas blok ditolak", () => {
    const img = smoothRGB(16, 16); // 4 blok
    expect(() => embedDCT(img, "x".repeat(300), "k")).toThrow(/kapasitas/);
  });

  it("tahan kompresi JPEG kualitas 70 dan 50", async () => {
    const img = smoothRGB(512, 512, 5);
    const { stego } = embedDCT(img, "uji ketahanan jpeg", "kk");
    for (const q of [90, 70, 50] as const) {
      const png = await rawToPng(stego);
      const jpeg = await encodeJpeg(await loadRaw(png), q);
      const attacked = await loadRaw(jpeg);
      const res = extractDCT(attacked, "kk");
      expect(res.success, `JPEG-${q}`).toBe(true);
      expect(res.payload, `JPEG-${q}`).toBe("uji ketahanan jpeg");
    }
  });

  it("tahan noise ringan dan pergeseran brightness", async () => {
    const img = smoothRGB(512, 512, 7);
    const { stego } = embedDCT(img, "noise brite", "kk");
    const noisy = await applyAttack(stego, "noise", { sigma: 4 });
    expect(extractDCT(noisy, "kk").payload).toBe("noise brite");
    const bright = await applyAttack(stego, "brightness", { delta: 15 });
    expect(extractDCT(bright, "kk").payload).toBe("noise brite");
  });
});
