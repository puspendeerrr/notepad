'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RecoveryKeyModal } from '@/components/auth/recovery-key-modal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserSettings } from '@/types';
import {
  ArrowLeft,
  KeyRound,
  Lock,
  Sun,
  Moon,
  Laptop,
  Check,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Settings state
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [_savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Regenerate Recovery Key state
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.settings) {
          setSettings(data.settings);
        }
      })
      .catch((err) => console.error('Failed to load settings:', err))
      .finally(() => setLoading(false));
  }, [router]);

  // Update Settings in Database
  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!settings) return;
    const nextSettings = { ...settings, ...updates };
    setSettings(nextSettings);
    setSavingSettings(true);
    setSettingsSaved(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please fill out all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || 'Failed to update password.');
        setPasswordLoading(false);
        return;
      }

      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch {
      setPasswordError('Network error. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Regenerate Recovery Key Handler
  const handleRegenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegenError(null);

    if (!regenPassword) {
      setRegenError('Current password is required.');
      return;
    }

    setRegenLoading(true);

    try {
      const res = await fetch('/api/auth/regenerate-recovery-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: regenPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRegenError(data.error || 'Failed to regenerate recovery key.');
        setRegenLoading(false);
        return;
      }

      // Success: Close password confirmation dialog and reveal key modal
      setRegenModalOpen(false);
      setRegenPassword('');
      setNewRecoveryKey(data.recoveryKey);
    } catch {
      setRegenError('Network error. Please try again.');
    } finally {
      setRegenLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Navbar />

      <main className="flex-1 w-full px-4 sm:px-6 md:px-8 lg:px-10 py-6 min-w-0">
        {/* Header navigation */}
        <div className="flex items-center gap-3 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/notes')}
            className="h-8 w-8 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Settings & Preferences
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Customize your editing experience and manage account security
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 space-y-8">
            {/* Section 1: Appearance & Theme */}
            <section className="pt-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Theme
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Select your preferred visual style
                  </p>
                </div>
                {settingsSaved && (
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    updateSettings({ theme: 'light' });
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-xs font-medium transition-all ${
                    theme === 'light'
                      ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  <span>Light</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    updateSettings({ theme: 'dark' });
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-xs font-medium transition-all ${
                    theme === 'dark'
                      ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  <span>Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme('system');
                    updateSettings({ theme: 'system' });
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-xs font-medium transition-all ${
                    theme === 'system'
                      ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <Laptop className="h-4 w-4" />
                  <span>System</span>
                </button>
              </div>
            </section>

            {/* Section 2: Editor Defaults */}
            <section className="pt-8 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Editor Defaults
              </h2>

              <div className="space-y-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4">
                {/* Font Family */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      Default Font Family
                    </span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Choose between modern sans-serif or clean monospace
                    </p>
                  </div>
                  <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => updateSettings({ font_family: 'sans' })}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        settings?.font_family === 'sans'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                      }`}
                    >
                      Sans-serif
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ font_family: 'mono' })}
                      className={`px-3 py-1 text-xs rounded transition-colors font-mono ${
                        settings?.font_family === 'mono'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                      }`}
                    >
                      Monospace
                    </button>
                  </div>
                </div>

                {/* Font Size */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      Default Font Size
                    </span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Base text size for comfortable reading and writing
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings({
                          font_size: Math.max(12, (settings?.font_size || 16) - 1),
                        })
                      }
                      className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-mono font-medium">
                      {settings?.font_size || 16}px
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings({
                          font_size: Math.min(28, (settings?.font_size || 16) + 1),
                        })
                      }
                      className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Word Wrap */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      Word Wrap
                    </span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Wrap long sentences automatically to fit the screen
                    </p>
                  </div>
                  <Switch
                    checked={settings?.word_wrap ?? true}
                    onCheckedChange={(checked) => updateSettings({ word_wrap: checked })}
                  />
                </div>

                {/* Line Numbers */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div>
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      Show Line Numbers
                    </span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Display line counters in the left gutter
                    </p>
                  </div>
                  <Switch
                    checked={settings?.line_numbers ?? false}
                    onCheckedChange={(checked) => updateSettings({ line_numbers: checked })}
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Security & Password */}
            <section className="pt-8 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Security & Authentication
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Manage your credentials and cryptographic recovery key
                </p>
              </div>

              {/* Change Password Form */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  <Lock className="h-4 w-4" />
                  <span>Change Password</span>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-3">
                  {passwordError && (
                    <div className="rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-600 dark:text-red-400">
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="rounded border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/40 p-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      {passwordSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Current Password
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        New Password
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Confirm New Password
                      </label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={passwordLoading}
                      className="text-xs"
                    >
                      {passwordLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Updating…
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Regenerate Recovery Key */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    <KeyRound className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                    <span>Regenerate Recovery Key</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-md">
                    If you suspect your Recovery Key is compromised or lost, generate a new one.
                    Generating a new key permanently invalidates your previous Recovery Key.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRegenModalOpen(true)}
                  className="text-xs shrink-0"
                >
                  Regenerate Key
                </Button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Regenerate Password Verification Dialog */}
      <Dialog open={regenModalOpen} onOpenChange={setRegenModalOpen}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleRegenerateKey}>
            <DialogHeader>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <DialogTitle className="text-base">Regenerate Recovery Key</DialogTitle>
              </div>
              <DialogDescription className="text-xs mt-1">
                <strong>Warning:</strong> Generating a new key will permanently invalidate your old
                Recovery Key. Enter your current password to proceed.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-2">
              {regenError && (
                <div className="rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-600 dark:text-red-400">
                  {regenError}
                </div>
              )}

              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Current Password
              </label>
              <Input
                type="password"
                placeholder="Enter current password"
                value={regenPassword}
                onChange={(e) => setRegenPassword(e.target.value)}
                className="text-xs"
                autoFocus
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRegenModalOpen(false)}
                disabled={regenLoading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={regenLoading}>
                {regenLoading ? 'Verifying…' : 'Confirm & Generate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Recovery Key Modal (Shown once upon regeneration) */}
      {newRecoveryKey && (
        <RecoveryKeyModal
          isOpen={true}
          recoveryKey={newRecoveryKey}
          username="your account"
          onClose={() => setNewRecoveryKey(null)}
        />
      )}
    </div>
  );
}
