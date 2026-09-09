import { createAdminClient } from '@/lib/supabase/admin';

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory fallback sliding window rate limiter
const fallbackRateLimitMap = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  limit: number;       // Max allowed requests
  windowMs: number;    // Time window in milliseconds
}

/**
 * Synchronous in-memory rate limiter (fallback)
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 5, windowMs: 10 * 60 * 1000 }
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let record = fallbackRateLimitMap.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    fallbackRateLimitMap.set(identifier, record);
  }

  // Filter timestamps within the current sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= options.limit) {
    const oldestTimestamp = record.timestamps[0];
    const retryAfterMs = oldestTimestamp + options.windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  // Add current timestamp
  record.timestamps.push(now);

  return {
    allowed: true,
    remaining: options.limit - record.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Persistent Supabase-backed rate limiter for Vercel Serverless.
 * Falls back to in-memory rate limiter if Supabase is temporarily unreachable.
 */
export async function checkPersistentRateLimit(
  key: string,
  action: string,
  options: RateLimitOptions = { limit: 5, windowMs: 10 * 60 * 1000 }
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  try {
    const admin = createAdminClient();
    const now = Date.now();
    const windowStartDate = new Date(now - options.windowMs).toISOString();

    // Query count of requests within the sliding window
    const { count, error } = await admin
      .from('rate_limits')
      .select('id', { count: 'exact' })
      .eq('key', key)
      .eq('action', action)
      .gte('created_at', windowStartDate)
      .limit(1);

    if (error || count === null || typeof count !== 'number') {
      return checkRateLimit(`${action}:${key}`, options);
    }

    const currentCount = count;

    if (currentCount >= options.limit) {
      // Find oldest record in window to calculate precise retryAfterSeconds
      const { data: oldestRecords } = await admin
        .from('rate_limits')
        .select('created_at')
        .eq('key', key)
        .eq('action', action)
        .gte('created_at', windowStartDate)
        .order('created_at', { ascending: true })
        .limit(1);

      let retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      if (oldestRecords && oldestRecords.length > 0) {
        const oldestTime = new Date(oldestRecords[0].created_at).getTime();
        const retryAfterMs = oldestTime + options.windowMs - now;
        retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      }

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    // Record this attempt
    const { error: insertError } = await admin.from('rate_limits').insert({
      key,
      action,
    });

    if (insertError) {
      return checkRateLimit(`${action}:${key}`, options);
    }

    // Opportunistic cleanup of stale records (> 2 hours) with 10% sampling probability
    if (Math.random() < 0.1) {
      const staleCutoff = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      Promise.resolve(
        admin.from('rate_limits').delete().lt('created_at', staleCutoff)
      ).catch(() => {});
    }

    return {
      allowed: true,
      remaining: Math.max(0, options.limit - (currentCount + 1)),
      retryAfterSeconds: 0,
    };
  } catch (err) {
    console.warn('Persistent rate limiter exception, falling back to memory:', err);
    return checkRateLimit(`${action}:${key}`, options);
  }
}

/**
 * Helper to extract client IP from Next.js Request headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}
