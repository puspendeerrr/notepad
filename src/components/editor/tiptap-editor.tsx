'use client';

import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextStyle, FontSize, FontFamily } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Typography } from '@tiptap/extension-typography';

import { PageBreak } from './extensions/page-break';
import { CustomImage } from './extensions/custom-image';
import { CustomListRules } from './extensions/custom-shortcuts';
import { WordShortcuts } from './extensions/word-shortcuts';

import { Note, UserSettings, SaveStatus } from '@/types';
import { titleToSlug } from '@/lib/slug';
import { saveOfflineDraft, getOfflineDraft, clearOfflineDraft } from '@/lib/storage/offline-drafts';
import { countWords, countCharacters, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  MoreVertical,
  Check,
  Loader2,
  WifiOff,
  Download,
  Search,
  Trash2,
  HelpCircle,
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  Heading,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Palette,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListTodo,
  Indent,
  Outdent,
  Quote,
  Code,
  SquareCode,
  Link2,
  Image as ImageIcon,
  Table as TableIcon,
  RemoveFormatting,
  Printer,
  ChevronDown,
  Rows3,
  Columns3,
  Split,
  FileText,
  Clock,
  SpellCheck,
  Replace,
  X,
} from 'lucide-react';

interface TiptapEditorProps {
  initialNote: Note;
  userId: string;
  initialSettings?: Partial<UserSettings>;
}

