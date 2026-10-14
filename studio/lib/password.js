// Password hashing with scrypt (built into Node, no extra dependency).
// Shared by the app and by scripts/create-owner.mjs.
import crypto from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Used so a login for an unknown email takes about as long as a real one.
export const DUMMY_HASH = hashPassword('not-a-real-password-for-timing');

export function checkPasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 10) return 'Use at least 10 characters.';
  if (password.length > 200) return 'That password is too long.';
  return null;
}

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}
