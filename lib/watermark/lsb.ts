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
 * Jalur Fragile — LSB pada buffer RGB (TASK.md §3.2).
 * 1 bit payload → LSB channel B dari piksel berurutan acak (PRNG seed = stego-key).
 * Setiap 8 piksel tersisip dilengkapi 1 bit paritas blok (sink = XOR bit tersisip),
 * dipakai untuk peta area termodifikasi pasca-serangan (§3.4).
 */

export const LSB_BLOCK = 8; // piksel per blok paritas

export interface LsbEmbedResult {
  stego: RawImage;
  totalBits: number;
  capacityBits: number;
  blockCount: number;
}

export function lsbCapacityBits(img: RawImage): number {
  return img.width * img.height; // 1 bit/piksel (channel B)
}

export function lsbMaxPayloadBytes(img: RawImage): number {
  const cap = lsbCapacityBits(img);
  const maxPacket = Math.floor((cap * 8) / 9) - 1; // sisakan ruang paritas + header
  return Math.max(0, Math.floor((maxPacket - HEADER_BITS) / 8) - ENVELOPE_OVERHEAD);
}

export function embedLSB(
  img: RawImage,
  payload: string,
  stegoKey: string
): LsbEmbedResult {
  const envelope = encryptPayload(payload, stegoKey);
  const packet = buildHeaderedPacket(bytesToBits(envelope));
  const cap = lsbCapacityBits(img);
  const need = packet.length + Math.ceil(packet.length / LSB_BLOCK);
  if (need > cap) {
    throw new Error(
      `payload melebihi kapasitas LSB: butuh ${need} bit, tersedia ${cap} bit`
    );
  }

  const { prngSeed } = deriveKeyMaterial(stegoKey);
  const order = shuffledIndices(cap, prngSeed);
  const data = Buffer.from(img.data);

  // susun bitstream: packet + bit paritas setiap 8 bit payload
  const stream: number[] = [];
  let parity = 0;
  for (let i = 0; i < packet.length; i++) {
    stream.push(packet[i]);
    parity ^= packet[i];
    if ((i + 1) % LSB_BLOCK === 0) {
      stream.push(parity);
      parity = 0;
    }
  }
  if (packet.length % LSB_BLOCK !== 0) stream.push(parity);

  for (let i = 0; i < stream.length; i++) {
    const px = order[i];
    const bi = px * 3 + 2; // channel B
    data[bi] = (data[bi] & 0xfe) | stream[i];
  }

  const blockCount = Math.ceil(stream.length / (LSB_BLOCK + 1));
  return {
    stego: { ...img, data },
    totalBits: stream.length,
    capacityBits: cap,
    blockCount,
  };
}

export interface LsbExtractResult {
  success: boolean;
  payload?: string;
  reason?: string;
  /** bit paritas per blok: 1 = blok lolos, 0 = blok terdeteksi diubah */
  blockMap?: Uint8Array;
  bitsRead?: number;
}

function readStream(
  img: RawImage,
  stegoKey: string,
  count: number
): { bits: Uint8Array; order: Uint32Array } {
  const { prngSeed } = deriveKeyMaterial(stegoKey);
  const order = shuffledIndices(img.width * img.height, prngSeed);
  const bits = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    bits[i] = img.data[order[i] * 3 + 2] & 1;
  }
  return { bits, order };
}

function splitParity(stream: Uint8Array): {
  packet: Uint8Array;
  blockMap: Uint8Array;
} {
  const blockMap = new Uint8Array(Math.ceil(stream.length / (LSB_BLOCK + 1)));
  const packetArr: number[] = [];
  let blk = 0;
  for (let i = 0; i < stream.length; i += LSB_BLOCK + 1) {
    let parity = 0;
    const end = Math.min(i + LSB_BLOCK, stream.length);
    for (let j = i; j < end; j++) {
      packetArr.push(stream[j]);
      parity ^= stream[j];
    }
    const expected = stream[i + LSB_BLOCK] ?? 0;
    blockMap[blk++] = parity === expected ? 1 : 0;
  }
  return { packet: Uint8Array.from(packetArr), blockMap };
}

export function extractLSB(
  img: RawImage,
  stegoKey: string
): LsbExtractResult {
  const cap = img.width * img.height;
  if (cap < HEADER_BITS + 8) return { success: false, reason: "citra terlalu kecil" };

  // baca cukup untuk header + paritasnya
  const headerStreamLen =
    HEADER_BITS + Math.ceil(HEADER_BITS / LSB_BLOCK) + LSB_BLOCK;
  const first = readStream(img, stegoKey, Math.min(cap, headerStreamLen));
  const { packet: headPacket } = splitParity(first.bits);
  if (headPacket.length < HEADER_BITS)
    return { success: false, reason: "header tidak terbaca" };
  const payloadBits = readHeaderBits(headPacket);
  if (
    payloadBits === 0 ||
    payloadBits % 8 !== 0 ||
    payloadBits > (cap - HEADER_BITS) * 8
  ) {
    const { blockMap } = splitParity(first.bits);
    return {
      success: false,
      reason: "header tidak valid — key salah / citra rusak",
      blockMap,
    };
  }

  const totalPacket = HEADER_BITS + payloadBits;
  const totalStream = totalPacket + Math.ceil(totalPacket / LSB_BLOCK);
  if (totalStream > cap)
    return { success: false, reason: "payload melebihi kapasitas" };

  const full =
    totalStream <= first.bits.length
      ? { bits: first.bits.subarray(0, totalStream) }
      : readStream(img, stegoKey, totalStream);
  const { packet, blockMap } = splitParity(full.bits);
  const envelope = Buffer.from(bitsToBytes(packet.subarray(HEADER_BITS)));
  try {
    const payload = decryptPayload(envelope, stegoKey);
    return { success: true, payload, blockMap, bitsRead: totalStream };
  } catch {
    return {
      success: false,
      reason: "dekripsi gagal — key salah / citra dimanipulasi",
      blockMap,
      bitsRead: totalStream,
    };
  }
}

/** Perbandingan LSB-plane dua citra per blok (TASK.md §3.4): cover vs stego,
 * atau stego sebelum vs sesudah serangan — blok ditandai bila ada LSB berbeda. */
export function lsbPlaneDiffMap(
  cover: RawImage,
  stego: RawImage,
  blockSize = 16
): { cols: number; rows: number; modified: Uint8Array } {
  const cols = Math.ceil(cover.width / blockSize);
  const rows = Math.ceil(cover.height / blockSize);
  const modified = new Uint8Array(cols * rows);
  const n = Math.min(cover.width * cover.height, stego.width * stego.height);
  for (let p = 0; p < n; p++) {
    if (((cover.data[p * 3 + 2] ^ stego.data[p * 3 + 2]) & 1) === 0) continue;
    const x = p % cover.width;
    const y = Math.floor(p / cover.width);
    modified[Math.floor(y / blockSize) * cols + Math.floor(x / blockSize)] = 1;
  }
  return { cols, rows, modified };
}
