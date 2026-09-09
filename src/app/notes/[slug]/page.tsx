import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { HandwrittenEditor } from '@/components/editor/handwritten/handwritten-editor';
import { titleToSlug } from '@/lib/slug';
import { Button } from '@/components/ui/button';
import { FileQuestion, Plus, ArrowLeft } from 'lucide-react';
import { NoteType } from '@/types';

interface NotePageProps {
  params: Promise<{ slug: string }>;
}

interface NoteItem {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  note_type?: NoteType;
  content: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
}

export const dynamic = 'force-dynamic';

export default async function NotePage({ params }: NotePageProps) {
  const { slug } = await params;
  const serverClient = await createClient();

  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let note: NoteItem | null = null;

  // 1. Backward compatibility: check if requested slug is an existing UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  if (isUuid) {
    const { data: noteById } = await serverClient
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', slug)
      .maybeSingle();

    if (noteById) {
      const canonicalSlug = noteById.slug || titleToSlug(noteById.title);
      redirect(`/notes/${canonicalSlug}`);
    }
  }

  // 2. Direct lookup by user_id and slug
  if (!note) {
    const { data: noteBySlug } = await serverClient
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('slug', slug)
      .maybeSingle();

    if (noteBySlug) {
      note = noteBySlug;
    }
  }

  // 3. Fallback: search all notes for matching title slug
  if (!note) {
    const { data: allUserNotes } = await serverClient
      .from('notes')
      .select('*')
      .eq('user_id', user.id);

    if (allUserNotes) {
      const matched = allUserNotes.find(
        (n) => (n.slug || titleToSlug(n.title)) === slug
      );
      if (matched) {
        note = matched;
      }
    }
  }

  // 4. Truly not found -> Show helpful Note Not Found view
  if (!note) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 mb-4">
            <FileQuestion className="h-6 w-6" />
          </div>

          <h1 className="text-lg font-semibold tracking-tight">Note Not Found</h1>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            We couldn’t find a note matching <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px]">{slug}</code>.
            It may have been renamed, deleted, or belongs to another account.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto text-xs gap-1.5">
              <Link href="/notes">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>All Notes</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="w-full sm:w-auto text-xs gap-1.5">
              <Link href="/notes?action=new">
                <Plus className="h-3.5 w-3.5" />
                <span>Create New Note</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Ensure note has a valid slug attached
  note.slug = note.slug || titleToSlug(note.title);

  // Fetch user preferences for editor
  const { data: settings } = await serverClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const isHandwritten =
    note.note_type === 'handwritten' ||
    (typeof note.content === 'string' &&
      note.content.trim().startsWith('{') &&
      note.content.includes('"pages"'));

  if (isHandwritten) {
    note.note_type = 'handwritten';
    return (
      <HandwrittenEditor
        initialNote={note}
        userId={user.id}
        initialSettings={settings || undefined}
      />
    );
  }

  return (
    <TiptapEditor
      initialNote={note}
      userId={user.id}
      initialSettings={settings || undefined}
    />
  );
}
