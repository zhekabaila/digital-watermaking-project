import { RawImage } from "@/lib/image/sharp-utils";

export interface HistogramResult {
  /** 256 bin per channel R/G/B */
  channels: [number[], number[], number[]];
  shannonEntropy: number; // bit/pixel atas histogram grayscale
}

export function histogram(img: RawImage): HistogramResult {
  const ch: [number[], number[], number[]] = [
    new Array(256).fill(0),
    new Array(256).fill(0),
    new Array(256).fill(0),
  ];
  const gray = new Array(256).fill(0);
  const n = img.width * img.height;
  for (let p = 0; p < n; p++) {
    const r = img.data[p * 3];
    const g = img.data[p * 3 + 1];
    const b = img.data[p * 3 + 2];
    ch[0][r]++;
    ch[1][g]++;
    ch[2][b]++;
    gray[Math.round(0.299 * r + 0.587 * g + 0.114 * b)]++;
  }
  let ent = 0;
  for (let i = 0; i < 256; i++) {
    const pr = gray[i] / n;
    if (pr > 0) ent -= pr * Math.log2(pr);
  }
  return { channels: ch, shannonEntropy: ent };
}

/** LSB-plane grayscale (nilai 0/1 channel B) untuk steganalisis visual. */
export function lsbPlane(img: RawImage): Uint8Array {
  const n = img.width * img.height;
  const out = new Uint8Array(n);
  for (let p = 0; p < n; p++) out[p] = (img.data[p * 3 + 2] & 1) * 255;
  return out;
}
