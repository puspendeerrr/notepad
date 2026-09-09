import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  generateRecoveryKey,
  hashRecoveryKey,
  validateUsername,
  usernameToInternalEmail,
} from '@/lib/security/recovery-key';
import { checkPersistentRateLimit, getClientIp } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkPersistentRateLimit(ip, 'signup', { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many signup attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { username, password, confirmPassword } = body;

    const validation = validateUsername(username);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check if username already exists in user_accounts
    const { data: existingAccount } = await adminClient
      .from('user_accounts')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingAccount) {
      return NextResponse.json(
        { error: 'This User ID is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    const internalEmail = usernameToInternalEmail(cleanUsername);

    // Create Supabase Auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Failed to create account.' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // Generate cryptographic recovery key and its HMAC-SHA-256 hash
    const recoveryKey = generateRecoveryKey();
    const recoveryKeyHash = hashRecoveryKey(recoveryKey);

    // Insert user_accounts record
    const { error: accountError } = await adminClient.from('user_accounts').insert({
      id: userId,
      username: cleanUsername,
      recovery_key_hash: recoveryKeyHash,
    });

    if (accountError) {
      console.error('Error creating user_account record:', accountError);
      // Rollback auth user
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'Failed to complete registration. Please try again.' },
        { status: 500 }
      );
    }

    // Insert default user_settings
    await adminClient.from('user_settings').insert({
      user_id: userId,
      theme: 'system',
      font_size: 16,
      font_family: 'sans',
      word_wrap: true,
      line_numbers: false,
    });

    // Sign the user in on the server to establish session cookies
    const serverClient = await createClient();
    const { error: signInError } = await serverClient.auth.signInWithPassword({
      email: internalEmail,
      password: password,
    });

    if (signInError) {
      console.warn('Sign-in after signup warning:', signInError);
    }

    return NextResponse.json({
      success: true,
      username: cleanUsername,
      recoveryKey,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during signup.' },
      { status: 500 }
    );
  }
}
