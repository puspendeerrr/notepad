import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { titleToSlug, getUniqueSlug } from '@/lib/slug';
import { NoteType } from '@/types';

interface NoteRecord {
  id: string;
  user_id: string;
  title: string;
  slug?: string;
  note_type?: NoteType;
  content: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const serverClient = await createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try selecting notes including note_type and slug
    let rawNotes: NoteRecord[] | null = null;
    const queryResult = await serverClient
      .from('notes')
      .select('id, user_id, title, slug, note_type, content, created_at, updated_at, last_opened_at')
      .order('updated_at', { ascending: false });

    let queryError = queryResult.error;

    if (queryResult.error && queryResult.error.code === '42703') {
      // Fallback if note_type or slug column not yet added in database
      const fallback = await serverClient
        .from('notes')
        .select('id, user_id, title, content, created_at, updated_at, last_opened_at')
        .order('updated_at', { ascending: false });
      rawNotes = (fallback.data as unknown as NoteRecord[]) || null;
      queryError = fallback.error;
    } else {
      rawNotes = (queryResult.data as unknown as NoteRecord[]) || null;
    }

    if (queryError) {
      console.error('Error fetching notes:', queryError);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    // Ensure all notes have a valid slug and note_type
    const notes = (rawNotes || []).map((n: NoteRecord) => {
      const isHandwritten =
        n.note_type === 'handwritten' ||
        (typeof n.content === 'string' &&
          n.content.trim().startsWith('{') &&
          n.content.includes('"pages"'));
      return {
        ...n,
        slug: n.slug || titleToSlug(n.title),
        note_type: isHandwritten ? 'handwritten' : (n.note_type || 'text'),
      };
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Notes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const serverClient = await createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let title = 'Untitled Note';
    let content = '';
    let note_type: NoteType = 'text';

    try {
      const body = await request.json();
      if (body.title && typeof body.title === 'string') {
        title = body.title.trim() || 'Untitled Note';
      }
      if (body.content && typeof body.content === 'string') {
        content = body.content;
      }
      if (body.note_type === 'handwritten' || body.note_type === 'text') {
        note_type = body.note_type;
      }
    } catch {
      // Empty body is valid for default new note
    }

    // Default structure for handwritten notebook if content empty
    if (note_type === 'handwritten' && (!content || content.trim() === '')) {
      content = JSON.stringify({
        version: 1,
        pages: [
          {
            id: 'page-1',
            template: 'ruled',
            paperColor: '#ffffff',
            strokes: [],
            shapes: [],
            textBoxes: [],
            images: [],
          },
        ],
        currentPageIndex: 0,
      });
    }

    const uniqueSlug = await getUniqueSlug(serverClient, user.id, title);

    // Try inserting with slug and note_type
    let insertResult = await serverClient
      .from('notes')
      .insert({
        user_id: user.id,
        title,
        content,
        slug: uniqueSlug,
        note_type,
      })
      .select()
      .single();

    if (
      insertResult.error &&
      (insertResult.error.code === 'PGRST204' ||
        insertResult.error.code === '42703' ||
        insertResult.error.message?.includes('note_type'))
    ) {
      // Fallback if note_type column does not exist yet in DB schema cache
      insertResult = await serverClient
        .from('notes')
        .insert({
          user_id: user.id,
          title,
          content,
          slug: uniqueSlug,
        })
        .select()
        .single();
    }

    if (insertResult.error || !insertResult.data) {
      console.error('Error creating note:', insertResult.error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    const createdNote = {
      ...insertResult.data,
      slug: insertResult.data.slug || uniqueSlug,
      note_type: insertResult.data.note_type || note_type,
    };

    return NextResponse.json({ note: createdNote }, { status: 201 });
  } catch (error) {
    console.error('Notes POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
