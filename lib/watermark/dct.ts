import { RawImage } from "@/lib/image/sharp-utils";
import { encryptPayload, decryptPayload, ENVELOPE_OVERHEAD } from "@/lib/crypto/aes-gcm";
import {
  bytesToBits,
  bitsToBytes,
  buildHeaderedPacket,
  readHeaderBits,
  shuffledIndices,
  deriveKeyMaterial,
  HEADER_BITS,
} from "@/lib/watermark/shared";

/**
 * Jalur Robust — DCT 2D 8×8 manual + QIM pada sepasang koefisien frekuensi
 * menengah (TASK.md §3.3). Bit ditanam pada selisih coef(4,1) - coef(3,2):
 *   bit 1 → diff >= +margin ; bit 0 → diff <= -margin
 * Ekstraksi cukup uji tanda selisih → tahan kuantisasi JPEG selama |diff| utuh.
 */

export const BLOCK = 8;
export const PAIR_A: [number, number] = [4, 1];
export const PAIR_B: [number, number] = [3, 2];
export const DEFAULT_MARGIN = 60;
export const MIN_MARGIN = 8;

const COS_TABLE = new Float64Array(BLOCK * BLOCK);
for (let x = 0; x < BLOCK; x++) {
  for (let u = 0; u < BLOCK; u++) {
    COS_TABLE[x * BLOCK + u] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * BLOCK));
  }
}
const NORM = new Float64Array(BLOCK);
NORM[0] = Math.sqrt(1 / BLOCK);
for (let u = 1; u < BLOCK; u++) NORM[u] = Math.sqrt(2 / BLOCK);

/** DCT-II 2D 8×8 manual, in-place buffer terpisah. */
export function dct2d(block: Float64Array): Float64Array {
  const out = new Float64Array(BLOCK * BLOCK);
  for (let v = 0; v < BLOCK; v++) {
    for (let u = 0; u < BLOCK; u++) {
      let sum = 0;
      for (let y = 0; y < BLOCK; y++) {
        for (let x = 0; x < BLOCK; x++) {
          sum +=
            block[y * BLOCK + x] *
            COS_TABLE[y * BLOCK + v] *
            COS_TABLE[x * BLOCK + u];
        }
      }
      out[v * BLOCK + u] = NORM[v] * NORM[u] * sum;
    }
  }
  return out;
}

/** IDCT-III 2D 8×8 manual (invers eksak dari dct2d). */
export function idct2d(coef: Float64Array): Float64Array {
  const out = new Float64Array(BLOCK * BLOCK);
  for (let y = 0; y < BLOCK; y++) {
    for (let x = 0; x < BLOCK; x++) {
      let sum = 0;
      for (let v = 0; v < BLOCK; v++) {
        for (let u = 0; u < BLOCK; u++) {
          sum +=
            coef[v * BLOCK + u] *
            NORM[v] *
            NORM[u] *
            COS_TABLE[y * BLOCK + v] *
            COS_TABLE[x * BLOCK + u];
        }
      }
      out[y * BLOCK + x] = sum;
    }
  }
  return out;
}

/* ---------- kanal luma ---------- */

function toLuma(rgb: Buffer, n: number): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    y[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
  }
  return y;
}

