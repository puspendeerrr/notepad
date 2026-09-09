import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { titleToSlug, getUniqueSlug } from '@/lib/slug';

interface NoteRecord {
  id: string;
  user_id: string;
  title: string;
  slug?: string;
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

    // Try selecting with slug column
    let rawNotes: NoteRecord[] | null = null;
    const queryResult = await serverClient
      .from('notes')
      .select('id, user_id, title, slug, content, created_at, updated_at, last_opened_at')
      .order('updated_at', { ascending: false });

    let queryError = queryResult.error;

    if (queryResult.error && queryResult.error.code === '42703') {
      // Fallback if slug column not yet added in database
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

    // Ensure all notes have a valid slug
    const notes = (rawNotes || []).map((n: NoteRecord) => ({
      ...n,
      slug: n.slug || titleToSlug(n.title),
    }));

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

    try {
      const body = await request.json();
      if (body.title && typeof body.title === 'string') {
        title = body.title.trim() || 'Untitled Note';
      }
      if (body.content && typeof body.content === 'string') {
        content = body.content;
      }
    } catch {
      // Empty body is valid for default new note
    }

    const uniqueSlug = await getUniqueSlug(serverClient, user.id, title);

    // Try inserting with slug
    let insertResult = await serverClient
      .from('notes')
      .insert({
        user_id: user.id,
        title,
        content,
        slug: uniqueSlug,
      })
      .select()
      .single();

    if (insertResult.error && insertResult.error.code === '42703') {
      // Fallback if column does not exist yet in DB
      insertResult = await serverClient
        .from('notes')
        .insert({
          user_id: user.id,
          title,
          content,
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
    };

    return NextResponse.json({ note: createdNote }, { status: 201 });
  } catch (error) {
    console.error('Notes POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
