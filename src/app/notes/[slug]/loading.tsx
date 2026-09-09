import React from 'react';

export default function NoteLoading() {
  return (
    <div className="flex h-screen w-full flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden animate-pulse">
      {/* Top Header Skeleton */}
      <header className="flex h-11 w-full items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 px-3 sm:px-4 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="h-8 w-8 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-8 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </header>

      {/* Formatting Toolbar Skeleton */}
      <div className="flex h-10 w-full items-center border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/90 dark:bg-zinc-900/90 px-3 gap-2 shrink-0">
        <div className="h-6 w-14 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-6 w-16 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />
        <div className="h-6 w-6 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-6 w-6 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-6 w-6 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1" />
        <div className="h-6 w-20 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
      </div>

      {/* Writing Area Skeleton */}
      <main className="flex-1 p-6 sm:p-8 space-y-4 max-w-4xl w-full mx-auto">
        <div className="h-6 w-3/4 rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
        <div className="h-4 w-full rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
        <div className="h-4 w-5/6 rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
        <div className="h-4 w-2/3 rounded bg-zinc-200/40 dark:bg-zinc-800/40" />
      </main>

      {/* Status Bar Skeleton */}
      <footer className="flex h-7 w-full items-center justify-between border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-950/50 px-4 sm:px-6">
        <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
      </footer>
    </div>
  );
}
