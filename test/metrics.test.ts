import { describe, it, expect } from "vitest";
import { msePsnr } from "@/lib/metrics/psnr";
import { ber, normalizedCorrelation, textToBits } from "@/lib/metrics/nc-ber";
import { histogram } from "@/lib/metrics/entropy-histogram";

const imgA = {
  data: Uint8Array.from([10, 20, 30, 40, 50, 60]) as unknown as Buffer,
  width: 2,
  height: 1,
  channels: 3 as const,
};

describe("metrics", () => {
  it("identik → MSE 0, PSNR Infinity", () => {
    const r = msePsnr(imgA, imgA);
    expect(r.mse).toBe(0);
    expect(r.psnr).toBe(Infinity);
  });

  it("MSE/PSNR nilai known", () => {
    const b = { ...imgA, data: Uint8Array.from([12, 20, 30, 40, 50, 60]) as unknown as Buffer };
    const r = msePsnr(imgA, b);
    expect(r.mse).toBeCloseTo(4 / 6, 6);
    expect(r.psnr).toBeCloseTo(10 * Math.log10(65025 / (4 / 6)), 6);
    expect(r.maxDiff).toBe(2);
  });

  it("BER 0 untuk bit sama, 1 untuk kebalikannya", () => {
    const a = textToBits("abc");
    expect(ber(a, Uint8Array.from(a))).toBe(0);
    const inv = Uint8Array.from(a, (x) => 1 - x);
    expect(ber(a, inv)).toBe(1);
  });

  it("NC = 1 bila sama, negatif bila terbalik", () => {
    const a = textToBits("xyz");
    expect(normalizedCorrelation(a, Uint8Array.from(a))).toBeCloseTo(1, 10);
    const inv = Uint8Array.from(a, (x) => 1 - x);
    expect(normalizedCorrelation(a, inv)).toBeCloseTo(-1, 10);
  });

  it("histogram 256 bin per channel & entropi positif", () => {
    const h = histogram(imgA);
    expect(h.channels[0].length).toBe(256);
    expect(h.channels[0][10]).toBe(1);
    expect(h.shannonEntropy).toBeGreaterThan(0);
  });
});
