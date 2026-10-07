/**
 * NC (Normalized Correlation) & BER (Bit Error Rate) antara watermark asli
 * dan watermark hasil ekstraksi (TASK.md §3.5).
 * Bit 0/1 dipetakan ke -1/+1 untuk korelasi; bila panjang beda, bagian yang
 * tidak terbaca dihitung sebagai error pada BER dan nol pada NC.
 */

export function ber(original: Uint8Array, extracted: Uint8Array): number {
  const len = Math.max(original.length, extracted.length);
  if (len === 0) return 0;
  let err = 0;
  for (let i = 0; i < len; i++) {
    const o = i < original.length ? original[i] & 1 : 0;
    const e = i < extracted.length ? extracted[i] & 1 : 0;
    if (o !== e) err++;
  }
  return err / len;
}

export function normalizedCorrelation(
  original: Uint8Array,
  extracted: Uint8Array
): number {
  const len = Math.max(original.length, extracted.length);
  if (len === 0) return 1;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < len; i++) {
    const x = i < original.length ? (original[i] & 1 ? 1 : -1) : 0;
    const y = i < extracted.length ? (extracted[i] & 1 ? 1 : -1) : 0;
    sxy += x * y;
    sxx += x * x;
    syy += y * y;
  }
  const denom = Math.sqrt(sxx * syy);
  return denom === 0 ? 0 : sxy / denom;
}

export function textToBits(t: string): Uint8Array {
  const buf = Buffer.from(t, "utf8");
  const bits = new Uint8Array(buf.length * 8);
  for (let i = 0; i < buf.length; i++) {
    for (let b = 0; b < 8; b++) bits[i * 8 + b] = (buf[i] >> (7 - b)) & 1;
  }
  return bits;
}
