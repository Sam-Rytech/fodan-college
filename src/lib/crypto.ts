import 'server-only';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { env } from './env';

/**
 * Low-level cryptographic helpers.
 *
 * Rules enforced here:
 *  - Bearer-style secrets (session tokens, activation codes, reset tokens) are
 *    high-entropy random values, so a fast keyed hash is the right primitive.
 *    They are stored as HMAC-SHA256 under AUTH_SECRET, which means a leaked
 *    database alone cannot be used to forge or brute-force them.
 *  - User-chosen passwords are NOT handled here — they go through bcrypt in
 *    password.ts, because they are low-entropy and need a slow KDF.
 */

/** Cryptographically secure random bytes as base64url (no padding). */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

/** Unambiguous alphabet: no 0/O, 1/I/L, 5/S, 2/Z. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXY346789';

/**
 * Human-transcribable random string drawn from a cryptographically secure
 * source. Used for activation codes, which get read aloud and typed by children.
 */
export function randomHumanCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/** Numeric one-time code, zero-padded (email/SMS verification). */
export function randomNumericCode(digits = 6): string {
  const max = 10 ** digits;
  return String(randomInt(0, max)).padStart(digits, '0');
}

/**
 * Keyed hash for high-entropy secrets. Returns lowercase hex.
 * `purpose` domain-separates the key so a session token hash can never collide
 * with, or be replayed as, an access-code hash.
 */
export function hmacToken(value: string, purpose: TokenPurpose): string {
  return createHmac('sha256', deriveKey(purpose, env.authSecret))
    .update(value)
    .digest('hex');
}

export type TokenPurpose =
  | 'session'
  | 'access-code'
  | 'password-reset'
  | 'verification'
  | 'csrf';

function deriveKey(purpose: TokenPurpose, secret: string): Buffer {
  return createHmac('sha256', secret).update(`fodan:${purpose}`).digest();
}

/**
 * Candidate hashes for a token, newest key first. Supports secret rotation:
 * set AUTH_SECRET_PREVIOUS during a rollout so tokens issued under the old key
 * keep validating until they expire.
 */
export function hmacTokenCandidates(value: string, purpose: TokenPurpose): string[] {
  const hashes = [hmacToken(value, purpose)];
  if (env.authSecretPrevious) {
    hashes.push(
      createHmac('sha256', deriveKey(purpose, env.authSecretPrevious))
        .update(value)
        .digest('hex'),
    );
  }
  return hashes;
}

/** Unkeyed SHA-256, hex. For non-secret integrity values such as file checksums. */
export function sha256Hex(value: string | Buffer | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time string comparison that does not leak length via early return. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still perform a comparison so the timing profile stays flat.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Fisher–Yates shuffle using a cryptographically secure source.
 * Used for question/option ordering so the sequence cannot be predicted from a
 * seed and replayed to line up an answer key.
 */
export function secureShuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}
