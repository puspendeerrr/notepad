'use client';

import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { EditorState, Compartment, EditorSelection, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  ViewPlugin,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  keymap,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  undo as cmUndo,
  redo as cmRedo,
} from '@codemirror/commands';
import {
  openSearchPanel,
  searchKeymap,
} from '@codemirror/search';

import { Note, UserSettings, SaveStatus } from '@/types';
import { titleToSlug } from '@/lib/slug';
import { saveOfflineDraft, getOfflineDraft, clearOfflineDraft } from '@/lib/storage/offline-drafts';
import { countWords, countCharacters, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  Underline,
  Strikethrough,
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
  WrapText,
  Hash,
  Printer,
  ChevronDown,
} from 'lucide-react';

interface CodeMirrorEditorProps {
  initialNote: Note;
  userId: string;
  initialSettings?: Partial<UserSettings>;
}

// Compact Toolbar Button with tooltip helper
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
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="text-[11px] py-0.5 px-2 select-none">
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

// Toolbar vertical separator
function ToolbarSeparator() {
  return <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />;
}

// CodeMirror Live Formatting Plugin:
// Renders text colors, highlights, alignment, headings, bold, italic, underline visually
// and hides raw HTML / markdown syntax so the user experiences a clean Word/Docs editor.
function createLiveFormattingPlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        const text = doc.toString();

        interface DecoItem {
          type: 'line' | 'replace' | 'mark';
          from: number;
          to: number;
          deco: Decoration;
        }

        const items: DecoItem[] = [];

        // 1. Line alignments and headings
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const lineText = line.text;

          // Alignment <div align="...">...</div>
          const alignMatch = lineText.match(/^<div align="(left|center|right|justify)">(.*?)<\/div>$/i);
          if (alignMatch) {
            const align = alignMatch[1];
            items.push({
              type: 'line',
              from: line.from,
              to: line.from,
              deco: Decoration.line({ attributes: { style: `text-align: ${align};` } }),
            });

            const openTag = `<div align="${align}">`;
            const closeTag = `</div>`;
            items.push({
              type: 'replace',
              from: line.from,
              to: line.from + openTag.length,
              deco: Decoration.replace({}),
            });
            items.push({
              type: 'replace',
              from: line.to - closeTag.length,
              to: line.to,
              deco: Decoration.replace({}),
            });
          }

          // Markdown headings
          const headingMatch = lineText.match(/^(#{1,4})\s+(.+)$/);
          if (headingMatch) {
            const level = headingMatch[1].length;
            const sizeStyle =
              level === 1
                ? 'font-size: 1.55em; font-weight: 700; line-height: 1.3;'
                : level === 2
                ? 'font-size: 1.35em; font-weight: 700; line-height: 1.35;'
                : level === 3
                ? 'font-size: 1.2em; font-weight: 600; line-height: 1.4;'
                : 'font-size: 1.05em; font-weight: 600; line-height: 1.4;';

            items.push({
              type: 'line',
              from: line.from,
              to: line.from,
              deco: Decoration.line({ attributes: { style: sizeStyle } }),
            });

            // Make the leading '#' subtle
            items.push({
              type: 'mark',
              from: line.from,
              to: line.from + level + 1,
              deco: Decoration.mark({ attributes: { style: 'opacity: 0.35; font-size: 0.85em;' } }),
            });
          }
        }

        // 2. Highlights: <mark style="background-color: #fef08a">content</mark>
        const markRegex = /<mark style="background-color:\s*([^"]+)">([\s\S]*?)<\/mark>/gi;
        let m: RegExpExecArray | null;
        while ((m = markRegex.exec(text)) !== null) {
          const start = m.index;
          const openTag = m[0].slice(0, m[0].indexOf('>') + 1);
          const color = m[1];
          const content = m[2];
          const contentStart = start + openTag.length;
          const contentEnd = contentStart + content.length;
          const end = start + m[0].length;

          if (content.length === 0) {
            // Completely collapse empty mark tags so they don't show on screen
            items.push({ type: 'replace', from: start, to: end, deco: Decoration.replace({}) });
          } else {
            items.push({ type: 'replace', from: start, to: contentStart, deco: Decoration.replace({}) });
            items.push({
              type: 'mark',
              from: contentStart,
              to: contentEnd,
              deco: Decoration.mark({
                attributes: {
                  style: `background-color: ${color}; color: #18181b; border-radius: 3px; padding: 1px 3px;`,
                },
              }),
            });
            items.push({ type: 'replace', from: contentEnd, to: end, deco: Decoration.replace({}) });
          }
        }

        // 3. Text colors: <span style="color: #ef4444">content</span>
        const spanRegex = /<span style="color:\s*([^"]+)">([\s\S]*?)<\/span>/gi;
        while ((m = spanRegex.exec(text)) !== null) {
          const start = m.index;
          const openTag = m[0].slice(0, m[0].indexOf('>') + 1);
          const color = m[1];
          const content = m[2];
          const contentStart = start + openTag.length;
          const contentEnd = contentStart + content.length;
          const end = start + m[0].length;

          if (content.length === 0) {
            items.push({ type: 'replace', from: start, to: end, deco: Decoration.replace({}) });
          } else {
            items.push({ type: 'replace', from: start, to: contentStart, deco: Decoration.replace({}) });
            if (color !== 'inherit') {
              items.push({
                type: 'mark',
                from: contentStart,
                to: contentEnd,
                deco: Decoration.mark({
                  attributes: {
                    style: `color: ${color};`,
                  },
                }),
              });
            }
            items.push({ type: 'replace', from: contentEnd, to: end, deco: Decoration.replace({}) });
          }
        }

        // 4. Underlines: <u>content</u>
        const uRegex = /<u>([\s\S]*?)<\/u>/gi;
        while ((m = uRegex.exec(text)) !== null) {
          const start = m.index;
          const content = m[1];
          const contentStart = start + 3;
          const contentEnd = contentStart + content.length;
          const end = start + m[0].length;

          if (content.length === 0) {
            items.push({ type: 'replace', from: start, to: end, deco: Decoration.replace({}) });
          } else {
            items.push({ type: 'replace', from: start, to: contentStart, deco: Decoration.replace({}) });
            items.push({
              type: 'mark',
              from: contentStart,
              to: contentEnd,
              deco: Decoration.mark({ attributes: { style: 'text-decoration: underline;' } }),
            });
            items.push({ type: 'replace', from: contentEnd, to: end, deco: Decoration.replace({}) });
          }
        }

        // 5. Strikethrough: ~~content~~
        const strikeRegex = /~~([\s\S]*?)~~/gi;
        while ((m = strikeRegex.exec(text)) !== null) {
          const start = m.index;
          const content = m[1];
          const contentStart = start + 2;
          const contentEnd = contentStart + content.length;
          const end = start + m[0].length;

          if (content.length === 0) {
            items.push({ type: 'replace', from: start, to: end, deco: Decoration.replace({}) });
          } else {
            items.push({ type: 'replace', from: start, to: contentStart, deco: Decoration.replace({}) });
            items.push({
              type: 'mark',
              from: contentStart,
              to: contentEnd,
              deco: Decoration.mark({ attributes: { style: 'text-decoration: line-through;' } }),
            });
            items.push({ type: 'replace', from: contentEnd, to: end, deco: Decoration.replace({}) });
          }
        }

        // 6. Bold: **content**
        const boldRegex = /\*\*([^*]+)\*\*/g;
        while ((m = boldRegex.exec(text)) !== null) {
          const start = m.index;
          const content = m[1];
          const contentStart = start + 2;
          const contentEnd = contentStart + content.length;
          const end = start + m[0].length;

          items.push({ type: 'replace', from: start, to: contentStart, deco: Decoration.replace({}) });
          items.push({
            type: 'mark',
            from: contentStart,
            to: contentEnd,
            deco: Decoration.mark({ attributes: { style: 'font-weight: 700;' } }),
          });
          items.push({ type: 'replace', from: contentEnd, to: end, deco: Decoration.replace({}) });
        }

        // 7. Italic: *content* (not preceded or followed by *)
        const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g;
        while ((m = italicRegex.exec(text)) !== null) {
          const start = m.index;
          const content = m[1];
          const contentStart = start + 1;
          const contentEnd = contentStart + content.length;
          const end = start + m[0].length;

          items.push({ type: 'replace', from: start, to: contentStart, deco: Decoration.replace({}) });
          items.push({
            type: 'mark',
            from: contentStart,
            to: contentEnd,
            deco: Decoration.mark({ attributes: { style: 'font-style: italic;' } }),
          });
          items.push({ type: 'replace', from: contentEnd, to: end, deco: Decoration.replace({}) });
        }

        // Sort items and remove any overlapping replace ranges
        items.sort((a, b) => {
          if (a.from !== b.from) return a.from - b.from;
          if (a.type === 'line') return -1;
          if (b.type === 'line') return 1;
          return b.to - a.to;
        });

        let lastReplaceTo = -1;
        const validItems: DecoItem[] = [];
        for (const item of items) {
          if (item.type === 'replace') {
            if (item.from < lastReplaceTo) {
              continue;
            }
            lastReplaceTo = item.to;
          }
          validItems.push(item);
        }

        // Sort strictly by `from` position, then `startSide` as required by RangeSetBuilder
        validItems.sort((a, b) => {
          return a.from - b.from || a.deco.startSide - b.deco.startSide;
        });

        for (const item of validItems) {
          builder.add(item.from, item.to, item.deco);
        }

        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

