import crypto from 'crypto';

const OPAQUE_TOKEN_SECRET = process.env.OPAQUE_TOKEN_SECRET || 'win-telecom-secret-opaque-key-2026-secure';
const OPAQUE_TOKEN_SECRET_PREVIOUS = process.env.OPAQUE_TOKEN_SECRET_PREVIOUS || '';

export const LINK_EXPIRATION_MS = 72 * 60 * 60 * 1000; // 72 hours

export function isOpaqueTokenExpired(timestamp: number): boolean {
  return !Number.isFinite(timestamp) || Date.now() - timestamp > LINK_EXPIRATION_MS;
}

function deriveAesKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptWithSecret(combined: Buffer, secret: string): { documento: string; timestamp: number } | null {
  try {
    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);

    const key = deriveAesKey(secret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const [d, t] = decrypted.split('|');
    if (!d || !t) return null;

    const timestamp = Number(t);
    if (!Number.isFinite(timestamp)) return null;

    return { documento: d, timestamp };
  } catch {
    return null;
  }
}

/**
 * Generates an authenticated opaque token using AES-256-GCM (base64url).
 */
export function createOpaqueToken(documento: string, secretOverride?: string): string {
  const clean = String(documento || '').trim();
  const iv = crypto.randomBytes(12);
  const key = deriveAesKey(secretOverride || OPAQUE_TOKEN_SECRET);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const payload = `${clean}|${Date.now()}`;
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/**
 * Decrypts and authenticates an opaque token. Supports seamless key rotation via OPAQUE_TOKEN_SECRET_PREVIOUS.
 */
export function decodeOpaqueToken(
  token: string,
  secretsOverride?: string[]
): { documento: string; timestamp: number } | null {
  try {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const combined = Buffer.from(raw, 'base64url');
    if (combined.length < 28) return null; // 12-byte IV + 16-byte GCM tag minimum

    const secrets = secretsOverride || [
      OPAQUE_TOKEN_SECRET,
      ...(OPAQUE_TOKEN_SECRET_PREVIOUS ? [OPAQUE_TOKEN_SECRET_PREVIOUS] : [])
    ];

    for (const secret of secrets) {
      if (!secret) continue;
      const result = decryptWithSecret(combined, secret);
      if (result) return result;
    }
    return null;
  } catch {
    return null;
  }
}