function writeLumaDiff(rgb: Buffer, y0: Float64Array, y1: Float64Array): void {
  for (let i = 0; i < y0.length; i++) {
    const d = y1[i] - y0[i];
    for (let c = 0; c < 3; c++) {
      const v = rgb[i * 3 + c] + d;
      rgb[i * 3 + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
}

function blockCount(img: RawImage): number {
  return Math.floor(img.width / BLOCK) * Math.floor(img.height / BLOCK);
}

export function dctCapacityBits(img: RawImage): number {
  return blockCount(img);
}

export function dctMaxPayloadBytes(img: RawImage): number {
  const maxPacket = dctCapacityBits(img) - HEADER_BITS - 8;
  return Math.max(0, Math.floor(maxPacket / 8) - ENVELOPE_OVERHEAD);
}

/* ---------- packet: bit + header paritas per 8 bit (peta blok) ---------- */

function buildStream(packet: Uint8Array): Uint8Array {
  const stream: number[] = [];
  let parity = 0;
  for (let i = 0; i < packet.length; i++) {
    stream.push(packet[i]);
    parity ^= packet[i];
    if ((i + 1) % LSB_BLOCK_SIZE === 0) {
      stream.push(parity);
      parity = 0;
    }
  }
  if (packet.length % LSB_BLOCK_SIZE !== 0) stream.push(parity);
  return Uint8Array.from(stream);
}
const LSB_BLOCK_SIZE = 8;

function splitStream(stream: Uint8Array): {
  packet: Uint8Array;
  blockMap: Uint8Array;
} {
  const blockMap = new Uint8Array(
    Math.ceil(stream.length / (LSB_BLOCK_SIZE + 1))
  );
  const packetArr: number[] = [];
  let blk = 0;
  for (let i = 0; i < stream.length; i += LSB_BLOCK_SIZE + 1) {
    let parity = 0;
    const end = Math.min(i + LSB_BLOCK_SIZE, stream.length);
    for (let j = i; j < end; j++) {
      packetArr.push(stream[j]);
      parity ^= stream[j];
    }
    const expected = stream[i + LSB_BLOCK_SIZE] ?? 0;
    blockMap[blk++] = parity === expected ? 1 : 0;
  }
  return { packet: Uint8Array.from(packetArr), blockMap };
}

/* ---------- embed / extract ---------- */

export interface DctEmbedResult {
  stego: RawImage;
  totalBits: number;
  capacityBits: number;
  margin: number;
}

export function embedDCT(
  img: RawImage,
  payload: string,
  stegoKey: string,
  margin = DEFAULT_MARGIN
): DctEmbedResult {
  if (margin < MIN_MARGIN)
    throw new Error(`margin terlalu kecil (min ${MIN_MARGIN})`);
  const envelope = encryptPayload(payload, stegoKey);
  const packet = buildHeaderedPacket(bytesToBits(envelope));
  const stream = buildStream(packet);
  const nb = blockCount(img);
  if (stream.length > nb) {
    throw new Error(
      `payload melebihi kapasitas DCT: butuh ${stream.length} blok, tersedia ${nb}`
    );
  }

  const { prngSeed } = deriveKeyMaterial(stegoKey);
  const order = shuffledIndices(nb, prngSeed ^ 0x5eed);
  const y0 = toLuma(img.data, img.width * img.height);
  const y1 = Float64Array.from(y0);
  const colsB = Math.floor(img.width / BLOCK);

  for (let i = 0; i < stream.length; i++) {
    const b = order[i];
    const bx = (b % colsB) * BLOCK;
    const by = Math.floor(b / colsB) * BLOCK;
    const blk = new Float64Array(BLOCK * BLOCK);
    for (let yy = 0; yy < BLOCK; yy++) {
      for (let xx = 0; xx < BLOCK; xx++) {
        blk[yy * BLOCK + xx] = y1[(by + yy) * img.width + bx + xx];
      }
    }
    const c = dct2d(blk);
    const ia = PAIR_A[1] * BLOCK + PAIR_A[0];
    const ib = PAIR_B[1] * BLOCK + PAIR_B[0];
    const bit = stream[i];
    const diff = c[ia] - c[ib];
    if (bit === 1 && diff < margin) {
      const add = margin - diff;
      c[ia] += add / 2;
      c[ib] -= add / 2;
    } else if (bit === 0 && diff > -margin) {
      const add = diff + margin;
      c[ia] -= add / 2;
      c[ib] += add / 2;
    }
    const back = idct2d(c);
    for (let yy = 0; yy < BLOCK; yy++) {
      for (let xx = 0; xx < BLOCK; xx++) {
        y1[(by + yy) * img.width + bx + xx] = Math.min(
          255,
          Math.max(0, back[yy * BLOCK + xx])
        );
      }
    }
  }

  const data = Buffer.from(img.data);
  writeLumaDiff(data, y0, y1);
  return {
    stego: { ...img, data },
    totalBits: stream.length,
    capacityBits: nb,
    margin,
  };
}

export interface DctExtractResult {
  success: boolean;
  payload?: string;
  reason?: string;
  blockMap?: Uint8Array;
  berEstimate?: number;
}

function readBits(img: RawImage, stegoKey: string, count: number): Uint8Array {
  const nb = blockCount(img);
  const { prngSeed } = deriveKeyMaterial(stegoKey);
  const order = shuffledIndices(nb, prngSeed ^ 0x5eed);
  const y = toLuma(img.data, img.width * img.height);
  const colsB = Math.floor(img.width / BLOCK);
  const bits = new Uint8Array(count);
  const ia = PAIR_A[1] * BLOCK + PAIR_A[0];
  const ib = PAIR_B[1] * BLOCK + PAIR_B[0];
  for (let i = 0; i < count; i++) {
    const b = order[i];
    const bx = (b % colsB) * BLOCK;
    const by = Math.floor(b / colsB) * BLOCK;
    const blk = new Float64Array(BLOCK * BLOCK);
    for (let yy = 0; yy < BLOCK; yy++) {
      for (let xx = 0; xx < BLOCK; xx++) {
        blk[yy * BLOCK + xx] = y[(by + yy) * img.width + bx + xx];
      }
    }
    const c = dct2d(blk);
    bits[i] = c[ia] - c[ib] > 0 ? 1 : 0;
  }
  return bits;
}

export function extractDCT(
  img: RawImage,
  stegoKey: string
): DctExtractResult {
  const nb = blockCount(img);
  if (nb < HEADER_BITS + 8) return { success: false, reason: "citra terlalu kecil" };

  const headStreamLen = HEADER_BITS + Math.ceil(HEADER_BITS / LSB_BLOCK_SIZE) + LSB_BLOCK_SIZE;
  const first = readBits(img, stegoKey, Math.min(nb, headStreamLen));
  const { packet: headPacket } = splitStream(first);
  if (headPacket.length < HEADER_BITS)
    return { success: false, reason: "header tidak terbaca" };
  const payloadBits = readHeaderBits(headPacket);
  if (
    payloadBits === 0 ||
    payloadBits % 8 !== 0 ||
    payloadBits > (nb - HEADER_BITS) * 8
  ) {
    const { blockMap } = splitStream(first);
    return {
      success: false,
      reason: "header tidak valid — key salah / rusak berat",
      blockMap,
      berEstimate: 1 - blockMap.reduce((a, b) => a + b, 0) / blockMap.length,
    };
  }

  const totalPacket = HEADER_BITS + payloadBits;
  const totalStream = totalPacket + Math.ceil(totalPacket / LSB_BLOCK_SIZE);
  if (totalStream > nb)
    return { success: false, reason: "payload melebihi kapasitas" };

  const stream =
    totalStream <= first.length
      ? first.subarray(0, totalStream)
      : readBits(img, stegoKey, totalStream);
  const { packet, blockMap } = splitStream(stream);
  const envelope = Buffer.from(bitsToBytes(packet.subarray(HEADER_BITS)));
  const ones = blockMap.reduce((a, b) => a + b, 0);
  const berEstimate = 1 - ones / blockMap.length;
  try {
    const payload = decryptPayload(envelope, stegoKey);
    return { success: true, payload, blockMap, berEstimate };
  } catch {
    return {
      success: false,
      reason: "dekripsi gagal — key salah / serangan melebihi ketahanan DCT",
      blockMap,
      berEstimate,
    };
  }
}
