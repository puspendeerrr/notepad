import crypto from 'crypto';

// Unambiguous character set (excludes 0, O, 1, I, L)
const RECOVERY_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const KEY_SEGMENTS = 6;
const SEGMENT_LENGTH = 4;

/**
 * Generates a cryptographically secure 24-character recovery key
 * formatted in blocks: e.g. "7K9M-4XWP-2TRB-8FJC-3HYD-5VAQ"
 */
export function generateRecoveryKey(): string {
  const totalChars = KEY_SEGMENTS * SEGMENT_LENGTH;
  const randomBytes = crypto.randomBytes(totalChars);
  let keyChars = '';

  for (let i = 0; i < totalChars; i++) {
    const randomIndex = randomBytes[i] % RECOVERY_CHARSET.length;
    keyChars += RECOVERY_CHARSET[randomIndex];
  }

  // Format into hyphen-separated chunks
  const segments: string[] = [];
  for (let i = 0; i < totalChars; i += SEGMENT_LENGTH) {
    segments.push(keyChars.slice(i, i + SEGMENT_LENGTH));
  }

  return segments.join('-');
}

/**
 * Normalizes a recovery key string (strips hyphens and whitespace, upper-cases)
 */
export function normalizeRecoveryKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Calculates an HMAC-SHA-256 hash of the normalized recovery key using RECOVERY_KEY_PEPPER
 */
export function hashRecoveryKey(key: string): string {
  const pepper = process.env.RECOVERY_KEY_PEPPER || 'default_fallback_pepper_replace_in_prod';
  const normalized = normalizeRecoveryKey(key);

  return crypto
    .createHmac('sha256', pepper)
    .update(normalized)
    .digest('hex');
}

/**
 * Securely verifies a provided recovery key against a stored hash using constant-time comparison
 */
export function verifyRecoveryKey(providedKey: string, storedHash: string): boolean {
  if (!providedKey || !storedHash) return false;

  const providedHash = hashRecoveryKey(providedKey);
  const providedBuffer = Buffer.from(providedHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (providedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, storedBuffer);
}

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'notepad',
  'settings',
  'root',
  'api',
  'auth',
  'help',
  'system',
  'null',
  'undefined',
  'login',
  'signup',
  'user',
  'users',
  'internal',
  'account',
  'privacy',
  'terms',
  'about',
  'dashboard',
]);

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'User ID is required' };
  }

  const cleaned = username.trim().toLowerCase();

  if (cleaned.length < 3 || cleaned.length > 32) {
    return { valid: false, error: 'User ID must be between 3 and 32 characters' };
  }

  const validRegex = /^[a-z0-9_]+$/;
  if (!validRegex.test(cleaned)) {
    return { valid: false, error: 'User ID can only contain lowercase letters, numbers, and underscores' };
  }

  if (RESERVED_USERNAMES.has(cleaned)) {
    return { valid: false, error: 'This User ID is reserved and cannot be registered' };
  }

  return { valid: true };
}

export function usernameToInternalEmail(username: string): string {
  return `${username.trim().toLowerCase()}@notepad.internal`;
}
