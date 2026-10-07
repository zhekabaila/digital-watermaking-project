import { RawImage } from "@/lib/image/sharp-utils";

export interface MsePsnr {
  mse: number;
  psnr: number; // dB; Infinity bila identik
  maxDiff: number;
}

/** MSE & PSNR atas dua buffer RGB berukuran sama (TASK.md §3.5). */
export function msePsnr(a: RawImage, b: RawImage): MsePsnr {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error("dimensi kedua citra tidak sama");
  }
  const n = a.width * a.height;
  let se = 0;
  let maxDiff = 0;
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) {
      const d = a.data[p * 3 + c] - b.data[p * 3 + c];
      se += d * d;
      const ad = Math.abs(d);
      if (ad > maxDiff) maxDiff = ad;
    }
  }
  const mse = se / (n * 3);
  const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  return { mse, psnr, maxDiff };
}
