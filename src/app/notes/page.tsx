'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Note } from '@/types';
import { formatDate, countWords } from '@/lib/utils';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  Loader2,
  ArrowUpDown,
  FilePlus,
  PenTool,
} from 'lucide-react';
import { CreateNoteModal } from '@/components/notes/create-note-modal';
import { NoteType } from '@/types';

type SortOption = 'updated' | 'created' | 'title';

export default function NotesPage() {
  const router = useRouter();
  const { setTheme } = useTheme();

  const [notes, setNotes] = useState<Note[]>([]);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Modals state
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [noteToRename, setNoteToRename] = useState<Note | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Fetch notes on mount
  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();

    // Fetch user info & restore saved theme from database
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.theme) {
          setTheme(data.settings.theme);
        }
        if (data.username) {
          setUsername(data.username);
        }
      })
      .catch(() => {});
  }, [setTheme]);

  // Handler: Create New Note
  const handleCreateNote = async (type: NoteType = 'text') => {
    if (creating) return;
    setCreating(true);

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Note',
          note_type: type,
          content: '',
        }),
      });

      const data = await res.json();
      if (data.note && data.note.slug) {
        router.push(`/notes/${data.note.slug}`);
      } else if (data.note) {
        router.push(`/notes/${data.note.id}`);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
      setCreating(false);
    }
  };

  // Check if query param triggered new note creation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'new') {
        setCreateModalOpen(true);
      }
    }
  }, []);

  // Handler: Duplicate Note
  const handleDuplicate = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${note.title} (Copy)`,
          content: note.content,
        }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes((prev) => [data.note, ...prev]);
      }
    } catch (err) {
      console.error('Failed to duplicate note:', err);
    }
  };

  // Handler: Confirm Delete
  const handleDelete = async () => {
    if (!noteToDelete) return;
    setIsDeleting(true);

    try {
      const targetSlug = noteToDelete.slug || noteToDelete.id;
      await fetch(`/api/notes/${encodeURIComponent(targetSlug)}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      setNoteToDelete(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler: Confirm Rename
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteToRename || !renameTitle.trim()) return;
    setIsRenaming(true);

    try {
      const targetSlug = noteToRename.slug || noteToRename.id;
      const res = await fetch(`/api/notes/${encodeURIComponent(targetSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === data.note.id
              ? { ...n, title: data.note.title, slug: data.note.slug || n.slug }
              : n
          )
        );
        setNoteToRename(null);
      }
    } catch (err) {
      console.error('Failed to rename note:', err);
    } finally {
      setIsRenaming(false);
    }
  };

  // Filtered & Sorted Notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Search query filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'updated') {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      if (sortBy === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return result;
  }, [notes, searchQuery, sortBy]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <Navbar username={username}>
        {/* Search Input embedded in Header */}
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs bg-zinc-100 dark:bg-zinc-900 border-transparent focus-visible:border-zinc-300 dark:focus-visible:border-zinc-700"
          />
        </div>
      </Navbar>

      {/* Main Container - Spans full width without restrictive max-width */}
      <main className="flex-1 w-full px-4 sm:px-6 md:px-8 lg:px-10 py-6 min-w-0">
        {/* Top Controls Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              All Notes
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'} stored securely
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Sorting Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <ArrowUpDown className="h-3 w-3" />
                  <span>
                    {sortBy === 'updated'
                      ? 'Last edited'
                      : sortBy === 'created'
                      ? 'Date created'
                      : 'Title'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('updated')} className="text-xs">
                  Last edited
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('created')} className="text-xs">
                  Date created
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('title')} className="text-xs">
                  Title (A–Z)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* + New Note Button */}
            <Button
              onClick={() => setCreateModalOpen(true)}
              disabled={creating}
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>New Note</span>
            </Button>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <p className="text-xs text-zinc-400 mt-2">Loading your notes…</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="rounded-full bg-zinc-100 dark:bg-zinc-900 p-3 mb-3 border border-zinc-200 dark:border-zinc-800">
              <FilePlus className="h-6 w-6 text-zinc-400" />
            </div>
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {searchQuery ? 'No matching notes found' : 'No notes yet'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mt-1">
              {searchQuery
                ? 'Try a different search term.'
                : 'Create your first note to start writing in a calm, distraction-free environment.'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setCreateModalOpen(true)}
                disabled={creating}
                size="sm"
                className="mt-4 text-xs gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create your first note</span>
              </Button>
            )}
          </div>
        ) : (
          /* Notes Grid / List - Fully responsive multi-column layout */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pt-6">
            {filteredNotes.map((note) => {
              const preview = note.content ? note.content.trim() : 'Empty note';
              const words = countWords(note.content);

              return (
                <div
                  key={note.id}
                  onClick={() => router.push(`/notes/${note.slug || note.id}`)}
                  className="group relative flex flex-col justify-between rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 p-4 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm cursor-pointer select-none"
                >
                  <div>
                    {/* Card Top: Title & Actions Menu */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-zinc-900 dark:group-hover:text-white">
                        {note.title || 'Untitled Note'}
                      </h3>

                      {/* 3-Dot Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 -mr-1 -mt-1 opacity-60 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoteToRename(note);
                              setRenameTitle(note.title);
                            }}
                            className="gap-2 text-xs"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleDuplicate(note, e)}
                            className="gap-2 text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoteToDelete(note);
                            }}
                            className="gap-2 text-xs text-red-600 dark:text-red-400 focus:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Content Preview */}
                    {note.note_type === 'handwritten' ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium min-h-[2.25rem]">
                        <PenTool className="h-3.5 w-3.5" />
                        <span>Handwritten Notebook</span>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed min-h-[2.25rem]">
                        {preview}
                      </p>
                    )}
                  </div>

                  {/* Card Bottom: Metadata */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 pt-3 mt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                    <span>{formatDate(note.updated_at)}</span>
                    <span>{note.note_type === 'handwritten' ? 'Notebook' : `${words} ${words === 1 ? 'word' : 'words'}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Rename Dialog */}
      <Dialog
        open={Boolean(noteToRename)}
        onOpenChange={(open) => !open && setNoteToRename(null)}
      >
        <DialogContent className="max-w-sm">
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle className="text-base">Rename Note</DialogTitle>
              <DialogDescription className="text-xs">
                Enter a new title for this note
              </DialogDescription>
            </DialogHeader>

            <div className="py-3">
              <Input
                type="text"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder="Untitled Note"
                className="text-xs"
                autoFocus
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNoteToRename(null)}
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isRenaming}>
                {isRenaming ? 'Saving…' : 'Rename'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(noteToDelete)}
        onOpenChange={(open) => !open && setNoteToDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-red-600 dark:text-red-500">
              Delete Note?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete &ldquo;{noteToDelete?.title}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNoteToDelete(null)}
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

      {/* Create Note Choice Modal */}
      <CreateNoteModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSelectType={(type) => {
          setCreateModalOpen(false);
          handleCreateNote(type);
        }}
        loading={creating}
      />
    </div>
  );
}
