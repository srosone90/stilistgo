/**
 * AES-256-GCM field-level encryption for sensitive PII.
 * Encrypted fields: client.phone, technicalCard.notes
 * Uses Node.js crypto (server-side only — never exposed to the browser).
 *
 * Set env var: ENCRYPTION_KEY=<64 hex chars = 32 bytes>
 * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;  // 96-bit IV for GCM
const TAG_LEN = 16; // 128-bit auth tag

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? '';
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns a base64 string: iv(12B) + tag(16B) + ciphertext, all concatenated.
 */
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: [iv 12B][tag 16B][ciphertext nB]
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a ciphertext produced by encryptField.
 * Returns the original plaintext or null on failure (corrupted/wrong key).
 */
export function decryptField(ciphertext: string): string | null {
  try {
    const key = getKey();
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const encrypted = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null;
  }
}

/**
 * Returns true if the value looks like an encrypted ciphertext
 * (starts with a base64 string of the expected minimum length).
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 40) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(value);
}

/**
 * Encrypt if not already encrypted, pass-through otherwise.
 * Idempotent: safe to call multiple times on the same data.
 */
export function safeEncrypt(value: string): string {
  if (!value) return value;
  if (isEncrypted(value)) return value;
  return encryptField(value);
}

/**
 * Decrypt if encrypted, pass-through plaintext otherwise.
 */
export function safeDecrypt(value: string): string {
  if (!value) return value;
  if (!isEncrypted(value)) return value;
  return decryptField(value) ?? value;
}
