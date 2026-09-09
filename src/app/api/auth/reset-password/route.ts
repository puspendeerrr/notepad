import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyRecoveryKey } from '@/lib/security/recovery-key';
import { checkPersistentRateLimit, getClientIp } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const body = await request.json();
    const { username, recoveryKey, newPassword, confirmNewPassword } = body;

    const cleanUsername = (username || '').trim().toLowerCase();

    // Strict persistent rate limiting on password reset attempts
    const rateLimit = await checkPersistentRateLimit(`${ip}:${cleanUsername}`, 'reset-password', {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many password reset attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    if (!cleanUsername || !recoveryKey || !newPassword) {
      return NextResponse.json(
        { error: 'The details entered are incorrect.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmNewPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Query user_accounts for username
    const { data: account, error: accountError } = await adminClient
      .from('user_accounts')
      .select('id, recovery_key_hash')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (accountError || !account) {
      // Use generic error to prevent account enumeration
      return NextResponse.json(
        { error: 'The details entered are incorrect.' },
        { status: 400 }
      );
    }

    // Verify recovery key
    const isValidKey = verifyRecoveryKey(recoveryKey, account.recovery_key_hash);
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'The details entered are incorrect.' },
        { status: 400 }
      );
    }

    // Update password using Supabase Auth Admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      account.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password reset update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset password. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'The details entered are incorrect.' },
      { status: 500 }
    );
  }
}
