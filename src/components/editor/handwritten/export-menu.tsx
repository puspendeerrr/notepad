'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Download,
  FileImage,
  FileText,
  Printer,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface ExportMenuProps {
  onExportPng: () => Promise<void>;
  onExportPdf: (mode: 'all' | 'current') => Promise<void>;
  title: string;
}

export function ExportMenu({ onExportPng, onExportPdf }: ExportMenuProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExportPng = async () => {
    try {
      setExporting('png');
      await onExportPng();
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async (mode: 'all' | 'current') => {
    try {
      setExporting(`pdf-${mode}`);
      await onExportPdf(mode);
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-xs">
        <DropdownMenuItem onClick={handleExportPng} className="gap-2">
          <FileImage className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="font-medium">Export Page as PNG</div>
            <div className="text-[10px] text-zinc-400">High-resolution image</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExportPdf('current')} className="gap-2">
          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <div>
            <div className="font-medium">Export Page as PDF</div>
            <div className="text-[10px] text-zinc-400">Print-friendly single page</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExportPdf('all')} className="gap-2">
          <Printer className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <div>
            <div className="font-medium">Export Entire Notebook (PDF)</div>
            <div className="text-[10px] text-zinc-400">All notebook pages in order</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