// Compact Toolbar Button with tooltip helper (placed on TOP as requested)
function ToolbarButton({
  onClick,
  title,
  shortcut,
  isActive = false,
  children,
  className = '',
}: {
  onClick: () => void;
  title: string;
  shortcut?: string;
  isActive?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded text-xs transition-colors shrink-0',
            isActive
              ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 font-medium shadow-xs'
              : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100',
            className
          )}
          aria-label={title}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="text-[11px] py-0.5 px-2 select-none z-50 pointer-events-none">
        <span>{title}</span>
        {shortcut && (
          <span className="ml-1.5 text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
            ({shortcut})
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// Compact Toolbar Dropdown or Custom Trigger with tooltip helper (placed on TOP)
function ToolbarTooltipTrigger({
  title,
  shortcut,
  children,
  side = 'top',
}: {
  title: string;
  shortcut?: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="text-[11px] py-0.5 px-2 select-none z-50 pointer-events-none">
        <span>{title}</span>
        {shortcut && (
          <span className="ml-1.5 text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
            ({shortcut})
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// Seamless Dropdown Menu with Hover Tooltip on Top (prevents tooltip conflicts during menu open)
function DropdownMenuWithTooltip({
  title,
  shortcut,
  trigger,
  children,
  align = 'start',
  className = '',
  side = 'top',
}: {
  title: string;
  shortcut?: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTooltipOpen(false);
      }}
    >
      <Tooltip
        open={open ? false : tooltipOpen}
        onOpenChange={(next) => {
          if (!open) setTooltipOpen(next);
        }}
      >
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            {trigger}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side={side} sideOffset={6} className="text-[11px] py-0.5 px-2 select-none z-50 pointer-events-none">
          <span>{title}</span>
          {shortcut && (
            <span className="ml-1.5 text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
              ({shortcut})
            </span>
          )}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align={align} className={className}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Toolbar vertical separator
function ToolbarSeparator() {
  return <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />;
}

export function TiptapEditor({ initialNote, userId, initialSettings }: TiptapEditorProps) {
  const router = useRouter();
  const { setTheme } = useTheme();

  // Sync user's saved theme from preferences on mount without clobbering user choice
  const hasAppliedInitialTheme = useRef(false);
  useEffect(() => {
    if (!hasAppliedInitialTheme.current && initialSettings?.theme) {
      hasAppliedInitialTheme.current = true;
      const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
      if (!storedTheme) {
        setTheme(initialSettings.theme);
      }
    }
  }, [initialSettings?.theme, setTheme]);

  // Note Metadata & Slug Tracking
  const [title, setTitle] = useState(initialNote.title || 'Untitled Note');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const currentSlugRef = useRef<string>(initialNote.slug || titleToSlug(initialNote.title));

  // Editor Preferences
  const [fontSize, setFontSize] = useState<string>('16px');
  const [fontFamily, setFontFamily] = useState<string>('sans');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);

  // Statistics (Throttled via RAF)
  const [stats, setStats] = useState({
    wordCount: countWords(initialNote.content || ''),
    charCount: countCharacters(initialNote.content || ''),
    readingTime: Math.max(1, Math.ceil(countWords(initialNote.content || '') / 200)),
  });

  // Modal Dialogs & Toolbars State
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Link Dialog State
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Image Dialog State
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');

  // Find and Replace State
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findMatchCount, setFindMatchCount] = useState(0);
  const [findMatchIndex, setFindMatchIndex] = useState(0);

  // Active tracking refs (editor is uncontrolled to avoid keystroke re-renders)
  const currentContentRef = useRef(initialNote.content || '');
  const currentTitleRef = useRef(initialNote.title || 'Untitled Note');
  const noteIdRef = useRef(initialNote.id);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Active typing ambient breathing layer refs
  const ambientLayerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTypingActivity = useCallback(() => {
    if (ambientLayerRef.current) {
      ambientLayerRef.current.classList.add('is-typing');
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      if (ambientLayerRef.current) {
        ambientLayerRef.current.classList.remove('is-typing');
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Save to Supabase API & IndexedDB with Slug Sync
  const saveToCloud = useCallback(
    async (overrideTitle?: string, overrideContent?: string) => {
      const titleToSave = overrideTitle !== undefined ? overrideTitle : currentTitleRef.current;
      const contentToSave = overrideContent !== undefined ? overrideContent : currentContentRef.current;
      const noteId = noteIdRef.current;

      await saveOfflineDraft(userId, noteId, titleToSave, contentToSave);

      if (!navigator.onLine) {
        setSaveStatus('offline');
        return;
      }

      setSaveStatus('saving');
      isSavingRef.current = true;

      try {
        const targetIdentifier = currentSlugRef.current || noteId;
        const response = await fetch(`/api/notes/${encodeURIComponent(targetIdentifier)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleToSave,
            content: contentToSave,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          hasUnsavedChangesRef.current = false;
          setSaveStatus('saved');
          await clearOfflineDraft(userId, noteId);

          // Update URL to human-readable slug without reloading or remounting
          if (data.note?.slug && data.note.slug !== currentSlugRef.current) {
            currentSlugRef.current = data.note.slug;
            window.history.replaceState(null, '', `/notes/${data.note.slug}`);
          }
        } else {
          setSaveStatus('offline');
        }
      } catch (err) {
        console.warn('Autosave network error:', err);
        setSaveStatus('offline');
      } finally {
        isSavingRef.current = false;
      }
    },
    [userId]
  );

  // 800ms Debounced Autosave Trigger
  const triggerDebouncedSave = useCallback(() => {
    hasUnsavedChangesRef.current = true;
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToCloud();
    }, 800);
  }, [saveToCloud]);

  // Immediate Save (Ctrl/Cmd+S, blur, navigation)
  const saveImmediately = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    return saveToCloud();
  }, [saveToCloud]);

  // Handle Note Title Change
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    currentTitleRef.current = newTitle;
    triggerDebouncedSave();
  };

  // Keyboard Shortcuts Callbacks
  const handleOpenLinkModal = useCallback(() => {
    setIsLinkDialogOpen(true);
  }, []);

  const handleOpenFindModal = useCallback(() => {
    setIsFindOpen(true);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Initialize Tiptap Editor (uncontrolled for 60FPS typing responsiveness)
  const editor = useEditor({
    immediatelyRender: false,
    content: initialNote.content || '',
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        dropcursor: {
          color: '#71717a',
          width: 2,
        },
        link: false,
        underline: false,
      }),
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CustomImage,
      PageBreak,
      CustomListRules,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Typography,
      WordShortcuts.configure({
        onSave: saveImmediately,
        onPrint: handlePrint,
        onOpenLink: handleOpenLinkModal,
        onOpenFind: handleOpenFindModal,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        spellcheck: spellCheckEnabled ? 'true' : 'false',
      },
      handleKeyDown: () => {
        handleTypingActivity();
        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      handleTypingActivity();
      const html = currentEditor.getHTML();
      currentContentRef.current = html;
      triggerDebouncedSave();

      // Throttled stats calculation via RAF
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const text = currentEditor.getText();
        const words = countWords(text);
        const chars = countCharacters(text);
        setStats({
          wordCount: words,
          charCount: chars,
          readingTime: Math.max(1, Math.ceil(words / 200)),
        });
      });
    },
  });

  // Restore Offline Draft if newer on mount
  useEffect(() => {
    getOfflineDraft(userId, initialNote.id).then((draft) => {
      if (draft && draft.content && draft.content !== initialNote.content) {
        if (editor) {
          editor.commands.setContent(draft.content);
          currentContentRef.current = draft.content;
          if (draft.title && draft.title !== currentTitleRef.current) {
            setTitle(draft.title);
            currentTitleRef.current = draft.title;
          }
          setSaveStatus('offline');
        }
      }
    });
  }, [editor, userId, initialNote.id, initialNote.content]);

  // Save on blur & beforeunload
  useEffect(() => {
    const handleBlur = () => {
      if (hasUnsavedChangesRef.current) {
        saveImmediately();
      }
    };
    window.addEventListener('blur', handleBlur);

    const handleBeforeUnload = () => {
      if (hasUnsavedChangesRef.current) {
        saveOfflineDraft(userId, noteIdRef.current, currentTitleRef.current, currentContentRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (hasUnsavedChangesRef.current) {
        saveImmediately();
      }
    };
  }, [saveImmediately, userId]);

  // Font family handler
  const handleFontFamilyChange = (family: 'sans' | 'mono' | 'serif') => {
    setFontFamily(family);
    if (!editor) return;
    let stack = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    if (family === 'mono') {
      stack = 'var(--font-geist-mono), "JetBrains Mono", monospace';
    } else if (family === 'serif') {
      stack = 'Merriweather, Georgia, Cambria, "Times New Roman", serif';
    }
    editor.chain().focus().setFontFamily(stack).run();
  };

  // Font size handler
  const handleFontSizeChange = (size: number) => {
    setFontSize(`${size}px`);
    if (!editor) return;
    editor.chain().focus().setFontSize(`${size}px`).run();
  };

  // Link Insertion
  const handleApplyLink = () => {
    if (!editor) return;
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setIsLinkDialogOpen(false);
    setLinkUrl('');
  };

  // Image Insertion
  const handleApplyImage = () => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl, alt: imageAlt }).run();
    setIsImageDialogOpen(false);
    setImageUrl('');
    setImageAlt('');
  };

  // Clear Formatting
  const handleClearFormatting = () => {
    if (!editor) return;
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  };

  // Export handlers
  const handleExportTxt = () => {
    if (!editor) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'note'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.7; padding: 40px; max-width: 800px; margin: 0 auto; color: #1e293b; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; }
th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
th { background-color: #f1f5f9; }
blockquote { border-left: 3px solid #6366f1; padding-left: 16px; margin: 16px 0; font-style: italic; }
pre { background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; }
img { max-width: 100%; border-radius: 6px; }
</style>
</head>
<body>
<h1>${title}</h1>
${html}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'note'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Find in Document
  const handleFindNext = () => {
    if (!editor || !findText) return;
    const doc = editor.state.doc;
    const text = doc.textBetween(0, doc.content.size, '\n', '\n');
    const regex = new RegExp(findText, 'gi');
    const matches: { from: number; to: number }[] = [];
    let match;

    // Search plain text offsets and map to doc positions
    while ((match = regex.exec(text)) !== null) {
      matches.push({ from: match.index + 1, to: match.index + match[0].length + 1 });
    }

    setFindMatchCount(matches.length);

    if (matches.length > 0) {
      const nextIndex = (findMatchIndex + 1) % matches.length;
      setFindMatchIndex(nextIndex);
      const target = matches[nextIndex];
      try {
        editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().run();
      } catch {
        // Fallback if boundary mismatch
      }
    }
  };

  // Replace Current Match
  const handleReplaceCurrent = () => {
    if (!editor || !findText) return;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().insertContent(replaceText).run();
      handleFindNext();
    }
  };

  // Replace All Matches
  const handleReplaceAll = () => {
    if (!editor || !findText) return;
    const currentHtml = editor.getHTML();
    const regex = new RegExp(findText, 'g');
    const updatedHtml = currentHtml.replace(regex, replaceText);
    editor.commands.setContent(updatedHtml);
    setFindMatchCount(0);
  };

  const handleBack = () => {
    if (hasUnsavedChangesRef.current) {
      saveImmediately();
    }
    router.push('/notes');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const targetIdentifier = currentSlugRef.current || initialNote.slug || initialNote.id;
      await fetch(`/api/notes/${encodeURIComponent(targetIdentifier)}`, { method: 'DELETE' });
      await clearOfflineDraft(userId, initialNote.id);
      router.push('/notes');
    } catch (err) {
      console.error('Delete note error:', err);
      setIsDeleting(false);
    }
  };

  if (!editor) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f3f4f7] dark:bg-[#090d16]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={0} disableHoverableContent>
      <div
        className={cn(
          'flex h-screen w-full flex-col text-zinc-900 dark:text-zinc-100 overflow-hidden select-text transition-colors duration-200',
          isFocusMode ? 'bg-[#0b0c0e]' : 'bg-[#fafafa] dark:bg-[#111215]'
        )}
      >
        {/* =========================================================================
            Main Header: Back | Note Title | Saved | Theme | 3-Dot (Delete)
            ========================================================================= */}
        <header
          className={cn(
            'flex h-11 w-full items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/60 bg-white/95 dark:bg-[#111215]/95 px-3 sm:px-4 backdrop-blur-md shrink-0 z-30 transition-all duration-300 no-print',
            isFocusMode && 'opacity-25 hover:opacity-95'
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
            <ToolbarTooltipTrigger title="Back to Notes" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 shrink-0"
                aria-label="Back to Notes"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </ToolbarTooltipTrigger>

            {/* Editable Title with instant auto-save and slug sync */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Note"
              className="w-full bg-transparent font-medium text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none px-2 py-0.5 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 focus:bg-zinc-200/80 dark:focus:bg-zinc-800/80 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Save Status Indicator */}
            <ToolbarTooltipTrigger title="Save Note" shortcut="Ctrl+S" side="bottom">
              <div
                className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 mr-2 select-none cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                onClick={saveImmediately}
                aria-label="Save note"
              >
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                    <span className="text-[11px]">Saving…</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <Check className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    <span className="text-[11px]">Saved</span>
                  </>
                )}
                {saveStatus === 'offline' && (
                  <>
                    <WifiOff className="h-3 w-3 text-amber-500" />
                    <span className="text-[11px] text-amber-600 dark:text-amber-500">Offline</span>
                  </>
                )}
              </div>
            </ToolbarTooltipTrigger>

            {/* Theme Toggle (Light / Dark / System) */}
            <ThemeToggle />

            {/* Minimal 3-Dot Menu: Dangerous actions & Help */}
            <DropdownMenuWithTooltip
              title="More options"
              side="bottom"
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
              align="end"
              className="w-48 text-xs"
            >
              <DropdownMenuItem
                onSelect={() => setIsShortcutsOpen(true)}
                className="gap-2 cursor-pointer py-1.5"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Keyboard shortcuts</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setIsDeleteModalOpen(true)}
                className="gap-2 cursor-pointer py-1.5 text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete note</span>
              </DropdownMenuItem>
            </DropdownMenuWithTooltip>
          </div>
        </header>

        {/* =========================================================================
            Full-Width Horizontal Editor Formatting Toolbar
            Word / Google Docs-style complete document controls
            ========================================================================= */}
        <nav
          aria-label="Formatting toolbar"
          className={cn(
            'flex h-10 w-full items-center border-b border-zinc-200/70 dark:border-zinc-800/50 bg-white/80 dark:bg-[#111215]/80 backdrop-blur-md px-3 overflow-x-auto scrollbar-none shrink-0 z-20 transition-all duration-300 select-none no-print gap-0.5 opacity-90 hover:opacity-100',
            isFocusMode && 'opacity-20 hover:opacity-95'
          )}
        >
          {/* 1. History (Undo / Redo) */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo"
            shortcut="Ctrl+Z"
            isActive={false}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo"
            shortcut="Ctrl+Y"
            isActive={false}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarSeparator />

          {/* 2. Style / Heading Dropdown */}
          <DropdownMenuWithTooltip
            title="Text style"
            side="top"
            trigger={
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                aria-label="Text style"
              >
                <Heading className="h-3.5 w-3.5 mr-0.5" />
                <span className="text-[11px] font-medium">
                  {editor.isActive('heading', { level: 1 })
                    ? 'Heading 1'
                    : editor.isActive('heading', { level: 2 })
                    ? 'Heading 2'
                    : editor.isActive('heading', { level: 3 })
                    ? 'Heading 3'
                    : editor.isActive('heading', { level: 4 })
                    ? 'Heading 4'
                    : editor.isActive('heading', { level: 5 })
                    ? 'Heading 5'
                    : editor.isActive('heading', { level: 6 })
                    ? 'Heading 6'
                    : 'Paragraph'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            }
            align="start"
            className="w-44 text-xs"
          >
            <DropdownMenuItem
              onSelect={() => editor.chain().focus().setParagraph().run()}
              className="cursor-pointer py-1.5 justify-between"
            >
              <span>Normal text</span>
              {!editor.isActive('heading') && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {([1, 2, 3, 4, 5, 6] as const).map((lvl) => (
              <DropdownMenuItem
                key={lvl}
                onSelect={() => editor.chain().focus().toggleHeading({ level: lvl }).run()}
                className="cursor-pointer py-1.5 justify-between"
              >
                <span className={lvl === 1 ? 'font-bold text-sm' : lvl === 2 ? 'font-semibold text-xs' : 'text-xs'}>
                  Heading {lvl} ({'#'.repeat(lvl)})
                </span>
                {editor.isActive('heading', { level: lvl }) && <Check className="h-3 w-3" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuWithTooltip>

          {/* 3. Font Family Selector */}
          <DropdownMenuWithTooltip
            title="Font family"
            side="top"
            trigger={
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                aria-label="Font family"
              >
                <span className="text-[11px] font-medium capitalize">{fontFamily}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            }
            align="start"
            className="w-32 text-xs"
          >
            <DropdownMenuItem
              onSelect={() => handleFontFamilyChange('sans')}
              onClick={() => handleFontFamilyChange('sans')}
              className="py-1.5 cursor-pointer justify-between"
            >
              <span>Sans-serif</span>
              {fontFamily === 'sans' && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => handleFontFamilyChange('mono')}
              onClick={() => handleFontFamilyChange('mono')}
              className="py-1.5 cursor-pointer font-mono justify-between"
            >
              <span>Monospace</span>
              {fontFamily === 'mono' && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => handleFontFamilyChange('serif')}
              onClick={() => handleFontFamilyChange('serif')}
              className="py-1.5 cursor-pointer font-serif justify-between"
            >
              <span>Serif</span>
              {fontFamily === 'serif' && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          </DropdownMenuWithTooltip>

          {/* 4. Font Size Selector */}
          <DropdownMenuWithTooltip
            title="Font size"
            side="top"
            trigger={
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                aria-label="Font size"
              >
                <span className="text-[11px] font-mono">{fontSize}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            }
            align="start"
            className="w-24 text-xs font-mono"
          >
            {[12, 14, 16, 18, 20, 24, 32].map((size) => (
              <DropdownMenuItem
                key={size}
                onSelect={() => handleFontSizeChange(size)}
                onClick={() => handleFontSizeChange(size)}
                className="py-1 cursor-pointer justify-between"
              >
                <span>{size}px</span>
                {fontSize === `${size}px` && <Check className="h-3 w-3" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuWithTooltip>

          <ToolbarSeparator />

          {/* 5. Inline Formatting (Bold, Italic, Underline, Strike, Sub, Sup) */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
            shortcut="Ctrl+B"
            isActive={editor.isActive('bold')}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
            shortcut="Ctrl+I"
            isActive={editor.isActive('italic')}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
            shortcut="Ctrl+U"
            isActive={editor.isActive('underline')}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
            isActive={editor.isActive('strike')}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            title="Subscript"
            isActive={editor.isActive('subscript')}
          >
            <SubscriptIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            title="Superscript"
            isActive={editor.isActive('superscript')}
          >
            <SuperscriptIcon className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarSeparator />

          {/* 6. Text Color Popover */}
          <DropdownMenuWithTooltip
            title="Text color"
            side="top"
            trigger={
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                aria-label="Text color"
              >
                <Palette className="h-3.5 w-3.5" />
              </button>
            }
            align="start"
            className="w-40 p-2 text-xs"
          >
            <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 pb-1">
              Text Color
            </DropdownMenuLabel>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[
                { name: 'Default', color: '', bg: 'bg-zinc-900 dark:bg-zinc-100' },
                { name: 'Red', color: '#ef4444', bg: 'bg-red-500' },
                { name: 'Orange', color: '#f97316', bg: 'bg-orange-500' },
                { name: 'Amber', color: '#f59e0b', bg: 'bg-amber-500' },
                { name: 'Green', color: '#10b981', bg: 'bg-emerald-500' },
                { name: 'Blue', color: '#3b82f6', bg: 'bg-blue-500' },
                { name: 'Purple', color: '#8b5cf6', bg: 'bg-purple-500' },
                { name: 'Pink', color: '#ec4899', bg: 'bg-pink-500' },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  aria-label={c.name}
                  onClick={() => {
                    if (!c.color) {
                      editor.chain().focus().unsetColor().run();
                    } else {
                      editor.chain().focus().setColor(c.color).run();
                    }
                  }}
                  className="h-6 w-6 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:scale-110 transition-transform"
                >
                  <span className={`h-4 w-4 rounded-full ${c.bg}`} />
                </button>
              ))}
            </div>
          </DropdownMenuWithTooltip>

          {/* 7. Highlight Color Popover */}
          <DropdownMenuWithTooltip
            title="Highlight color"
            side="top"
            trigger={
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                aria-label="Highlight color"
              >
                <Highlighter className="h-3.5 w-3.5" />
              </button>
            }
            align="start"
            className="w-40 p-2 text-xs"
          >
            <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 pb-1">
              Highlight Color
            </DropdownMenuLabel>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[
                { name: 'None', color: '', bg: 'border border-dashed border-zinc-400 bg-transparent' },
                { name: 'Yellow', color: '#fef08a', bg: 'bg-yellow-200' },
                { name: 'Green', color: '#bbf7d0', bg: 'bg-green-200' },
                { name: 'Cyan', color: '#a5f3fc', bg: 'bg-cyan-200' },
                { name: 'Pink', color: '#fbcfe8', bg: 'bg-pink-200' },
                { name: 'Orange', color: '#fed7aa', bg: 'bg-orange-200' },
                { name: 'Purple', color: '#e9d5ff', bg: 'bg-purple-200' },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  aria-label={c.name}
                  onClick={() => {
                    if (!c.color) {
                      editor.chain().focus().unsetHighlight().run();
                    } else {
                      editor.chain().focus().setHighlight({ color: c.color }).run();
                    }
                  }}
                  className="h-6 w-6 rounded-full flex items-center justify-center border border-zinc-300 dark:border-zinc-700 hover:scale-110 transition-transform"
                >
                  <span className={`h-4 w-4 rounded-full ${c.bg}`} />
                </button>
              ))}
            </div>
          </DropdownMenuWithTooltip>

          <ToolbarSeparator />

          {/* 8. Alignment */}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Align Left"
            shortcut="Ctrl+L"
            isActive={editor.isActive({ textAlign: 'left' })}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Align Center"
            shortcut="Ctrl+E"
            isActive={editor.isActive({ textAlign: 'center' })}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Align Right"
            shortcut="Ctrl+R"
            isActive={editor.isActive({ textAlign: 'right' })}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            title="Justify"
            shortcut="Ctrl+J"
            isActive={editor.isActive({ textAlign: 'justify' })}
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarSeparator />

          {/* 10. Lists & Indentation */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
            shortcut="Ctrl+Shift+L"
            isActive={editor.isActive('bulletList')}
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
            shortcut="Ctrl+Shift+7"
            isActive={editor.isActive('orderedList')}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title="Task List"
            isActive={editor.isActive('taskList')}
          >
            <ListTodo className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              if (editor.can().sinkListItem('listItem')) {
                editor.chain().focus().sinkListItem('listItem').run();
              } else if (editor.can().sinkListItem('taskItem')) {
                editor.chain().focus().sinkListItem('taskItem').run();
              }
            }}
            title="Indent"
            shortcut="Tab"
          >
            <Indent className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              if (editor.can().liftListItem('listItem')) {
                editor.chain().focus().liftListItem('listItem').run();
              } else if (editor.can().liftListItem('taskItem')) {
                editor.chain().focus().liftListItem('taskItem').run();
              }
            }}
            title="Outdent"
            shortcut="Shift+Tab"
          >
            <Outdent className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarSeparator />

          {/* 11. Blocks & Dividers */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
            isActive={editor.isActive('blockquote')}
          >
            <Quote className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline Code"
            isActive={editor.isActive('code')}
          >
            <Code className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code Block"
            isActive={editor.isActive('codeBlock')}
          >
            <SquareCode className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Divider"
          >
            <span className="font-bold text-xs">—</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setPageBreak().run()}
            title="Page Break"
          >
            <FileText className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarSeparator />

          {/* 12. Inserts: Link, Image, Table */}
          <ToolbarButton
            onClick={() => {
              const prevUrl = editor.getAttributes('link').href || '';
              setLinkUrl(prevUrl);
              setIsLinkDialogOpen(true);
            }}
            title="Insert Link"
            shortcut="Ctrl+K"
            isActive={editor.isActive('link')}
          >
            <Link2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setIsImageDialogOpen(true)}
            title="Insert Image"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </ToolbarButton>

          {/* Table Dropdown Menu */}
          <DropdownMenuWithTooltip
            title="Table tools"
            side="top"
            trigger={
              <button
                type="button"
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded text-xs transition-colors shrink-0',
                  editor.isActive('table')
                    ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 font-medium'
                    : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100'
                )}
                aria-label="Table tools"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </button>
            }
            align="start"
            className="w-48 text-xs"
          >
              {!editor.isActive('table') ? (
                <DropdownMenuItem
                  onSelect={() =>
                    editor
                      .chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  }
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  }
                  className="py-1.5 cursor-pointer gap-2"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  <span>Insert 3x3 Table</span>
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuLabel className="text-[10px] text-zinc-400 font-semibold uppercase">
                    Row Actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().addRowBefore().run()}
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                    className="py-1 cursor-pointer gap-2"
                  >
                    <Rows3 className="h-3.5 w-3.5" /> Add Row Above
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().addRowAfter().run()}
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    className="py-1 cursor-pointer gap-2"
                  >
                    <Rows3 className="h-3.5 w-3.5" /> Add Row Below
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().deleteRow().run()}
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    className="py-1 cursor-pointer text-red-600 dark:text-red-400 gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Row
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] text-zinc-400 font-semibold uppercase">
                    Column Actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().addColumnBefore().run()}
                    onClick={() => editor.chain().focus().addColumnBefore().run()}
                    className="py-1 cursor-pointer gap-2"
                  >
                    <Columns3 className="h-3.5 w-3.5" /> Add Column Left
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().addColumnAfter().run()}
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    className="py-1 cursor-pointer gap-2"
                  >
                    <Columns3 className="h-3.5 w-3.5" /> Add Column Right
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().deleteColumn().run()}
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="py-1 cursor-pointer text-red-600 dark:text-red-400 gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Column
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      if (editor.can().mergeCells()) {
                        editor.chain().focus().mergeCells().run();
                      } else if (editor.can().splitCell()) {
                        editor.chain().focus().splitCell().run();
                      }
                    }}
                    onClick={() => {
                      if (editor.can().mergeCells()) {
                        editor.chain().focus().mergeCells().run();
                      } else if (editor.can().splitCell()) {
                        editor.chain().focus().splitCell().run();
                      }
                    }}
                    className="py-1.5 cursor-pointer gap-2"
                  >
                    <Split className="h-3.5 w-3.5" /> Merge / Split Cell
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().toggleHeaderRow().run()}
                    onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                    className="py-1.5 cursor-pointer gap-2"
                  >
                    <TableIcon className="h-3.5 w-3.5" /> Toggle Header Row
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().deleteTable().run()}
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="py-1.5 cursor-pointer text-red-600 dark:text-red-400 gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Table
                  </DropdownMenuItem>
                </>
              )}
          </DropdownMenuWithTooltip>

          <ToolbarButton
            onClick={handleClearFormatting}
            title="Clear Formatting"
          >
            <RemoveFormatting className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarSeparator />

          {/* 13. Utilities: Find, Spellcheck, Focus, Print, Export */}
          <ToolbarButton
            onClick={() => setIsFindOpen(!isFindOpen)}
            title="Find and Replace"
            shortcut="Ctrl+F"
            isActive={isFindOpen}
          >
            <Search className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => setSpellCheckEnabled(!spellCheckEnabled)}
            title="Browser Spellcheck"
            isActive={spellCheckEnabled}
          >
            <SpellCheck className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => setIsFocusMode(true)}
            title="Focus Mode"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </ToolbarButton>

          <ToolbarButton
            onClick={handlePrint}
            title="Print Document"
            shortcut="Ctrl+P"
          >
            <Printer className="h-3.5 w-3.5" />
          </ToolbarButton>

          {/* Export Menu */}
          <DropdownMenuWithTooltip
            title="Export document"
            side="top"
            trigger={
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                aria-label="Export document"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="text-[11px]">Export</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            }
            align="end"
            className="w-36 text-xs"
          >
            <DropdownMenuItem
              onSelect={handleExportTxt}
              onClick={handleExportTxt}
              className="py-1.5 cursor-pointer"
            >
              Plain Text (.txt)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleExportHtml}
              onClick={handleExportHtml}
              className="py-1.5 cursor-pointer"
            >
              HTML Web Page (.html)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handlePrint}
              onClick={handlePrint}
              className="py-1.5 cursor-pointer"
            >
              PDF Document (Print)
            </DropdownMenuItem>
          </DropdownMenuWithTooltip>
        </nav>

        {/* Find and Replace Floating Panel */}
        {isFindOpen && (
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 px-4 py-2 z-20 shadow-sm transition-all text-xs no-print">
            <div className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-zinc-400" />
              <Input
                placeholder="Find…"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFindNext();
                }}
                className="h-7 w-36 sm:w-48 text-xs"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Replace className="h-3.5 w-3.5 text-zinc-400" />
              <Input
                placeholder="Replace with…"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="h-7 w-36 sm:w-48 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              {findMatchCount > 0 && (
                <span className="font-mono">
                  {findMatchIndex + 1}/{findMatchCount}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFindNext}
                className="h-7 px-2 text-xs"
              >
                Next (Ctrl+G)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReplaceCurrent}
                className="h-7 px-2 text-xs"
              >
                Replace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReplaceAll}
                className="h-7 px-2 text-xs"
              >
                Replace All
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFindOpen(false)}
              className="h-6 w-6 ml-auto text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Floating Exit Focus Button */}
        {isFocusMode && (
          <div className="fixed top-2.5 right-4 z-50 no-print">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFocusMode(false)}
              className="text-xs gap-1.5 shadow-sm bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Exit Focus</span>
            </Button>
          </div>
        )}

        {/* =========================================================================
            Full-Page Seamless Writing Surface
            No visible card, no blue box, natural blending with full-page background
            ========================================================================= */}
        <main
          className="flex-1 min-h-0 relative w-full overflow-hidden cursor-text flex flex-col"
          onClick={() => {
            if (editor && !editor.isFocused) {
              editor.commands.focus();
            }
          }}
        >
          {/* Active typing ambient breathing layer (non-interactive, GPU-accelerated) */}
          <div
            ref={ambientLayerRef}
            className="editor-ambient-layer pointer-events-none absolute inset-0 z-0"
            aria-hidden="true"
          />

          {/* Full-width and full-height scrollable editor with spacious internal padding */}
          <div className="tiptap-wrapper relative z-10 h-full w-full overflow-y-auto">
            <div
              className="w-full max-w-4xl mx-auto min-h-full transition-[font-size] duration-150"
              style={{
                fontSize: fontSize,
                fontFamily:
                  fontFamily === 'mono'
                    ? 'var(--font-geist-mono), "JetBrains Mono", monospace'
                    : fontFamily === 'serif'
                    ? 'Merriweather, Georgia, Cambria, serif'
                    : 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </main>

        {/* =========================================================================
            Subtle Full-Width Bottom Status Bar
            ========================================================================= */}
        <footer
          className={cn(
            'flex h-7 w-full items-center justify-between border-t border-zinc-200/80 dark:border-zinc-800/60 bg-white/95 dark:bg-[#111215]/95 backdrop-blur-md px-4 sm:px-6 text-[11px] text-zinc-400 dark:text-zinc-500 select-none shrink-0 no-print transition-all duration-300',
            isFocusMode && 'opacity-20 hover:opacity-95'
          )}
        >
          <div className="flex items-center gap-3">
            <span>{stats.wordCount} words</span>
            <span>·</span>
            <span>{stats.charCount} characters</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{stats.readingTime} min read</span>
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span>
              {editor.isActive('heading', { level: 1 })
                ? 'Heading 1'
                : editor.isActive('heading', { level: 2 })
                ? 'Heading 2'
                : editor.isActive('heading', { level: 3 })
                ? 'Heading 3'
                : editor.isActive('table')
                ? 'Table'
                : editor.isActive('bulletList')
                ? 'Bullet List'
                : editor.isActive('orderedList')
                ? 'Numbered List'
                : editor.isActive('taskList')
                ? 'Task List'
                : 'Paragraph'}
            </span>
            <span>·</span>
            <span className="capitalize">{saveStatus}</span>
          </div>
        </footer>

        {/* Link Insertion Dialog */}
        <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">Insert Hyperlink</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Paste or enter the web address for the selected text
              </DialogDescription>
            </DialogHeader>
            <div className="my-2">
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyLink();
                }}
                className="text-xs"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setIsLinkDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApplyLink}>
                Apply Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Image Insertion Dialog */}
        <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">Insert Image</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Provide an image URL to embed in your document
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 my-2">
              <div>
                <label className="text-[11px] font-medium text-zinc-500">Image URL</label>
                <Input
                  placeholder="https://images.unsplash.com/…"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="text-xs mt-1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500">Alt text (optional)</label>
                <Input
                  placeholder="Descriptive image caption"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setIsImageDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApplyImage} disabled={!imageUrl}>
                Insert Image
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Keyboard Shortcuts Dialog */}
        <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-medium">Keyboard Shortcuts</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Microsoft Word-compatible shortcuts for fast editing
              </DialogDescription>
            </DialogHeader>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs my-2 max-h-80 overflow-y-auto pr-1">
              {[
                { name: 'Bold / Italic / Underline', key: 'Ctrl + B / I / U' },
                { name: 'Insert link', key: 'Ctrl + K' },
                { name: 'Undo / Redo', key: 'Ctrl + Z / Ctrl + Y' },
                { name: 'Save immediately', key: 'Ctrl + S' },
                { name: 'Print / Export PDF', key: 'Ctrl + P' },
                { name: 'Find and Replace', key: 'Ctrl + F / Ctrl + H' },
                { name: 'Find Next match', key: 'Ctrl + G' },
                { name: 'Select All', key: 'Ctrl + A' },
                { name: 'Heading 1 / 2 / 3', key: 'Ctrl + Alt + 1 / 2 / 3' },
                { name: 'Bullet / Numbered list', key: 'Ctrl + Shift + L / 7' },
                { name: 'Align Left / Center / Right / Justify', key: 'Ctrl + L / E / R / J' },
                { name: 'Indent / Outdent list', key: 'Tab / Shift + Tab' },
              ].map((s) => (
                <div key={s.name} className="flex justify-between py-2">
                  <span className="text-zinc-600 dark:text-zinc-400">{s.name}</span>
                  <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-[11px]">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setIsShortcutsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Note Confirmation Dialog */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-medium">Delete Note</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Are you sure you want to delete &ldquo;{title}&rdquo;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
