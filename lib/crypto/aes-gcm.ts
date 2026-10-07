import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { deriveKeyMaterial } from "@/lib/watermark/shared";

/**
 * AES-256-GCM atas payload teks watermark.
 * Key diturunkan dari stego-key user (scrypt) — tidak ada key hardcoded.
 * Format: [salt(16) | iv(12) | authTag(16) | ciphertext] (TASK.md §3.1).
 * authTag memverifikasi integritas penuh (gagal = key salah / citra dimanipulasi).
 */

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptPayload(payload: string, stegoKey: string): Buffer {
  const { aesKey } = deriveKeyMaterial(stegoKey);
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv, {
    authTagLength: TAG_LEN,
  });
  const ciphertext = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, ciphertext]);
}

export function decryptPayload(envelope: Buffer, stegoKey: string): string {
  if (envelope.length < SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error("envelope terlalu pendek");
  }
  const { aesKey } = deriveKeyMaterial(stegoKey);
  const iv = envelope.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = envelope.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = envelope.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv, {
    authTagLength: TAG_LEN,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export const ENVELOPE_OVERHEAD = SALT_LEN + IV_LEN + TAG_LEN;
