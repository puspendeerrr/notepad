'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  FileText,
  User,
  Settings,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  username?: string;
  children?: React.ReactNode; // e.g. search input on /notes
}

export function Navbar({ username, children }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm transition-colors">
      <div className="flex h-12 w-full items-center justify-between px-4 sm:px-6 md:px-8">
        {/* Left: Text Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/notes"
            className="flex items-center gap-2 group transition-opacity hover:opacity-85"
          >
            <FileText className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
            <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
              Notepad
            </span>
          </Link>
        </div>

        {/* Center: Search or custom toolbar elements */}
        {children && <div className="flex-1 max-w-xl mx-4 sm:mx-8">{children}</div>}

        {/* Right: Theme Toggle & Profile Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Visible Light / Dark / System Theme Toggle */}
          <ThemeToggle />

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <User className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate hidden sm:inline-block">
                  {username || 'Account'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs">
              <DropdownMenuLabel className="font-normal text-xs text-zinc-500">
                Logged in as <strong className="text-zinc-900 dark:text-zinc-100">{username || 'User'}</strong>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer gap-2 py-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer gap-2 py-1.5 text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
