'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RecoveryKeyModal } from '@/components/auth/recovery-key-modal';
import { FileText, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recovery Key Modal State
  const [createdRecoveryKey, setCreatedRecoveryKey] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string>('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase();

    if (cleanUser.length < 3 || cleanUser.length > 32) {
      setError('User ID must be between 3 and 32 characters.');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUser)) {
      setError('User ID can only contain lowercase letters, numbers, and underscores.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account.');
        setLoading(false);
        return;
      }

      // Successful signup: reveal recovery key modal
      setCreatedUsername(cleanUser);
      setCreatedRecoveryKey(data.recoveryKey);
      setLoading(false);
    } catch {
      setError('Connection failed. Please check your network and try again.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-800 dark:text-zinc-200" />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Notepad
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Create your account. No email, phone number, or verification required.
          </p>
        </div>

        {/* Signup Form */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 shadow-none">
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                User ID
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                placeholder="letters, numbers, underscore"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                disabled={loading}
                required
              />
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                3–32 characters (lowercase a–z, 0–9, _)
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full text-xs font-medium h-9"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>

      {/* Single-view Recovery Key Modal */}
      {createdRecoveryKey && (
        <RecoveryKeyModal
          isOpen={true}
          recoveryKey={createdRecoveryKey}
          username={createdUsername}
        />
      )}
    </main>
  );
}
