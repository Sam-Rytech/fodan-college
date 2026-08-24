import 'server-only';
import bcrypt from 'bcryptjs';
import { env } from './env';
import { MAX_PASSWORD_BYTES } from './password-policy';

/**
 * Password hashing.
 *
 * WHY BCRYPT, AND WHY NO PLAINTEXT VISIBILITY
 * -------------------------------------------
 * The original brief asked for the Super Admin to be able to *see* another
 * administrator's password. That is deliberately not implemented: it would
 * require storing plaintext or reversible ciphertext, which turns a single
 * database leak into a total compromise of every account — including accounts
 * whose owners re-use that password elsewhere.
 *
 * The underlying need is met safely instead. A Super Admin can *reset* any
 * account's password, the reset is written to the audit log, every session of
 * the affected account is revoked, and the account must choose a new password
 * at next login. See docs/SECURITY.md for the full rationale.
 *
 * bcrypt rather than Argon2id because bcryptjs is pure JavaScript with no
 * native build step, which keeps deploys portable across Windows, Linux and
 * serverless runtimes. Argon2id is the stronger primitive where a native module
 * is acceptable; swapping it in touches only this file.
 */

export { MAX_PASSWORD_BYTES } from './password-policy';
export {
  PASSWORD_MIN_LENGTH,
  checkPasswordPolicy,
  scorePassword,
  type PasswordPolicyResult,
} from './password-policy';

export async function hashPassword(plain: string): Promise<string> {
  if (Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_BYTES} bytes long.`);
  }
  return bcrypt.hash(plain, env.bcryptRounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * A hash of a fixed nonsense value, compared against when the supplied
 * identifier matches no account. Without it, "no such user" answers measurably
 * faster than "wrong password" and the login form becomes a user-enumeration
 * oracle. Cost 10 keeps the dummy comparison cheap while staying in the same
 * order of magnitude as a real one.
 */
const DUMMY_HASH = bcrypt.hashSync('fodan-college-nonexistent-account', 10);

export async function burnPasswordComparison(plain: string): Promise<void> {
  try {
    await bcrypt.compare(plain.slice(0, MAX_PASSWORD_BYTES), DUMMY_HASH);
  } catch {
    /* deliberately ignored — this call exists only for its timing cost */
  }
}
