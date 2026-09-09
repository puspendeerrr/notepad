'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sun, Moon, Laptop, Check } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function ThemeToggle({ className, align = 'end' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    // 1. Instantly update document element class for zero latency theme shifting
    if (typeof window !== 'undefined') {
      const isDark =
        newTheme === 'dark' ||
        (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.documentElement.style.colorScheme = 'light';
      }
    }

    // 2. Persist in next-themes context and localStorage
    setTheme(newTheme);

    // 3. Persist in user settings database asynchronously
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch {
      // Non-blocking background sync
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 text-zinc-500 ${className || ''}`}
        aria-label="Theme toggle loading"
      >
        <Sun className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors ${className || ''}`}
              aria-label="Toggle theme"
            >
              {theme === 'system' ? (
                <Laptop className="h-4 w-4" />
              ) : isDark ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="text-[11px] py-0.5 px-2 select-none z-50">
          <span>Theme ({theme || 'system'})</span>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align={align} className="w-36 text-xs z-50">
        <DropdownMenuItem
          onSelect={() => handleSelectTheme('light')}
          onClick={() => handleSelectTheme('light')}
          className="justify-between cursor-pointer py-1.5"
        >
          <div className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5" />
            <span>Light</span>
          </div>
          {theme === 'light' && <Check className="h-3.5 w-3.5 text-zinc-500" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => handleSelectTheme('dark')}
          onClick={() => handleSelectTheme('dark')}
          className="justify-between cursor-pointer py-1.5"
        >
          <div className="flex items-center gap-2">
            <Moon className="h-3.5 w-3.5" />
            <span>Dark</span>
          </div>
          {theme === 'dark' && <Check className="h-3.5 w-3.5 text-zinc-500" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => handleSelectTheme('system')}
          onClick={() => handleSelectTheme('system')}
          className="justify-between cursor-pointer py-1.5"
        >
          <div className="flex items-center gap-2">
            <Laptop className="h-3.5 w-3.5" />
            <span>System</span>
          </div>
          {theme === 'system' && <Check className="h-3.5 w-3.5 text-zinc-500" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

