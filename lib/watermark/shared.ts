import { scryptSync } from "node:crypto";

export const HEADER_BYTES = 4; // 32-bit length prefix (TASK.md §3.1)
export const HEADER_BITS = HEADER_BYTES * 8;

/** PRNG mulberry32 — ditulis manual, deterministik (TASK.md §7: bukan Math.random). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derivasi master key (AES) + seed PRNG dari satu stego-key user via scrypt. */
export function deriveKeyMaterial(stegoKey: string): {
  aesKey: Buffer; // 32 byte -> AES-256
  prngSeed: number;
} {
  const master = scryptSync(stegoKey, "watermaking-silow-salt-v1", 40);
  const aesKey = master.subarray(0, 32);
  const prngSeed = master.readUInt32BE(32);
  return { aesKey, prngSeed };
}

/** Urutan indeks unik 0..n-1 hasil Fisher-Yates dengan PRNG seeded. */
export function shuffledIndices(n: number, seed: number): Uint32Array {
  const rand = mulberry32(seed);
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  return idx;
}

export function bytesToBits(bytes: Uint8Array): Uint8Array {
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits[i * 8 + (7 - b)] = (bytes[i] >> b) & 1;
    }
  }
  return bits;
}

export function bitsToBytes(bits: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | (bits[i * 8 + b] & 1);
    out[i] = v;
  }
  return out;
}

/** Header = length prefix 32-bit BE + payload biner. */
export function buildHeaderedPacket(payloadBits: Uint8Array): Uint8Array {
  const header = new Uint8Array(HEADER_BITS);
  const len = payloadBits.length;
  for (let b = 31; b >= 0; b--) header[31 - b] = (len >>> b) & 1;
  const packet = new Uint8Array(HEADER_BITS + payloadBits.length);
  packet.set(header, 0);
  packet.set(payloadBits, HEADER_BITS);
  return packet;
}

export function readHeaderBits(packetBits: Uint8Array): number {
  let len = 0;
  for (let i = 0; i < HEADER_BITS; i++) len = (len << 1) | (packetBits[i] & 1);
  return len >>> 0;
}