export function CodeMirrorEditor({
  initialNote,
  userId,
  initialSettings,
}: CodeMirrorEditorProps) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  // Restore saved theme on mount
  useEffect(() => {
    if (initialSettings?.theme) {
      setTheme(initialSettings.theme);
    }
  }, [initialSettings?.theme, setTheme]);

  // DOM & Engine Refs (Engine is uncontrolled; CodeMirror owns document state)
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  // Note Metadata & Slug Tracking
  const [title, setTitle] = useState(initialNote.title || 'Untitled Note');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const currentSlugRef = useRef<string>(initialNote.slug || titleToSlug(initialNote.title));

  // Dynamic Editor Preferences
  const [wordWrap, setWordWrap] = useState(initialSettings?.word_wrap ?? true);
  const [showLineNumbers, setShowLineNumbers] = useState(initialSettings?.line_numbers ?? false);
  const [fontSize, setFontSize] = useState<number>(initialSettings?.font_size ?? 16);
  const [fontFamily, setFontFamily] = useState<'sans' | 'mono' | 'serif'>('sans');
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Status Bar Statistics (Throttled via RAF)
  const [stats, setStats] = useState({
    wordCount: countWords(initialNote.content || ''),
    charCount: countCharacters(initialNote.content || ''),
    line: 1,
    col: 1,
  });

  // Modal Dialogs State
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active tracking refs
  const currentContentRef = useRef(initialNote.content || '');
  const currentTitleRef = useRef(initialNote.title || 'Untitled Note');
  const noteIdRef = useRef(initialNote.id);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // CodeMirror Compartments
  const lineWrappingCompartment = useRef(new Compartment());
  const lineNumbersCompartment = useRef(new Compartment());
  const typographyCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  // Helper to build typography extension
  const getTypographyExtension = useCallback((size: number, family: 'sans' | 'mono' | 'serif') => {
    let fontStack = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    if (family === 'mono') {
      fontStack = 'var(--font-geist-mono), "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    } else if (family === 'serif') {
      fontStack = 'Merriweather, Georgia, Cambria, "Times New Roman", serif';
    }

    return EditorView.theme({
      '&': {
        fontSize: `${size}px`,
        lineHeight: '1.7',
        letterSpacing: '0.012em',
      },
      '.cm-scroller': {
        fontFamily: fontStack,
        lineHeight: '1.7',
        letterSpacing: '0.012em',
      },
      '.cm-content': {
        lineHeight: '1.7',
        letterSpacing: '0.012em',
      },
    });
  }, []);

  // Helper to build theme extension
  const getThemeExtension = useCallback((isDark: boolean) => {
    return EditorView.theme(
      {
        '&': {
          color: isDark ? '#f4f4f5' : '#18181b',
          backgroundColor: 'transparent',
        },
        '.cm-content': {
          caretColor: isDark ? '#818cf8' : '#2563eb',
        },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: isDark ? '#818cf8' : '#2563eb',
          borderLeftWidth: '2px',
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.25) !important' : 'rgba(59, 130, 246, 0.18) !important',
        },
        '.cm-activeLine': {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
        },
      },
      { dark: isDark }
    );
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

  // ============================================================================
  // Formatting Actions (Operates on CodeMirror EditorView via Transactions)
  // ============================================================================

  // Wrap selected text with prefix & suffix (or insert & place cursor in middle)
  const applyWrap = useCallback((prefix: string, suffix: string, placeholder = 'text') => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const changes = state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);

      // Check if already wrapped -> toggle off
      if (
        range.from >= prefix.length &&
        state.sliceDoc(range.from - prefix.length, range.from) === prefix &&
        state.sliceDoc(range.to, range.to + suffix.length) === suffix
      ) {
        return {
          changes: [
            { from: range.from - prefix.length, to: range.from, insert: '' },
            { from: range.to, to: range.to + suffix.length, insert: '' },
          ],
          range: EditorSelection.range(range.from - prefix.length, range.to - prefix.length),
        };
      }

      if (!text) {
        // If cursor touches a word, wrap the word!
        const line = state.doc.lineAt(range.from);
        const offset = range.from - line.from;
        const textBefore = line.text.slice(0, offset);
        const textAfter = line.text.slice(offset);
        const mBefore = textBefore.match(/\b\w+$/);
        const mAfter = textAfter.match(/^\w+\b/);

        if (mBefore || mAfter) {
          const wordStart = range.from - (mBefore ? mBefore[0].length : 0);
          const wordEnd = range.from + (mAfter ? mAfter[0].length : 0);
          const word = state.sliceDoc(wordStart, wordEnd);
          const rep = prefix + word + suffix;
          return {
            changes: { from: wordStart, to: wordEnd, insert: rep },
            range: EditorSelection.range(wordStart, wordStart + rep.length),
          };
        }

        const rep = prefix + placeholder + suffix;
        return {
          changes: { from: range.from, to: range.to, insert: rep },
          range: EditorSelection.range(range.from + prefix.length, range.from + prefix.length + placeholder.length),
        };
      }

      const replacement = prefix + text + suffix;
      return {
        changes: { from: range.from, to: range.to, insert: replacement },
        range: EditorSelection.range(range.from, range.from + replacement.length),
      };
    });

    dispatch(changes);
    view.focus();
  }, []);

  // Format line prefix (Heading, Lists, Blockquote)
  const applyLinePrefix = useCallback((prefix: string, stripRegex?: RegExp) => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const changes = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);
      let lineText = line.text;

      if (stripRegex) {
        lineText = lineText.replace(stripRegex, '');
      }

      const newLineText = prefix + lineText;
      return {
        changes: { from: line.from, to: line.to, insert: newLineText },
        range: EditorSelection.cursor(line.from + newLineText.length),
      };
    });

    dispatch(changes);
    view.focus();
  }, []);

  // Indent lines
  const handleIndent = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const changes = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);
      return {
        changes: { from: line.from, to: line.from, insert: '  ' },
        range: EditorSelection.cursor(range.to + 2),
      };
    });

    dispatch(changes);
    view.focus();
  }, []);

  // Outdent lines
  const handleOutdent = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const changes = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);
      if (line.text.startsWith('  ')) {
        return {
          changes: { from: line.from, to: line.from + 2, insert: '' },
          range: EditorSelection.cursor(Math.max(line.from, range.to - 2)),
        };
      } else if (line.text.startsWith('\t') || line.text.startsWith(' ')) {
        return {
          changes: { from: line.from, to: line.from + 1, insert: '' },
          range: EditorSelection.cursor(Math.max(line.from, range.to - 1)),
        };
      }
      return { range };
    });

    dispatch(changes);
    view.focus();
  }, []);

  // Apply alignment tag
  const applyAlignment = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const changes = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);
      const text = line.text.replace(/<div align="(left|center|right|justify)">([\s\S]*?)<\/div>/gi, '$2');

      let newLineText = text;
      if (align !== 'left') {
        newLineText = `<div align="${align}">${text}</div>`;
      }

      return {
        changes: { from: line.from, to: line.to, insert: newLineText },
        range: EditorSelection.cursor(line.from + newLineText.length),
      };
    });

    dispatch(changes);
    view.focus();
  }, []);

  // Clear formatting
  const handleClearFormatting = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const changes = state.changeByRange((range) => {
      let text = state.sliceDoc(range.from, range.to);
      text = text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/<u>([^<]+)<\/u>/gi, '$1')
        .replace(/<mark[^>]*>([^<]+)<\/mark>/gi, '$1')
        .replace(/<span[^>]*>([^<]+)<\/span>/gi, '$1')
        .replace(/<div[^>]*>([^<]+)<\/div>/gi, '$1')
        .replace(/^#+\s+/gm, '')
        .replace(/^[-*+]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/^>\s+/gm, '');

      return {
        changes: { from: range.from, to: range.to, insert: text },
        range: EditorSelection.range(range.from, range.from + text.length),
      };
    });

    dispatch(changes);
    view.focus();
  }, []);

  // Insert template (table, image, link, code block)
  const insertSnippet = useCallback((snippet: string) => {
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const range = state.selection.main;
    dispatch({
      changes: { from: range.from, to: range.to, insert: snippet },
      selection: EditorSelection.cursor(range.from + snippet.length),
    });
    view.focus();
  }, []);

  // Insert link helper
  const handleInsertLink = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    const selected = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
    const linkText = selected.trim() || 'link text';
    applyWrap(`[${linkText}](`, 'https://example.com)');
  }, [applyWrap]);

  // Insert image helper
  const handleInsertImage = useCallback(() => {
    insertSnippet('![image description](https://example.com/image.png)');
  }, [insertSnippet]);

  // Insert table helper
  const handleInsertTable = useCallback(() => {
    const tableTemplate = `\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Item 1   | Item 2   | Item 3   |\n| Item 4   | Item 5   | Item 6   |\n`;
    insertSnippet(tableTemplate);
  }, [insertSnippet]);

  // Text color helper
  const handleApplyColor = useCallback((color: string) => {
    if (!color) return;
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const range = state.selection.main;

    // "Default" means remove color formatting!
    if (color === 'inherit' || color === 'default') {
      if (range.from !== range.to) {
        const selected = state.sliceDoc(range.from, range.to);
        const cleaned = selected.replace(/<span style="color:[^"]*">([\s\S]*?)<\/span>/gi, '$1');
        dispatch({
          changes: { from: range.from, to: range.to, insert: cleaned },
          selection: EditorSelection.range(range.from, range.from + cleaned.length),
        });
      } else {
        const line = state.doc.lineAt(range.from);
        const newLine = line.text.replace(/<span style="color:[^"]*">([\s\S]*?)<\/span>/gi, '$1');
        if (newLine !== line.text) {
          dispatch({
            changes: { from: line.from, to: line.to, insert: newLine },
            selection: EditorSelection.cursor(Math.min(range.from, line.from + newLine.length)),
          });
        }
      }
      view.focus();
      return;
    }

    if (range.from === range.to) {
      // Check if cursor touches a word
      const line = state.doc.lineAt(range.from);
      const offset = range.from - line.from;
      const textBefore = line.text.slice(0, offset);
      const textAfter = line.text.slice(offset);
      const mBefore = textBefore.match(/\b\w+$/);
      const mAfter = textAfter.match(/^\w+\b/);

      if (mBefore || mAfter) {
        const wordStart = range.from - (mBefore ? mBefore[0].length : 0);
        const wordEnd = range.from + (mAfter ? mAfter[0].length : 0);
        const word = state.sliceDoc(wordStart, wordEnd);
        const cleanWord = word.replace(/<span style="color:[^"]*">([\s\S]*?)<\/span>/gi, '$1');
        const insert = `<span style="color: ${color}">${cleanWord}</span>`;
        dispatch({
          changes: { from: wordStart, to: wordEnd, insert },
          selection: EditorSelection.range(wordStart, wordStart + insert.length),
        });
        view.focus();
        return;
      }

      // No word: insert placeholder and select it so user sees the colored text immediately
      const placeholder = 'colored text';
      const insert = `<span style="color: ${color}">${placeholder}</span>`;
      const openLen = `<span style="color: ${color}">`.length;
      dispatch({
        changes: { from: range.from, to: range.to, insert },
        selection: EditorSelection.range(range.from + openLen, range.from + openLen + placeholder.length),
      });
      view.focus();
      return;
    }

    // Wrap selection (or replace existing color if already inside span)
    const selected = state.sliceDoc(range.from, range.to);
    const clean = selected.replace(/<span style="color:[^"]*">([\s\S]*?)<\/span>/gi, '$1');
    const insert = `<span style="color: ${color}">${clean}</span>`;
    dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: EditorSelection.range(range.from, range.from + insert.length),
    });
    view.focus();
  }, []);

  // Highlight color helper
  const handleApplyHighlight = useCallback((bgColor: string) => {
    if (!bgColor) return;
    const view = editorViewRef.current;
    if (!view) return;

    const { state, dispatch } = view;
    const range = state.selection.main;

    // "None" means remove highlight!
    if (bgColor === 'none' || bgColor === 'transparent') {
      if (range.from !== range.to) {
        const selected = state.sliceDoc(range.from, range.to);
        const cleaned = selected.replace(/<mark style="background-color:[^"]*">([\s\S]*?)<\/mark>/gi, '$1');
        dispatch({
          changes: { from: range.from, to: range.to, insert: cleaned },
          selection: EditorSelection.range(range.from, range.from + cleaned.length),
        });
      } else {
        const line = state.doc.lineAt(range.from);
        const newLine = line.text.replace(/<mark style="background-color:[^"]*">([\s\S]*?)<\/mark>/gi, '$1');
        if (newLine !== line.text) {
          dispatch({
            changes: { from: line.from, to: line.to, insert: newLine },
            selection: EditorSelection.cursor(Math.min(range.from, line.from + newLine.length)),
          });
        }
      }
      view.focus();
      return;
    }

    if (range.from === range.to) {
      const line = state.doc.lineAt(range.from);
      const offset = range.from - line.from;
      const textBefore = line.text.slice(0, offset);
      const textAfter = line.text.slice(offset);
      const mBefore = textBefore.match(/\b\w+$/);
      const mAfter = textAfter.match(/^\w+\b/);

      if (mBefore || mAfter) {
        const wordStart = range.from - (mBefore ? mBefore[0].length : 0);
        const wordEnd = range.from + (mAfter ? mAfter[0].length : 0);
        const word = state.sliceDoc(wordStart, wordEnd);
        const cleanWord = word.replace(/<mark style="background-color:[^"]*">([\s\S]*?)<\/mark>/gi, '$1');
        const insert = `<mark style="background-color: ${bgColor}">${cleanWord}</mark>`;
        dispatch({
          changes: { from: wordStart, to: wordEnd, insert },
          selection: EditorSelection.range(wordStart, wordStart + insert.length),
        });
        view.focus();
        return;
      }

      const placeholder = 'highlighted text';
      const insert = `<mark style="background-color: ${bgColor}">${placeholder}</mark>`;
      const openLen = `<mark style="background-color: ${bgColor}">`.length;
      dispatch({
        changes: { from: range.from, to: range.to, insert },
        selection: EditorSelection.range(range.from + openLen, range.from + openLen + placeholder.length),
      });
      view.focus();
      return;
    }

    const selected = state.sliceDoc(range.from, range.to);
    const clean = selected.replace(/<mark style="background-color:[^"]*">([\s\S]*?)<\/mark>/gi, '$1');
    const insert = `<mark style="background-color: ${bgColor}">${clean}</mark>`;
    dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: EditorSelection.range(range.from, range.from + insert.length),
    });
    view.focus();
  }, []);

  // Print helper
  const handlePrint = useCallback(() => {
    saveImmediately();
    window.print();
  }, [saveImmediately]);

  // ============================================================================
  // Initialize CodeMirror 6 ONCE on Mount (Empty dependency array)
  // ============================================================================
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const isDark = resolvedTheme === 'dark';
    const initialDoc = initialNote.content || '';

    // Check for cached offline draft
    getOfflineDraft(userId, initialNote.id).then((draft) => {
      if (draft && draft.content && draft.content !== initialDoc) {
        if (editorViewRef.current) {
          editorViewRef.current.dispatch({
            changes: { from: 0, to: editorViewRef.current.state.doc.length, insert: draft.content },
          });
          currentContentRef.current = draft.content;
          if (draft.title && draft.title !== currentTitleRef.current) {
            setTitle(draft.title);
            currentTitleRef.current = draft.title;
          }
          setSaveStatus('offline');
        }
      }
    });

    // CodeMirror transaction listener
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const text = update.state.doc.toString();
        currentContentRef.current = text;
        triggerDebouncedSave();

        // Throttle stats calculation via RAF
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          const mainSelection = update.state.selection.main;
          const line = update.state.doc.lineAt(mainSelection.head);
          setStats({
            wordCount: countWords(text),
            charCount: countCharacters(text),
            line: line.number,
            col: mainSelection.head - line.from + 1,
          });
        });
      } else if (update.selectionSet) {
        const mainSelection = update.state.selection.main;
        const line = update.state.doc.lineAt(mainSelection.head);
        setStats((prev) => ({
          ...prev,
          line: line.number,
          col: mainSelection.head - line.from + 1,
        }));
      }
    });

    // Keymap bindings
    const customKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          saveImmediately();
          return true;
        },
      },
      {
        key: 'Mod-b',
        run: () => {
          applyWrap('**', '**');
          return true;
        },
      },
      {
        key: 'Mod-i',
        run: () => {
          applyWrap('*', '*');
          return true;
        },
      },
      {
        key: 'Mod-u',
        run: () => {
          applyWrap('<u>', '</u>');
          return true;
        },
      },
      {
        key: 'Mod-Shift-x',
        run: () => {
          applyWrap('~~', '~~');
          return true;
        },
      },
      {
        key: 'Mod-f',
        run: openSearchPanel,
      },
      {
        key: 'Mod-p',
        run: () => {
          handlePrint();
          return true;
        },
      },
      ...searchKeymap,
      ...defaultKeymap,
      ...historyKeymap,
    ]);

    // Initial Editor State
    const startState = EditorState.create({
      doc: initialDoc,
      extensions: [
        history(),
        drawSelection(),
        updateListener,
        customKeymap,
        highlightActiveLine(),
        highlightActiveLineGutter(),
        createLiveFormattingPlugin(),
        themeCompartment.current.of(getThemeExtension(isDark)),
        typographyCompartment.current.of(getTypographyExtension(fontSize, fontFamily)),
        lineWrappingCompartment.current.of(wordWrap ? EditorView.lineWrapping : []),
        lineNumbersCompartment.current.of(showLineNumbers ? lineNumbers() : []),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    // Save on blur
    const handleBlur = () => {
      if (hasUnsavedChangesRef.current) {
        saveImmediately();
      }
    };
    const domElement = view.dom;
    domElement.addEventListener('focusout', handleBlur);

    // Save on beforeunload
    const handleBeforeUnload = () => {
      if (hasUnsavedChangesRef.current) {
        saveOfflineDraft(userId, noteIdRef.current, currentTitleRef.current, currentContentRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Network status listeners
    const handleOnline = () => {
      if (hasUnsavedChangesRef.current) {
        saveImmediately();
      }
    };
    const handleOffline = () => setSaveStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-focus editor
    view.focus();

    return () => {
      domElement.removeEventListener('focusout', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (hasUnsavedChangesRef.current) {
        saveImmediately();
      }
      view.destroy();
      editorViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme update
  useEffect(() => {
    if (!editorViewRef.current) return;
    const isDark = resolvedTheme === 'dark';
    editorViewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure(getThemeExtension(isDark)),
    });
  }, [resolvedTheme, getThemeExtension]);

  // Typography update
  const handleFontSizeChange = (newSize: number) => {
    setFontSize(newSize);
    if (editorViewRef.current) {
      editorViewRef.current.dispatch({
        effects: typographyCompartment.current.reconfigure(getTypographyExtension(newSize, fontFamily)),
      });
    }
  };

  const handleFontFamilyChange = (newFamily: 'sans' | 'mono' | 'serif') => {
    setFontFamily(newFamily);
    if (editorViewRef.current) {
      editorViewRef.current.dispatch({
        effects: typographyCompartment.current.reconfigure(getTypographyExtension(fontSize, newFamily)),
      });
    }
  };

  // Word Wrap update
  const handleToggleWordWrap = () => {
    const next = !wordWrap;
    setWordWrap(next);
    if (editorViewRef.current) {
      editorViewRef.current.dispatch({
        effects: lineWrappingCompartment.current.reconfigure(next ? EditorView.lineWrapping : []),
      });
    }
  };

  // Line Numbers update
  const handleToggleLineNumbers = () => {
    const next = !showLineNumbers;
    setShowLineNumbers(next);
    if (editorViewRef.current) {
      editorViewRef.current.dispatch({
        effects: lineNumbersCompartment.current.reconfigure(next ? lineNumbers() : []),
      });
    }
  };

  // Actions
  const handleBack = () => {
    saveImmediately();
    router.push('/notes');
  };

  const handleExportTxt = () => {
    const content = currentContentRef.current;
    const fileName = `${title.trim() || 'Untitled Note'}.txt`.replace(/[/\\?%*:|"<>]/g, '-');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          'flex h-screen w-full flex-col text-zinc-900 dark:text-zinc-100 overflow-hidden select-text transition-colors duration-200',
          isFocusMode ? 'bg-zinc-200/80 dark:bg-[#060910]' : 'bg-[#f3f4f7] dark:bg-[#090d16]'
        )}
      >
        {/* =========================================================================
            Main Header: Back | Note Title | Saved | Theme | 3-Dot (Delete)
            ========================================================================= */}
        <header
          className={cn(
            'flex h-11 w-full items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/60 bg-[#f3f4f7]/90 dark:bg-[#090d16]/90 px-3 sm:px-4 backdrop-blur-md shrink-0 z-30 transition-all duration-300 no-print',
            isFocusMode && 'opacity-25 hover:opacity-95'
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 shrink-0"
              title="Back to Notes"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

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
            <div
              className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 mr-2 select-none cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              onClick={saveImmediately}
              title="Click to save immediately (Ctrl+S)"
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

            {/* Theme Toggle (Light / Dark / System) */}
            <ThemeToggle />

            {/* Minimal 3-Dot Menu: Dangerous actions & Help */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  title="More actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <DropdownMenuItem
                  onClick={() => setIsShortcutsOpen(true)}
                  className="gap-2 cursor-pointer py-1.5"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Keyboard shortcuts</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="gap-2 cursor-pointer py-1.5 text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete note</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* =========================================================================
            Full-Width Horizontal Editor Formatting Toolbar
            Sticky below header, compact, visually secondary
            ========================================================================= */}
        <nav
          aria-label="Formatting toolbar"
          className={cn(
            'flex h-10 w-full items-center border-b border-zinc-200/70 dark:border-zinc-800/50 bg-[#f3f4f7]/80 dark:bg-[#090d16]/80 backdrop-blur-md px-3 overflow-x-auto scrollbar-none shrink-0 z-20 transition-all duration-300 select-none no-print gap-0.5 opacity-85 hover:opacity-100',
            isFocusMode && 'opacity-20 hover:opacity-95'
          )}
        >
          {/* 1. History (Undo / Redo) */}
          <ToolbarButton
            onClick={() => {
              if (editorViewRef.current) cmUndo(editorViewRef.current);
            }}
              title="Undo"
              shortcut="Ctrl+Z"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => {
                if (editorViewRef.current) cmRedo(editorViewRef.current);
              }}
              title="Redo"
              shortcut="Ctrl+Y"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 2. Paragraph / Heading Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                  title="Text style"
                >
                  <Heading className="h-3.5 w-3.5 mr-0.5" />
                  <span className="text-[11px] font-medium">Style</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 text-xs">
                <DropdownMenuItem
                  onClick={() => applyLinePrefix('', /^#+\s+/)}
                  className="cursor-pointer py-1.5"
                >
                  Normal text
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => applyLinePrefix('# ', /^#+\s+/)}
                  className="cursor-pointer py-1.5 font-bold text-sm"
                >
                  Heading 1 (#)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => applyLinePrefix('## ', /^#+\s+/)}
                  className="cursor-pointer py-1.5 font-semibold text-xs"
                >
                  Heading 2 (##)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => applyLinePrefix('### ', /^#+\s+/)}
                  className="cursor-pointer py-1.5 font-medium text-xs"
                >
                  Heading 3 (###)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => applyLinePrefix('#### ', /^#+\s+/)}
                  className="cursor-pointer py-1.5 text-xs"
                >
                  Heading 4 (####)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 3. Font Family Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                  title="Font family"
                >
                  <span className="text-[11px] font-medium capitalize">{fontFamily}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32 text-xs">
                <DropdownMenuItem onClick={() => handleFontFamilyChange('sans')} className="py-1.5 cursor-pointer">
                  Sans-serif
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFontFamilyChange('mono')} className="py-1.5 cursor-pointer font-mono">
                  Monospace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFontFamilyChange('serif')} className="py-1.5 cursor-pointer font-serif">
                  Serif
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 4. Font Size Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                  title="Font size"
                >
                  <span className="text-[11px] font-mono">{fontSize}px</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-24 text-xs font-mono">
                {[12, 14, 16, 18, 20, 24].map((size) => (
                  <DropdownMenuItem
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    className="py-1 cursor-pointer justify-between"
                  >
                    <span>{size}px</span>
                    {fontSize === size && <Check className="h-3 w-3" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolbarSeparator />

            {/* 5. Basic Inline Formatting (Bold, Italic, Underline, Strikethrough) */}
            <ToolbarButton onClick={() => applyWrap('**', '**')} title="Bold" shortcut="Ctrl+B">
              <Bold className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => applyWrap('*', '*')} title="Italic" shortcut="Ctrl+I">
              <Italic className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => applyWrap('<u>', '</u>')} title="Underline" shortcut="Ctrl+U">
              <Underline className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => applyWrap('~~', '~~')} title="Strikethrough" shortcut="Ctrl+Shift+X">
              <Strikethrough className="h-3.5 w-3.5" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 6. Text Color Popover */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                  title="Text color"
                >
                  <Palette className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 p-2 text-xs">
                <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 pb-1">
                  Text Color
                </DropdownMenuLabel>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { name: 'Default', color: 'inherit', bg: 'bg-zinc-900 dark:bg-zinc-100' },
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
                      title={c.name}
                      onClick={() => handleApplyColor(c.color)}
                      className="h-6 w-6 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:scale-110 transition-transform"
                    >
                      <span className={`h-4 w-4 rounded-full ${c.bg}`} />
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 7. Highlight Color Popover */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                  title="Highlight color"
                >
                  <Highlighter className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 p-2 text-xs">
                <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 pb-1">
                  Highlight Color
                </DropdownMenuLabel>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { name: 'None', color: 'none', bg: 'border border-dashed border-zinc-400 bg-transparent' },
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
                      title={c.name}
                      onClick={() => handleApplyHighlight(c.color)}
                      className="h-6 w-6 rounded-full flex items-center justify-center border border-zinc-300 dark:border-zinc-700 hover:scale-110 transition-transform"
                    >
                      <span className={`h-4 w-4 rounded-full ${c.bg}`} />
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolbarSeparator />

            {/* 8. Text Alignment */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70 transition-colors shrink-0"
                  title="Text alignment"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-32 text-xs">
                <DropdownMenuItem onClick={() => applyAlignment('left')} className="gap-2 py-1.5 cursor-pointer">
                  <AlignLeft className="h-3.5 w-3.5" /> Left
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyAlignment('center')} className="gap-2 py-1.5 cursor-pointer">
                  <AlignCenter className="h-3.5 w-3.5" /> Center
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyAlignment('right')} className="gap-2 py-1.5 cursor-pointer">
                  <AlignRight className="h-3.5 w-3.5" /> Right
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyAlignment('justify')} className="gap-2 py-1.5 cursor-pointer">
                  <AlignJustify className="h-3.5 w-3.5" /> Justify
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolbarSeparator />

            {/* 9. Lists & Indentation */}
            <ToolbarButton onClick={() => applyLinePrefix('- ', /^[-*+]\s+/)} title="Bullet List">
              <List className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => applyLinePrefix('1. ', /^\d+\.\s+/)} title="Numbered List">
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => applyLinePrefix('- [ ] ', /^-\s\[[ x]\]\s+/)} title="Task List">
              <ListTodo className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleIndent} title="Indent">
              <Indent className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleOutdent} title="Outdent">
              <Outdent className="h-3.5 w-3.5" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 10. Blocks & Code */}
            <ToolbarButton onClick={() => applyLinePrefix('> ', /^>\s+/)} title="Blockquote">
              <Quote className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => applyWrap('`', '`')} title="Inline Code">
              <Code className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => applyWrap('```\n', '\n```')} title="Code Block">
              <SquareCode className="h-3.5 w-3.5" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 11. Inserts: Link, Image, Table */}
            <ToolbarButton onClick={handleInsertLink} title="Insert Link">
              <Link2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleInsertImage} title="Insert Image">
              <ImageIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleInsertTable} title="Insert Table">
              <TableIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={handleClearFormatting} title="Clear Formatting">
              <RemoveFormatting className="h-3.5 w-3.5" />
            </ToolbarButton>

            <ToolbarSeparator />

            {/* 12. Utilities & View Toggles */}
            <ToolbarButton
              onClick={() => {
                if (editorViewRef.current) openSearchPanel(editorViewRef.current);
              }}
              title="Find & Replace"
              shortcut="Ctrl+F"
            >
              <Search className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={handleToggleWordWrap}
              title="Word Wrap"
              isActive={wordWrap}
            >
              <WrapText className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={handleToggleLineNumbers}
              title="Line Numbers"
              isActive={showLineNumbers}
            >
              <Hash className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => setIsFocusMode(true)}
              title="Focus Mode"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={handleExportTxt}
              title="Export as .txt"
            >
              <Download className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={handlePrint}
              title="Print Note"
              shortcut="Ctrl+P"
            >
              <Printer className="h-3.5 w-3.5" />
            </ToolbarButton>
          </nav>

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
            Floating Canvas Writing Surface
            Subtle floating digital sheet with calm elevation and generous depth
            ========================================================================= */}
        <main
          className={cn(
            'flex-1 min-h-0 overflow-hidden relative cursor-text w-full flex justify-center items-stretch transition-all duration-200',
            isFocusMode ? 'p-4 sm:p-8' : 'p-3 sm:px-6 sm:py-4'
          )}
          onClick={() => {
            if (editorViewRef.current && !editorViewRef.current.hasFocus) {
              editorViewRef.current.focus();
            }
          }}
        >
          <div
            className={cn(
              'floating-canvas relative w-full max-w-4xl h-full flex flex-col rounded-2xl overflow-hidden',
              isFocusMode && 'shadow-2xl'
            )}
          >
            <div
              ref={editorContainerRef}
              className="h-full w-full focus:outline-none"
            />
          </div>
        </main>

        {/* =========================================================================
            Subtle Full-Width Bottom Status Bar
            ========================================================================= */}
        <footer
          className={cn(
            'flex h-7 w-full items-center justify-between border-t border-zinc-200/80 dark:border-zinc-800/60 bg-[#f3f4f7]/90 dark:bg-[#090d16]/90 backdrop-blur-md px-4 sm:px-6 text-[11px] text-zinc-400 dark:text-zinc-500 select-none shrink-0 no-print transition-all duration-300',
            isFocusMode && 'opacity-20 hover:opacity-95'
          )}
        >
          <div className="flex items-center gap-3">
            <span>{stats.wordCount} words</span>
            <span>·</span>
            <span>{stats.charCount} characters</span>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span>
              Ln {stats.line}, Col {stats.col}
            </span>
            <span>·</span>
            <span className="capitalize">{saveStatus}</span>
          </div>
        </footer>

        {/* Keyboard Shortcuts Dialog */}
        <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-medium">Keyboard Shortcuts</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Quick commands for fluid, distraction-free writing
              </DialogDescription>
            </DialogHeader>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs my-2">
              <div className="flex justify-between py-2">
                <span className="text-zinc-600 dark:text-zinc-400">Save immediately</span>
                <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Ctrl / ⌘ + S</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-600 dark:text-zinc-400">Bold / Italic / Underline</span>
                <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Ctrl + B / I / U</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-600 dark:text-zinc-400">Strikethrough</span>
                <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Ctrl + Shift + X</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-600 dark:text-zinc-400">Find & Replace</span>
                <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Ctrl / ⌘ + F</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-600 dark:text-zinc-400">Print Note</span>
                <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Ctrl / ⌘ + P</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-600 dark:text-zinc-400">Exit Focus Mode</span>
                <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Esc</kbd>
              </div>
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
