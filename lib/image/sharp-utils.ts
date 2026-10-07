import sharp from "sharp";
import { mulberry32 } from "@/lib/watermark/shared";

export interface RawImage {
  data: Buffer; // RGB, 3 byte/pixel
  width: number;
  height: number;
  channels: 3;
}

export async function loadRaw(img: Buffer | Uint8Array): Promise<RawImage> {
  const buf = Buffer.from(img);
  const res = await sharp(buf)
    .removeAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (res.info.channels !== 3 || !res.info.width || !res.info.height) {
    throw new Error("gagal decode RGB dari citra");
  }
  return {
    data: res.data,
    width: res.info.width,
    height: res.info.height,
    channels: 3,
  };
}

export async function rawToPng(raw: RawImage): Promise<Buffer> {
  return sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: 3 },
  })
    .png()
    .toBuffer();
}

export async function encodeJpeg(raw: RawImage, quality: number): Promise<Buffer> {
  return sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: 3 },
  })
    .jpeg({ quality, chromaSubsampling: "4:2:0" })
    .toBuffer();
}

/* ---------- Serangan (TASK.md §3.5) ---------- */

export type AttackType =
  | "none"
  | "jpeg90"
  | "jpeg70"
  | "jpeg50"
  | "crop"
  | "resize"
  | "noise"
  | "brightness"
  | "contrast";

export interface AttackParams {
  /** rasio crop (0..1), default 0.75 */
  ratio?: number;
  /** rasio resize, default 0.5 */
  scale?: number;
  /** amplitude noise gaussian, default 10 */
  sigma?: number;
  /** delta brightness %, default +20 */
  delta?: number;
}

export async function applyAttack(
  raw: RawImage,
  type: AttackType,
  params: AttackParams = {}
): Promise<RawImage> {
  switch (type) {
    case "none":
      return raw;
    case "jpeg90":
    case "jpeg70":
    case "jpeg50": {
      const quality = Number(type.slice(4));
      return loadRaw(await encodeJpeg(raw, quality));
    }
    case "crop": {
      const ratio = params.ratio ?? 0.75;
      const w = Math.max(8, Math.floor(raw.width * ratio));
      const h = Math.max(8, Math.floor(raw.height * ratio));
      const left = Math.floor((raw.width - w) / 2);
      const top = Math.floor((raw.height - h) / 2);
      const buf = await sharp(raw.data, {
        raw: { width: raw.width, height: raw.height, channels: 3 },
      })
        .extract({ left, top, width: w, height: h })
        .raw()
        .toBuffer({ resolveWithObject: true });
      return {
        data: buf.data,
        width: buf.info.width,
        height: buf.info.height,
        channels: 3,
      };
    }
    case "resize": {
      const scale = params.scale ?? 0.5;
      const w = Math.max(8, Math.round(raw.width * scale));
      const h = Math.max(8, Math.round(raw.height * scale));
      const buf = await sharp(raw.data, {
        raw: { width: raw.width, height: raw.height, channels: 3 },
      })
        .resize(w, h)
        .raw()
        .toBuffer({ resolveWithObject: true });
      // kembalikan ke ukuran semula agar posisi piksel sejajar untuk ekstraksi
      const back = await sharp(buf.data, {
        raw: { width: buf.info.width, height: buf.info.height, channels: 3 },
      })
        .resize(raw.width, raw.height)
        .raw()
        .toBuffer({ resolveWithObject: true });
      return {
        data: back.data,
        width: raw.width,
        height: raw.height,
        channels: 3,
      };
    }
    case "noise": {
      const sigma = params.sigma ?? 10;
      const data = Buffer.from(raw.data); // salinan
      const rand = mulberry32(0xc0ffee);
      for (let i = 0; i < data.length; i++) {
        // noise seragam ±sigma via dua undian (pendekatan segitiga ~ Gaussian)
        const u = rand() + rand() + rand() - 1.5;
        const v = Math.round(u * sigma);
        data[i] = Math.min(255, Math.max(0, data[i] + v));
      }
      return { ...raw, data };
    }
    case "brightness": {
      const delta = params.delta ?? 20;
      const buf = await sharp(raw.data, {
        raw: { width: raw.width, height: raw.height, channels: 3 },
      })
        .modulate({ brightness: 1 + delta / 100 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { ...raw, data: buf.data };
    }
    case "contrast": {
      const delta = params.delta ?? 20;
      const buf = await sharp(raw.data, {
        raw: { width: raw.width, height: raw.height, channels: 3 },
      })
        .linear(1 + delta / 100, -(1 + delta / 100) * 128 + 128)
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { ...raw, data: buf.data };
    }
  }
}
