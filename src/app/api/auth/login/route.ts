import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { usernameToInternalEmail } from '@/lib/security/recovery-key';
import { checkPersistentRateLimit, getClientIp } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const body = await request.json();
    const { username, password } = body;

    const cleanUsername = (username || '').trim().toLowerCase();

    // Persistent rate limit per IP and username combo (serverless-safe)
    const rateLimit = await checkPersistentRateLimit(`${ip}:${cleanUsername}`, 'login', {
      limit: 7,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    if (!cleanUsername || !password) {
      return NextResponse.json(
        { error: 'The details entered are incorrect.' },
        { status: 400 }
      );
    }

    const internalEmail = usernameToInternalEmail(cleanUsername);
    const serverClient = await createClient();

    const { data, error } = await serverClient.auth.signInWithPassword({
      email: internalEmail,
      password: password,
    });

    if (error || !data.user) {
      // Use generic error message to avoid User ID enumeration
      return NextResponse.json(
        { error: 'The details entered are incorrect.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      username: cleanUsername,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'The details entered are incorrect.' },
      { status: 500 }
    );
  }
}
