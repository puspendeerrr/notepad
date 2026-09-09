'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Copy, Download, ShieldAlert } from 'lucide-react';

interface RecoveryKeyModalProps {
  isOpen: boolean;
  recoveryKey: string;
  username: string;
  onClose?: () => void;
}

export function RecoveryKeyModal({
  isOpen,
  recoveryKey,
  username,
  onClose,
}: RecoveryKeyModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const router = useRouter();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback copy
      const textArea = document.createElement('textarea');
      textArea.value = recoveryKey;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const textContent = [
      '======================================================',
      ' NOTEPAD RECOVERY KEY (notepad.puspender.in)',
      '======================================================',
      '',
      `User ID:      ${username}`,
      `Recovery Key: ${recoveryKey}`,
      `Generated:    ${new Date().toISOString()}`,
      '',
      'IMPORTANT:',
      '- Keep this file safe and private.',
      '- This key is the ONLY way to reset your password if forgotten.',
      '- We never ask for your email and cannot recover your account without this key.',
      '======================================================',
    ].join('\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notepad-recovery-key-${username}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleContinue = () => {
    if (onClose) {
      onClose();
    } else {
      router.push('/notes');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md border-zinc-200 dark:border-zinc-800 p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
            <DialogTitle className="text-base font-semibold">
              Save Your Recovery Key
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-600 dark:text-zinc-400">
            This key is shown <strong>exactly once</strong>. Save this Recovery Key safely.
            It is strictly required if you forget your password.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-3">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 text-center">
            <p className="font-mono text-base tracking-wider font-semibold select-all text-zinc-900 dark:text-zinc-100">
              {recoveryKey}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  Copied to clipboard
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Key
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5" />
              Download as .txt
            </Button>
          </div>

          <label className="flex items-start gap-2.5 pt-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmedSaved}
              onChange={(e) => setConfirmedSaved(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0"
            />
            <span>
              I have safely copied or downloaded my Recovery Key. I understand that without it,
              I will never be able to regain access if I forget my password.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="w-full text-xs font-medium"
            disabled={!confirmedSaved}
            onClick={handleContinue}
          >
            Continue to Notepad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
