import { describe, it, expect } from "vitest";
import { encryptPayload, decryptPayload } from "@/lib/crypto/aes-gcm";
import {
  mulberry32,
  deriveKeyMaterial,
  shuffledIndices,
  bytesToBits,
  bitsToBytes,
  buildHeaderedPacket,
  readHeaderBits,
} from "@/lib/watermark/shared";

describe("aes-gcm payload", () => {
  it("round-trip encrypt/decrypt dengan key sama", () => {
    const env = encryptPayload("24700611152@student.unsil.ac.id", "kunci-rahasia");
    expect(decryptPayload(env, "kunci-rahasia")).toBe(
      "24700611152@student.unsil.ac.id"
    );
  });

  it("decrypt dengan key salah harus melempar error (authTag gagal)", () => {
    const env = encryptPayload("npm-123", "key-benar");
    expect(() => decryptPayload(env, "key-salah")).toThrow();
  });

  it("ciphertext berbeda tiap panggil (IV acak), plaintext sama tetap terverifikasi", () => {
    const a = encryptPayload("sama", "k");
    const b = encryptPayload("sama", "k");
    expect(a.equals(b)).toBe(false);
    expect(decryptPayload(a, "k")).toBe("sama");
    expect(decryptPayload(b, "k")).toBe("sama");
  });
});

describe("shared: PRNG & konversi bit", () => {
  it("mulberry32 deterministik untuk seed sama", () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    for (let i = 0; i < 5; i++) expect(r1()).toBe(r2());
  });

  it("deriveKeyMaterial stabil & seed PRNG berbeda per key", () => {
    const a = deriveKeyMaterial("key1");
    const b = deriveKeyMaterial("key1");
    const c = deriveKeyMaterial("key2");
    expect(a.aesKey.equals(b.aesKey)).toBe(true);
    expect(a.prngSeed).toBe(b.prngSeed);
    expect(a.prngSeed).not.toBe(c.prngSeed);
  });

  it("shuffledIndices menghasilkan permutasi tanpa duplikasi", () => {
    const idx = shuffledIndices(1000, 7);
    expect(new Set(idx).size).toBe(1000);
  });

  it("bytesToBits/bitsToBytes bolak-balik; header length prefix konsisten", () => {
    const bytes = Uint8Array.from([0b10110001, 0x00, 0xff, 0x7f]);
    expect(bitsToBytes(bytesToBits(bytes))).toEqual(bytes);
    const packet = buildHeaderedPacket(bytesToBits(bytes));
    expect(readHeaderBits(packet)).toBe(bytes.length * 8);
  });
});
