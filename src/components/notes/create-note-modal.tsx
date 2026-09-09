'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FileText, PenTool, Keyboard, Tablet, Sparkles, ArrowRight } from 'lucide-react';
import { NoteType } from '@/types';

interface CreateNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: NoteType) => void;
  loading?: boolean;
}

export function CreateNoteModal({
  open,
  onOpenChange,
  onSelectType,
  loading = false,
}: CreateNoteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Create New Note
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Choose how you want to capture your thoughts today.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1: Text Note */}
          <button
            type="button"
            disabled={loading}
            onClick={() => onSelectType('text')}
            className="group relative flex flex-col items-start p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200 group-hover:scale-105 transition-transform">
                <FileText className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800/90 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                <Keyboard className="h-3 w-3" />
                Laptop
              </span>
            </div>

            <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Text Note
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-zinc-500" />
            </h3>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
              Rich-text document editor with auto-formatting, Word-style lists, tables, and full keyboard shortcuts.
            </p>

            <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 w-full text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Best for keyboard & typing
            </div>
          </button>

          {/* Option 2: Handwritten Note */}
          <button
            type="button"
            disabled={loading}
            onClick={() => onSelectType('handwritten')}
            className="group relative flex flex-col items-start p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <PenTool className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                <Tablet className="h-3 w-3" />
                iPad & Pencil
              </span>
            </div>

            <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Handwritten Note
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-zinc-500" />
            </h3>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
              GoodNotes-style canvas with Apple Pencil pressure sensitivity, floating tool dock, and multi-page paper templates.
            </p>

            <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 w-full text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Best for Apple Pencil & stylus
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
