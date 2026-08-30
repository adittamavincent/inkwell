import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEY_FILE = 'db.key';
let cachedKey: Buffer | null = null;
let encryptionFailedWarned = false;

export function getAppDataDir(): string {
  // Use com.inkwell.app directory on macOS to maintain compatibility with the Rust version
  const home = process.env.HOME || '.';
  const dir = path.join(home, 'Library', 'Application Support', 'com.inkwell.app');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      return path.join(home, '.inkwell');
    }
  }
  return dir;
}

function loadOrCreateKey(): Buffer | null {
  if (cachedKey) return cachedKey;

  const keyPath = path.join(getAppDataDir(), KEY_FILE);
  try {
    if (fs.existsSync(keyPath)) {
      const bytes = fs.readFileSync(keyPath);
      if (bytes.length === 32) {
        cachedKey = bytes;
        return cachedKey;
      }
    }

    // Generate fresh 256-bit (32 byte) key
    const newKey = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, newKey);
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch (err) {
      console.warn('Inkwell: Could not set 0600 permissions on key file:', err);
    }

    cachedKey = newKey;
    return cachedKey;
  } catch (err) {
    if (!encryptionFailedWarned) {
      console.warn(
        'Inkwell: Could not load/create the encryption key; keystrokes will be stored UNENCRYPTED this session.',
        err
      );
      encryptionFailedWarned = true;
    }
    return null;
  }
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Output is standard Base64: nonce (12 bytes) || ciphertext || authTag (16 bytes).
 * If encryption key is not available, returns plaintext gracefully.
 */
export function encrypt(plain: string): string {
  const key = loadOrCreateKey();
  if (!key) return plain;

  try {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const blob = Buffer.concat([nonce, encrypted, authTag]);
    return blob.toString('base64');
  } catch (err) {
    return plain;
  }
}

/**
 * Decrypts a Base64 encrypted string (nonce || ciphertext || authTag) with AES-256-GCM.
 * Falls back to returning input string if it's plaintext or invalid.
 */
export function decrypt(cipherB64: string): string {
  const key = loadOrCreateKey();
  if (!key || !cipherB64) return cipherB64;

  try {
    const blob = Buffer.from(cipherB64, 'base64');
    // Minimum length = 12 (nonce) + 16 (authTag) = 28 bytes
    if (blob.length < 28) {
      return cipherB64;
    }

    const nonce = blob.subarray(0, 12);
    const authTag = blob.subarray(blob.length - 16);
    const ciphertext = blob.subarray(12, blob.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Non-ciphertext or altered text returns original string
    return cipherB64;
  }
}
