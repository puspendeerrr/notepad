import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateRecoveryKey, hashRecoveryKey } from '@/lib/security/recovery-key';
import { checkPersistentRateLimit, getClientIp } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const serverClient = await createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit regeneration attempts
    const rateLimit = await checkPersistentRateLimit(`${ip}:${user.id}`, 'regenerate-recovery-key', {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { currentPassword } = body;

    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Current password is required to generate a new Recovery Key.' },
        { status: 400 }
      );
    }

    // Verify current password by attempting sign in
    const { error: verifyError } = await serverClient.auth.signInWithPassword({
      email: user.email || '',
      password: currentPassword,
    });

    if (verifyError) {
      return NextResponse.json(
        { error: 'Current password is incorrect.' },
        { status: 400 }
      );
    }

    // Generate new recovery key
    const newRecoveryKey = generateRecoveryKey();
    const newHash = hashRecoveryKey(newRecoveryKey);

    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from('user_accounts')
      .update({ recovery_key_hash: newHash })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update recovery key:', updateError);
      return NextResponse.json(
        { error: 'Failed to update Recovery Key. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recoveryKey: newRecoveryKey,
    });
  } catch (error) {
    console.error('Regenerate key error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
