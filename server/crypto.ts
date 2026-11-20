import crypto from 'node:crypto';

const rawSessionSecret = process.env.SESSION_SECRET?.trim();
const SESSION_KEY: Buffer = rawSessionSecret
  ? crypto.createHash('sha256').update(rawSessionSecret).digest()
  : crypto.randomBytes(32);

const rawEncryptionSecret = process.env.ENCRYPTION_SECRET?.trim();
export const IS_EPHEMERAL_ENCRYPTION_KEY = !rawEncryptionSecret;

const ENCRYPTION_KEY: Buffer = rawEncryptionSecret
  ? crypto.scryptSync(rawEncryptionSecret, 'aegismed-aes256-gcm-v1', 32)
  : crypto.randomBytes(32);

const PSEUDONYM_KEY: Buffer = crypto
  .createHmac('sha256', ENCRYPTION_KEY)
  .update('aegismed-pseudonym-domain-v1')
  .digest();

const INTEGRITY_KEY: Buffer = crypto
  .createHmac('sha256', ENCRYPTION_KEY)
  .update('aegismed-integrity-hmac-v1')
  .digest();

export const KEY_FINGERPRINT = crypto
  .createHash('sha256')
  .update(ENCRYPTION_KEY)
  .digest('hex')
  .slice(0, 16);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

export function hashEmailLookup(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHmac('sha256', PSEUDONYM_KEY).update(`email:${normalized}`).digest('hex');
}

export function derivePseudonymId(seed: string): string {
  const digest = crypto
    .createHmac('sha256', PSEUDONYM_KEY)
    .update(`node:${seed.trim().toLowerCase()}`)
    .digest('hex');
  return `node-${digest.slice(0, 12)}`;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptJson(payload: unknown): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptJson<T>(ciphertext: string, ivBase64: string, authTagBase64: string): T {
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

export function signHmacHex(data: string): string {
  return crypto.createHmac('sha256', INTEGRITY_KEY).update(data, 'utf8').digest('hex');
}

export function verifyHmacHex(data: string, signatureHex: string): boolean {
  const expected = signHmacHex(data);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signatureHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface SessionTokenPayload {
  sub: string;
  sid: string;
  pseudonymId: string;
  role: 'clinician' | 'coordinator' | 'auditor';
  exp: number;
}

export function signSessionToken(payload: SessionTokenPayload): string {
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'AEGIS' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const sigB64 = crypto.createHmac('sha256', SESSION_KEY).update(signingInput).digest('base64url');
  return `${signingInput}.${sigB64}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', SESSION_KEY).update(signingInput).digest('base64url');
  const a = Buffer.from(sigB64, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!parsed.sub || !parsed.sid || !parsed.pseudonymId || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
