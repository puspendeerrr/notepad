'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Scissors,
  Hand,
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  MoveRight,
  Undo2,
  Redo2,
  Trash2,
  Fingerprint,
  Check,
} from 'lucide-react';
import { DrawingTool, ShapeType, EraserMode } from '@/types';
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

interface FloatingToolbarProps {
  currentTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  currentColor: string;
  onChangeColor: (color: string) => void;
  strokeWidth: number;
  onChangeStrokeWidth: (width: number) => void;
  eraserMode: EraserMode;
  onChangeEraserMode: (mode: EraserMode) => void;
  currentShape: ShapeType;
  onSelectShape: (shape: ShapeType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
  onInsertImage: (file: File) => void;
  allowFingerDrawing: boolean;
  onToggleFingerDrawing: (allow: boolean) => void;
}

export const PRESET_COLORS = [
  '#ffffff', // Clean White
  '#09090b', // Deep Black
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#94a3b8', // Gray
  '#facc15', // Gold
];

export const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
  { label: 'Heavy', value: 14 },
];

export function FloatingToolbar({
  currentTool,
  onSelectTool,
  currentColor,
  onChangeColor,
  strokeWidth,
  onChangeStrokeWidth,
  eraserMode,
  onChangeEraserMode,
  currentShape,
  onSelectShape,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearPage,
  onInsertImage,
  allowFingerDrawing,
  onToggleFingerDrawing,
}: FloatingToolbarProps) {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onInsertImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="fixed left-3 top-20 sm:left-6 z-40 flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 shadow-xl transition-all select-none">
        {/* Pen Tool */}
        <button
          type="button"
          title="Pen (Solid handwriting)"
          onClick={() => onSelectTool('pen')}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
            currentTool === 'pen'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Pen className="h-4 w-4" />
        </button>

        {/* Pencil Tool */}
        <button
          type="button"
          title="Pencil (Graphite texture)"
          onClick={() => onSelectTool('pencil')}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
            currentTool === 'pencil'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Pencil className="h-4 w-4" />
        </button>

        {/* Highlighter Tool */}
        <button
          type="button"
          title="Highlighter (Translucent overlay)"
          onClick={() => onSelectTool('highlighter')}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
            currentTool === 'highlighter'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Highlighter className="h-4 w-4" />
        </button>

        {/* Eraser Tool with Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={`Eraser (${eraserMode === 'stroke' ? 'Stroke' : 'Partial'})`}
              onClick={() => onSelectTool('eraser')}
              className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all relative ${
                currentTool === 'eraser'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Eraser className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-44 text-xs">
            <DropdownMenuLabel>Eraser Mode</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                onSelectTool('eraser');
                onChangeEraserMode('stroke');
              }}
              className="gap-2"
            >
              <span className={`h-2 w-2 rounded-full ${eraserMode === 'stroke' ? 'bg-rose-500' : 'bg-transparent'}`} />
              Whole Stroke Eraser
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onSelectTool('eraser');
                onChangeEraserMode('partial');
              }}
              className="gap-2"
            >
              <span className={`h-2 w-2 rounded-full ${eraserMode === 'partial' ? 'bg-rose-500' : 'bg-transparent'}`} />
              Partial / Freehand Eraser
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Lasso / Select Tool */}
        <button
          type="button"
          title="Lasso Selection"
          onClick={() => onSelectTool('lasso')}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
            currentTool === 'lasso'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Scissors className="h-4 w-4" />
        </button>

        {/* Shapes Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Geometric Shapes"
              onClick={() => onSelectTool('shape')}
              className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                currentTool === 'shape'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {currentShape === 'rectangle' && <Square className="h-4 w-4" />}
              {currentShape === 'circle' && <Circle className="h-4 w-4" />}
              {currentShape === 'line' && <Minus className="h-4 w-4" />}
              {currentShape === 'arrow' && <MoveRight className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-36 text-xs">
            <DropdownMenuLabel>Shapes</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                onSelectTool('shape');
                onSelectShape('rectangle');
              }}
              className="gap-2"
            >
              <Square className="h-3.5 w-3.5" /> Rectangle
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onSelectTool('shape');
                onSelectShape('circle');
              }}
              className="gap-2"
            >
              <Circle className="h-3.5 w-3.5" /> Circle
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onSelectTool('shape');
                onSelectShape('line');
              }}
              className="gap-2"
            >
              <Minus className="h-3.5 w-3.5" /> Line
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onSelectTool('shape');
                onSelectShape('arrow');
              }}
              className="gap-2"
            >
              <MoveRight className="h-3.5 w-3.5" /> Arrow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Text Box Tool */}
        <button
          type="button"
          title="Text Box"
          onClick={() => onSelectTool('text')}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
            currentTool === 'text'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Type className="h-4 w-4" />
        </button>

        {/* Insert Image */}
        <button
          type="button"
          title="Insert Image"
          onClick={() => fileInputRef.current?.click()}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
        >
          <ImageIcon className="h-4 w-4" />
        </button>

        {/* Hand / Pan Tool */}
        <button
          type="button"
          title="Hand / Pan tool"
          onClick={() => onSelectTool('hand')}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
            currentTool === 'hand'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Hand className="h-4 w-4" />
        </button>

        <div className="h-px w-6 bg-zinc-200 dark:bg-zinc-800 my-1" />

        {/* Color Palette Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Color Picker"
              className="h-9 w-9 rounded-xl flex items-center justify-center relative hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            >
              <div
                className="h-5 w-5 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm"
                style={{ backgroundColor: currentColor }}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="p-3 w-52 text-xs">
            <DropdownMenuLabel className="px-1 text-[11px] font-medium text-zinc-400">
              Preset Colors
            </DropdownMenuLabel>
            <div className="grid grid-cols-4 gap-2.5 my-2">
              {PRESET_COLORS.map((c) => {
                const isSelected = currentColor.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChangeColor(c);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChangeColor(c);
                    }}
                    title={c}
                    className={`h-7 w-7 rounded-full border border-zinc-300 dark:border-zinc-700 transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 ring-offset-2 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {isSelected && (
                      <Check
                        className={`h-3.5 w-3.5 stroke-[2.5] ${
                          c === '#ffffff' || c === '#eab308' || c === '#facc15'
                            ? 'text-black'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between pt-1.5 px-1">
              <span className="text-[11px] text-zinc-500">Custom Color:</span>
              <input
                type="color"
                value={currentColor}
                onChange={(e) => onChangeColor(e.target.value)}
                className="h-7 w-10 rounded cursor-pointer border border-zinc-300 dark:border-zinc-700 bg-transparent p-0.5"
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Stroke Width Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Stroke Width"
              className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-all"
            >
              <div
                className="rounded-full bg-current"
                style={{ width: Math.max(3, Math.min(14, strokeWidth)), height: Math.max(3, Math.min(14, strokeWidth)) }}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-40 text-xs">
            <DropdownMenuLabel>Stroke Size</DropdownMenuLabel>
            {STROKE_WIDTHS.map((sw) => (
              <DropdownMenuItem
                key={sw.value}
                onClick={() => onChangeStrokeWidth(sw.value)}
                className="flex items-center justify-between"
              >
                <span>{sw.label}</span>
                <div
                  className="rounded-full bg-zinc-900 dark:bg-zinc-100"
                  style={{ width: sw.value, height: sw.value }}
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-px w-6 bg-zinc-200 dark:bg-zinc-800 my-1" />

        {/* Undo */}
        <button
          type="button"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <Undo2 className="h-4 w-4" />
        </button>

        {/* Redo */}
        <button
          type="button"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        {/* Clear Page */}
        <button
          type="button"
          title="Clear Current Page"
          onClick={() => setClearDialogOpen(true)}
          className="h-9 w-9 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="h-px w-6 bg-zinc-200 dark:bg-zinc-800 my-1" />

        {/* Toggle Finger Drawing (Setting: allow finger drawing on/off) */}
        <button
          type="button"
          title={allowFingerDrawing ? 'Finger Drawing: Enabled (Tap for Pencil Only)' : 'Finger Drawing: Pencil Only (Tap to enable finger)'}
          onClick={() => onToggleFingerDrawing(!allowFingerDrawing)}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
            allowFingerDrawing
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
              : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Fingerprint className="h-4 w-4" />
        </button>
      </div>

      {/* Clear Page Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-red-600 dark:text-red-400">
              Clear Current Page?
            </DialogTitle>
            <DialogDescription className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">
              This will erase all handwriting, shapes, and text on this page. You can still undo immediately after.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="outline" size="sm" onClick={() => setClearDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setClearDialogOpen(false);
                onClearPage();
              }}
              className="text-xs"
            >
              Clear Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
