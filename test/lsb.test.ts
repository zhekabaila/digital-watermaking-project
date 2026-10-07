import { describe, it, expect } from "vitest";
import {
  embedLSB,
  extractLSB,
  lsbCapacityBits,
  lsbMaxPayloadBytes,
  lsbPlaneDiffMap,
} from "@/lib/watermark/lsb";
import { RawImage } from "@/lib/image/sharp-utils";
import { mulberry32 } from "@/lib/watermark/shared";
  
function syntheticRGB(width: number, height: number, seed = 1): RawImage {
  const rand = mulberry32(seed);
  const data = Buffer.alloc(width * height * 3);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rand() * 256);
  return { data, width, height, channels: 3 };
}

describe("LSB fragile", () => {
  it("round-trip embed→extract dengan key benar", () => {
    const img = syntheticRGB(128, 128);
    const { stego } = embedLSB(img, "NPM 24700611152 Prodi Informatika", "stegoKeyA");
    const res = extractLSB(stego, "stegoKeyA");
    expect(res.success).toBe(true);
    expect(res.payload).toBe("NPM 24700611152 Prodi Informatika");
  });

  it("extract dengan key salah gagal dengan alasan", () => {
    const img = syntheticRGB(64, 64);
    const { stego } = embedLSB(img, "rahasia", "kunci1");
    const res = extractLSB(stego, "kunci2");
    expect(res.success).toBe(false);
    expect(res.reason).toBeTruthy();
  });

  it("payload melebihi kapasitas ditolak", () => {
    const img = syntheticRGB(16, 16);
    expect(lsbMaxPayloadBytes(img)).toBeLessThan(600);
    expect(() => embedLSB(img, "x".repeat(600), "k")).toThrow(/kapasitas/);
  });

  it("stego hanya berbeda ≤1 nilai pada channel B (perubahan tak kasat mata)", () => {
    const img = syntheticRGB(64, 64);
    const { stego } = embedLSB(img, "cek", "k");
    let maxB = 0;
    let other = 0;
    for (let p = 0; p < img.width * img.height; p++) {
      maxB = Math.max(maxB, Math.abs(img.data[p * 3 + 2] - stego.data[p * 3 + 2]));
      other = Math.max(
        other,
        Math.abs(img.data[p * 3] - stego.data[p * 3]),
        Math.abs(img.data[p * 3 + 1] - stego.data[p * 3 + 1])
      );
    }
    expect(maxB).toBeLessThanOrEqual(1);
    expect(other).toBe(0);
  });

  it("serangan yang mengubah LSB merusak ekstraksi & blockMap menandai error", () => {
    const img = syntheticRGB(96, 96);
    const { stego } = embedLSB(img, "fragile test", "kk");
    const attacked = { ...stego, data: Buffer.from(stego.data) };
    const rand = mulberry32(9);
    for (let p = 0; p < 400; p++) {
      const i = Math.floor(rand() * attacked.width * attacked.height) * 3 + 2;
      attacked.data[i] ^= 1;
    }
    const res = extractLSB(attacked, "kk");
    expect(res.success).toBe(false);
    expect(res.blockMap).toBeTruthy();
    const map = lsbPlaneDiffMap(stego, attacked, 16);
    expect(map.modified.some((m) => m === 1)).toBe(true);
  });

  it("kapasitas = jumlah piksel", () => {
    expect(lsbCapacityBits(syntheticRGB(50, 40))).toBe(2000);
  });
});
