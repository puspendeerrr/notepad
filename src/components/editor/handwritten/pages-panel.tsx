'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  NotebookPage,
  PaperTemplate,
} from '@/types';
import {
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Layers,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PAPER_COLORS } from './paper-background';

interface PagesPanelProps {
  pages: NotebookPage[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onAddPage: (template?: PaperTemplate) => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onChangeTemplate: (template: PaperTemplate) => void;
  onChangePaperColor: (color: string) => void;
}

const TEMPLATES: { id: PaperTemplate; label: string; desc: string }[] = [
  { id: 'ruled', label: 'Ruled / Lined', desc: 'Standard notebook lines' },
  { id: 'grid', label: 'Grid / Graph', desc: 'Math & diagrams' },
  { id: 'dotgrid', label: 'Dot Grid', desc: 'Bullet journal style' },
  { id: 'blank', label: 'Blank', desc: 'Clean white canvas' },
];

export function PagesPanel({
  pages,
  currentPageIndex,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  onChangeTemplate,
  onChangePaperColor,
}: PagesPanelProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<number | null>(null);

  const currentPage = pages[currentPageIndex] || pages[0];

  const handleConfirmDelete = () => {
    if (pageToDelete !== null && pages.length > 1) {
      onDeletePage(pageToDelete);
      setPageToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 shadow-sm text-xs select-none">
        {/* Previous Page Button */}
        <button
          type="button"
          disabled={currentPageIndex === 0}
          onClick={() => onSelectPage(currentPageIndex - 1)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
          title="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page Selector & Thumbnails Popover */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="px-2 h-7 rounded-lg flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <span>Page {currentPageIndex + 1} of {pages.length}</span>
              <Layers className="h-3 w-3 text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-64 p-2 text-xs">
            <div className="flex items-center justify-between px-2 py-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
              <span>Notebook Pages</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddPage()}
                className="h-6 text-[11px] px-2 gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
              >
                <Plus className="h-3 w-3" /> Add Page
              </Button>
            </div>
            <DropdownMenuSeparator />

            {/* Page List */}
            <div className="max-h-60 overflow-y-auto space-y-1 py-1">
              {pages.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    currentPageIndex === idx
                      ? 'bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-100'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400'
                  }`}
                  onClick={() => onSelectPage(idx)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center text-[11px] text-zinc-400">{idx + 1}</span>
                    <span className="capitalize">{p.template} page</span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* Move Up */}
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => onMovePage(idx, idx - 1)}
                        className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                    )}
                    {/* Move Down */}
                    {idx < pages.length - 1 && (
                      <button
                        type="button"
                        onClick={() => onMovePage(idx, idx + 1)}
                        className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    )}
                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={() => onDuplicatePage(idx)}
                      className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                      title="Duplicate Page"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {/* Delete */}
                    {pages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPageToDelete(idx);
                          setDeleteDialogOpen(true);
                        }}
                        className="p-1 text-red-500 hover:text-red-700"
                        title="Delete Page"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <DropdownMenuSeparator />

            {/* Template Selector */}
            <DropdownMenuLabel className="text-[11px] text-zinc-400 pt-1">
              Current Page Template
            </DropdownMenuLabel>
            {TEMPLATES.map((tmpl) => (
              <DropdownMenuItem
                key={tmpl.id}
                onClick={() => onChangeTemplate(tmpl.id)}
                className="flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-medium">{tmpl.label}</div>
                  <div className="text-[10px] text-zinc-400">{tmpl.desc}</div>
                </div>
                {currentPage?.template === tmpl.id && (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Paper Color Selector */}
            <DropdownMenuLabel className="text-[11px] text-zinc-400 pt-1">
              Paper Shade
            </DropdownMenuLabel>
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              {PAPER_COLORS.map((pc) => (
                <button
                  key={pc.value}
                  type="button"
                  title={pc.label}
                  onClick={() => onChangePaperColor(pc.value)}
                  className={`h-6 w-6 rounded-full border border-zinc-200 dark:border-zinc-700 transition-transform ${
                    currentPage?.paperColor === pc.value ? 'scale-115 ring-2 ring-emerald-500' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: pc.value }}
                />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Next Page Button */}
        <button
          type="button"
          disabled={currentPageIndex >= pages.length - 1}
          onClick={() => onSelectPage(currentPageIndex + 1)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
          title="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Quick Add Page */}
        <button
          type="button"
          onClick={() => onAddPage()}
          className="h-7 px-2 rounded-lg flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium transition-all"
          title="Add New Page"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Page</span>
        </button>
      </div>

      {/* Delete Page Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-red-600 dark:text-red-400">
              Delete Page {pageToDelete !== null ? pageToDelete + 1 : ''}?
            </DialogTitle>
            <DialogDescription className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">
              This will permanently delete this page and all handwriting on it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              className="text-xs"
            >
              Delete Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
