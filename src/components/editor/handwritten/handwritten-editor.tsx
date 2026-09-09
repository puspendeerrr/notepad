'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import {
  Note,
  UserSettings,
  DrawingTool,
  ShapeType,
  EraserMode,
  NotebookPage,
  HandwrittenNoteData,
  PaperTemplate,
  CanvasImage,
  SaveStatus,
} from '@/types';
import { saveOfflineDraft } from '@/lib/storage/offline-drafts';
import { DrawingCanvas, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './drawing-canvas';
import { FloatingToolbar } from './floating-toolbar';
import { PagesPanel } from './pages-panel';
import { ExportMenu } from './export-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Check,
  Loader2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Keyboard,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface HandwrittenEditorProps {
  initialNote: Note;
  userId: string;
  initialSettings?: Partial<UserSettings>;
}

// Initial blank notebook structure
function createInitialNotebook(isDark = false): HandwrittenNoteData {
  return {
    version: 1,
    pages: [
      {
        id: 'page-1',
        template: 'ruled',
        paperColor: isDark ? '#121214' : '#ffffff',
        strokes: [],
        shapes: [],
        textBoxes: [],
        images: [],
      },
    ],
    currentPageIndex: 0,
  };
}

export function HandwrittenEditor({
  initialNote,
  userId,
}: HandwrittenEditorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Parse notebook data from content
  const parseNotebook = (): HandwrittenNoteData => {
    try {
      if (initialNote.content && initialNote.content.trim().startsWith('{')) {
        const parsed = JSON.parse(initialNote.content);
        if (parsed.pages && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return createInitialNotebook();
  };

  const initialData = parseNotebook();

  // Core Editor State
  const [noteTitle, setNoteTitle] = useState(initialNote.title || 'Untitled Note');
  const [pages, setPages] = useState<NotebookPage[]>(initialData.pages);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(
    initialData.currentPageIndex >= 0 && initialData.currentPageIndex < initialData.pages.length
      ? initialData.currentPageIndex
      : 0
  );

  // Undo / Redo History
  const [history, setHistory] = useState<NotebookPage[][]>([initialData.pages]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Active Tool & Properties
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
  const [currentColor, setCurrentColor] = useState<string>(isDark ? '#ffffff' : '#09090b');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [currentShape, setCurrentShape] = useState<ShapeType>('rectangle');
  const [allowFingerDrawing, setAllowFingerDrawing] = useState<boolean>(true);

  // Viewport Transform (Zoom & Pan)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  // Save State
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [convertModalOpen, setConvertModalOpen] = useState<boolean>(false);
  const [converting, setConverting] = useState<boolean>(false);

  // References for autosave debounce
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>(initialNote.content || '');

  // Set default color once on mount based on theme
  const hasInitializedThemeRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedThemeRef.current && resolvedTheme) {
      hasInitializedThemeRef.current = true;
      setCurrentColor(resolvedTheme === 'dark' ? '#ffffff' : '#09090b');
    }
  }, [resolvedTheme]);

  // Push new state to History Stack
  const recordHistory = useCallback((newPages: NotebookPage[]) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(newPages);
      // Limit history to 30 steps
      if (next.length > 30) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  }, [historyIndex]);

  // Update Page Content
  const handleUpdateCurrentPage = useCallback(
    (updatedPage: NotebookPage) => {
      setPages((prevPages) => {
        const next = [...prevPages];
        next[currentPageIndex] = updatedPage;
        recordHistory(next);
        return next;
      });
      setSaveStatus('saving');
    },
    [currentPageIndex, recordHistory]
  );

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setPages(history[targetIndex]);
      setSaveStatus('saving');
    }
  }, [historyIndex, history]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setPages(history[targetIndex]);
      setSaveStatus('saving');
    }
  }, [historyIndex, history]);

  // Page Operations
  const handleAddPage = (template: PaperTemplate = 'ruled') => {
    const newPage: NotebookPage = {
      id: `page-${Date.now()}`,
      template,
      paperColor: isDark ? '#18181b' : '#ffffff',
      strokes: [],
      shapes: [],
      textBoxes: [],
      images: [],
    };
    const next = [...pages, newPage];
    setPages(next);
    setCurrentPageIndex(next.length - 1);
    recordHistory(next);
    setSaveStatus('saving');
  };

  const handleDuplicatePage = (index: number) => {
    const source = pages[index];
    if (!source) return;
    const duplicated: NotebookPage = {
      ...source,
      id: `page-${Date.now()}`,
      strokes: JSON.parse(JSON.stringify(source.strokes)),
      shapes: JSON.parse(JSON.stringify(source.shapes)),
      textBoxes: JSON.parse(JSON.stringify(source.textBoxes)),
      images: JSON.parse(JSON.stringify(source.images)),
    };
    const next = [...pages];
    next.splice(index + 1, 0, duplicated);
    setPages(next);
    setCurrentPageIndex(index + 1);
    recordHistory(next);
    setSaveStatus('saving');
  };

  const handleDeletePage = (index: number) => {
    if (pages.length <= 1) return;
    const next = pages.filter((_, i) => i !== index);
    setPages(next);
    setCurrentPageIndex((prev) => Math.min(prev, next.length - 1));
    recordHistory(next);
    setSaveStatus('saving');
  };

  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    const next = [...pages];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setPages(next);
    setCurrentPageIndex(toIndex);
    recordHistory(next);
    setSaveStatus('saving');
  };

  const handleChangeTemplate = (template: PaperTemplate) => {
    const next = [...pages];
    next[currentPageIndex] = { ...next[currentPageIndex], template };
    setPages(next);
    recordHistory(next);
    setSaveStatus('saving');
  };

  const handleChangePaperColor = (paperColor: string) => {
    const next = [...pages];
    next[currentPageIndex] = { ...next[currentPageIndex], paperColor };
    setPages(next);
    recordHistory(next);
    setSaveStatus('saving');
  };

  const handleClearCurrentPage = () => {
    const next = [...pages];
    next[currentPageIndex] = {
      ...next[currentPageIndex],
      strokes: [],
      shapes: [],
      textBoxes: [],
    };
    setPages(next);
    recordHistory(next);
    setSaveStatus('saving');
  };

  const handleInsertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return;

      const img = new Image();
      img.onload = () => {
        const maxWidth = 400;
        const width = Math.min(maxWidth, img.width);
        const height = (width / img.width) * img.height;

        const newImage: CanvasImage = {
          id: `img-${Date.now()}`,
          x: (VIRTUAL_WIDTH - width) / 2,
          y: 200,
          width,
          height,
          src,
        };

        const next = [...pages];
        next[currentPageIndex] = {
          ...next[currentPageIndex],
          images: [...next[currentPageIndex].images, newImage],
        };
        setPages(next);
        recordHistory(next);
        setSaveStatus('saving');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Convert note to Text Note mode
  const handleSwitchToTextMode = async () => {
    try {
      setConverting(true);
      const res = await fetch(`/api/notes/${initialNote.slug || initialNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note_type: 'text',
          content: '<p><em>(Converted from handwritten note)</em></p>',
        }),
      });

      if (res.ok) {
        setConvertModalOpen(false);
        // Refresh page to load rich text editor
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to convert note mode:', err);
    } finally {
      setConverting(false);
    }
  };

  // Dual-Layer Autosave Engine
  const performSave = useCallback(
    async (overrideTitle?: string) => {
      const serializedData: HandwrittenNoteData = {
        version: 1,
        pages,
        currentPageIndex,
      };
      const contentString = JSON.stringify(serializedData);
      const titleToSave = overrideTitle !== undefined ? overrideTitle : noteTitle;

      // Skip redundant saves
      if (
        contentString === lastSavedContentRef.current &&
        titleToSave === initialNote.title &&
        saveStatus === 'saved'
      ) {
        return;
      }

      setSaveStatus('saving');

      // 1. Save to local IndexedDB draft cache
      await saveOfflineDraft(userId, initialNote.id, titleToSave, contentString, 'handwritten');

      // 2. Persist to Supabase Database
      try {
        const res = await fetch(`/api/notes/${initialNote.slug || initialNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleToSave,
            content: contentString,
            note_type: 'handwritten',
          }),
        });

        if (res.ok) {
          lastSavedContentRef.current = contentString;
          setSaveStatus('saved');
        } else {
          setSaveStatus('offline');
        }
      } catch {
        setSaveStatus('offline');
      }
    },
    [pages, currentPageIndex, noteTitle, initialNote.id, initialNote.slug, initialNote.title, saveStatus, userId]
  );

  // Debounced autosave (800ms)
  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 800);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [pages, noteTitle, performSave]);

  // Keyboard Shortcuts (Cmd+Z, Cmd+Shift+Z, Cmd+S, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        performSave();
      } else if (e.key === 'Escape') {
        if (isFocusMode) setIsFocusMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, performSave, isFocusMode]);

  // Export Current Page as PNG
  const handleExportPng = async () => {
    const canvas = document.createElement('canvas');
    const dpr = 2; // High resolution
    canvas.width = VIRTUAL_WIDTH * dpr;
    canvas.height = VIRTUAL_HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const activePage = pages[currentPageIndex];
    ctx.fillStyle = activePage.paperColor || '#ffffff';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Draw strokes
    activePage.strokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.save();
      ctx.globalAlpha = stroke.opacity || 1;
      if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.4;
      }
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = stroke.tool === 'marker' ? 'square' : 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];
        const pressure = ((p1.pressure || 0.5) + (p2.pressure || 0.5)) / 2;
        ctx.lineWidth = Math.max(1, stroke.size * (0.4 + pressure * 0.9));
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Draw shapes
    activePage.shapes.forEach((s) => {
      ctx.save();
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = s.strokeWidth;
      if (s.type === 'rectangle') ctx.strokeRect(s.x, s.y, s.width, s.height);
      else if (s.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.width, s.y + s.height);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Trigger download
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${noteTitle.toLowerCase().replace(/\s+/g, '-')}-page-${currentPageIndex + 1}.png`;
    a.click();
  };

  // Export PDF via Print Pipeline
  const handleExportPdf = async (_mode: 'all' | 'current') => {
    window.print();
  };

  // Fit to Page zoom calculation
  const handleFitToPage = useCallback(() => {
    if (typeof window !== 'undefined') {
      const availHeight = window.innerHeight - 68;
      const availWidth = window.innerWidth - 80;
      const fitZoom = Math.max(
        0.35,
        Math.min(1.0, Math.min(availHeight / VIRTUAL_HEIGHT, availWidth / VIRTUAL_WIDTH))
      );
      setZoom(Number(fitZoom.toFixed(2)));
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, []);

  // Fit to page on initial load
  const hasFittedInitialRef = useRef(false);
  useEffect(() => {
    if (!hasFittedInitialRef.current) {
      hasFittedInitialRef.current = true;
      handleFitToPage();
    }
  }, [handleFitToPage]);

  const activePage = pages[currentPageIndex] || pages[0];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {/* Top Header Bar */}
      {!isFocusMode && (
        <header className="h-13 shrink-0 flex items-center justify-between px-3 sm:px-6 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md z-30">
          {/* Left Controls: Back + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Link href="/notes" title="All Notes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div className="flex items-center gap-2 min-w-0">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => {
                  setNoteTitle(e.target.value);
                  setSaveStatus('saving');
                }}
                placeholder="Untitled Note"
                className="bg-transparent border-0 font-medium text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 rounded px-1.5 py-0.5 truncate max-w-[140px] sm:max-w-xs"
              />

              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                <Sparkles className="h-2.5 w-2.5 text-emerald-500" />
                Handwritten
              </span>
            </div>
          </div>

          {/* Center: Multi-Page Navigation */}
          <PagesPanel
            pages={pages}
            currentPageIndex={currentPageIndex}
            onSelectPage={setCurrentPageIndex}
            onAddPage={handleAddPage}
            onDuplicatePage={handleDuplicatePage}
            onDeletePage={handleDeletePage}
            onMovePage={handleMovePage}
            onChangeTemplate={handleChangeTemplate}
            onChangePaperColor={handleChangePaperColor}
          />

          {/* Right Controls: Save Status, Zoom, Mode, Export, Theme */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden md:flex items-center gap-1 px-1.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))}
                className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleFitToPage}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 border-l border-zinc-200 dark:border-zinc-800 ml-1 pl-1.5"
                title="Reset Zoom (100%)"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>

            {/* Save Status Badge */}
            <div className="hidden lg:flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium px-2 py-1">
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                  <span>Saving…</span>
                </>
              ) : saveStatus === 'offline' ? (
                <span className="text-amber-500">Offline (Cached)</span>
              ) : (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span>Saved</span>
                </>
              )}
            </div>

            {/* Mode Switcher */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConvertModalOpen(true)}
              className="h-8 text-xs gap-1.5 hidden xl:inline-flex"
              title="Switch to Text Note Mode"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span>Text Mode</span>
            </Button>

            {/* Fullscreen / Focus Mode */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              title="Fullscreen Mode"
            >
              {isFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {/* Export Menu */}
            <ExportMenu
              onExportPng={handleExportPng}
              onExportPdf={handleExportPdf}
              title={noteTitle}
            />

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Main Canvas Workspace */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Floating iPad Toolbar */}
        <FloatingToolbar
          currentTool={currentTool}
          onSelectTool={setCurrentTool}
          currentColor={currentColor}
          onChangeColor={setCurrentColor}
          strokeWidth={strokeWidth}
          onChangeStrokeWidth={setStrokeWidth}
          eraserMode={eraserMode}
          onChangeEraserMode={setEraserMode}
          currentShape={currentShape}
          onSelectShape={setCurrentShape}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClearPage={handleClearCurrentPage}
          onInsertImage={handleInsertImage}
          allowFingerDrawing={allowFingerDrawing}
          onToggleFingerDrawing={setAllowFingerDrawing}
        />

        {/* Exit Focus Mode floating button */}
        {isFocusMode && (
          <button
            type="button"
            onClick={() => setIsFocusMode(false)}
            className="fixed top-4 right-4 z-50 h-8 px-3 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 shadow-md text-xs font-medium flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span>Exit Focus</span>
          </button>
        )}

        {/* Drawing Canvas */}
        <DrawingCanvas
          page={activePage}
          onChangePage={handleUpdateCurrentPage}
          currentTool={currentTool}
          currentColor={currentColor}
          strokeWidth={strokeWidth}
          eraserMode={eraserMode}
          currentShape={currentShape}
          allowFingerDrawing={allowFingerDrawing}
          zoom={zoom}
          pan={pan}
          onUpdateTransform={(z, p) => {
            setZoom(z);
            setPan(p);
          }}
          isDark={isDark}
        />
      </main>

      {/* Switch Mode Warning Dialog */}
      <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-1">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-semibold">
                Switch to Text Note Mode?
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
              Converting this note to a <strong>Text Note</strong> will switch the editor to the keyboard rich-text mode. 
              Existing handwriting vector strokes and drawing pages cannot be edited as rich text.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConvertModalOpen(false)}
              disabled={converting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSwitchToTextMode}
              disabled={converting}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {converting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Convert to Text Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
