/**
 * Password strength rules.
 *
 * Deliberately separated from password.ts (which is server-only, because it
 * imports bcrypt): the registration and change-password forms give live
 * feedback in the browser, and both sides must apply exactly the same rules.
 * The browser copy is a courtesy — the server re-runs `checkPasswordPolicy`
 * before hashing, and that call is the one that decides.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt silently truncates beyond 72 bytes, so we reject rather than truncate. */
export const MAX_PASSWORD_BYTES = 72;

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwertyuiop',
  'iloveyou',
  'letmein',
  'welcome1',
  'admin123',
  'student1',
  'fodan123',
  'fodancollege',
]);

export interface PasswordPolicyResult {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  problems: string[];
}

export interface PasswordContext {
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
}

/**
 * Pragmatic on purpose: this platform is used by primary-school children, so the
 * rules reward length and variety rather than demanding unmemorable symbol soup,
 * and every message says plainly what to change.
 */
export function checkPasswordPolicy(
  password: string,
  context: PasswordContext = {},
): PasswordPolicyResult {
  const problems: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (byteLength(password) > MAX_PASSWORD_BYTES) {
    problems.push(`Use at most ${MAX_PASSWORD_BYTES} characters.`);
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    problems.push('Mix capital and small letters.');
  }
  if (!/[0-9]/.test(password)) {
    problems.push('Include at least one number.');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    problems.push('That password is too easy to guess. Choose another one.');
  }
  if (password.length > 0 && /^(.)\1+$/.test(password)) {
    problems.push('Do not repeat a single character.');
  }

  const lowered = password.toLowerCase();
  for (const [field, value] of Object.entries(context)) {
    if (!value) continue;
    const token = String(value).toLowerCase().split(/[\s@.]+/)[0];
    if (token && token.length >= 4 && lowered.includes(token)) {
      problems.push(`Do not put your ${labelFor(field)} inside your password.`);
      break;
    }
  }

  return { ok: problems.length === 0, score: scorePassword(password), problems };
}

/** 0–4 meter for the UI. Never used for enforcement. */
export function scorePassword(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 0;

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export const PASSWORD_SCORE_LABELS: Record<number, string> = {
  0: 'Too weak',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
};

function labelFor(field: string): string {
  switch (field) {
    case 'username':
      return 'username';
    case 'fullName':
      return 'name';
    case 'email':
      return 'email address';
    default:
      return field;
  }
}

/** UTF-8 byte length without depending on Buffer (this module runs in browsers). */
function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}
