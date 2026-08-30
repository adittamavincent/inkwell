import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/main/db/crypto';

describe('AES-256-GCM crypto', () => {
  it('encrypts and decrypts text accurately', () => {
    const original = 'super secret password 123!@#';
    const ciphertext = encrypt(original);

    expect(ciphertext).not.toBe(original);
    expect(typeof ciphertext).toBe('string');

    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(original);
  });

  it('handles multi-byte unicode characters properly', () => {
    const original = 'Hello 🚀 ⌘⌥⌫ 日本語';
    const ciphertext = encrypt(original);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(original);
  });

  it('gracefully returns raw string if not ciphertext or corrupted', () => {
    const plain = 'regular unencrypted string';
    expect(decrypt(plain)).toBe(plain);
  });
});
