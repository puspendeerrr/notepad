import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { titleToSlug, getUniqueSlug } from '@/lib/slug';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const serverClient = await createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Lookup either by UUID id or by slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    let query = serverClient.from('notes').select('*').eq('user_id', user.id);

    if (isUuid) {
      query = query.eq('id', slug);
    } else {
      query = query.eq('slug', slug);
    }

    let { data: note, error } = await query.maybeSingle();

    // Fallback: search all user notes if column missing or legacy title slug
    if (!note && !isUuid) {
      const { data: allNotes } = await serverClient
        .from('notes')
        .select('*')
        .eq('user_id', user.id);
      note = (allNotes || []).find((n) => (n.slug || titleToSlug(n.title)) === slug) || null;
      error = null;
    }

    if (error) {
      console.error('Error fetching note:', error);
      return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
    }

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const noteWithSlug = {
      ...note,
      slug: note.slug || titleToSlug(note.title),
    };

    // Update last_opened_at asynchronously
    serverClient
      .from('notes')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', note.id)
      .then(() => {});

    return NextResponse.json({ note: noteWithSlug });
  } catch (error) {
    console.error('Note GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const serverClient = await createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First locate target note securely by user_id and slug (or UUID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    let findQuery = serverClient.from('notes').select('*').eq('user_id', user.id);

    if (isUuid) {
      findQuery = findQuery.eq('id', slug);
    } else {
      findQuery = findQuery.eq('slug', slug);
    }

    const { data: initialNote, error: findError } = await findQuery.maybeSingle();
    let targetNote = initialNote;

    if (!targetNote && !isUuid) {
      const { data: allNotes } = await serverClient
        .from('notes')
        .select('*')
        .eq('user_id', user.id);
      targetNote = (allNotes || []).find((n) => (n.slug || titleToSlug(n.title)) === slug) || null;
    }

    if (findError) {
      console.error('Error locating note to patch:', findError);
      return NextResponse.json({ error: 'Failed to locate note' }, { status: 500 });
    }

    if (!targetNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    let newSlug = targetNote.slug || titleToSlug(targetNote.title);

    if (typeof body.title === 'string') {
      const cleanTitle = body.title.trim() || 'Untitled Note';
      updatePayload.title = cleanTitle;
      // Generate guaranteed unique slug for this user
      newSlug = await getUniqueSlug(serverClient, user.id, cleanTitle, targetNote.id);
      updatePayload.slug = newSlug;
    }

    if (typeof body.content === 'string') {
      updatePayload.content = body.content;
    }

    if (body.note_type === 'handwritten' || body.note_type === 'text') {
      updatePayload.note_type = body.note_type;
    }

    let { data: updatedNote, error: updateError } = await serverClient
      .from('notes')
      .update(updatePayload)
      .eq('id', targetNote.id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (
      updateError &&
      (updateError.code === 'PGRST204' ||
        updateError.code === '42703' ||
        updateError.message?.includes('note_type'))
    ) {
      delete updatePayload.note_type;
      const retry = await serverClient
        .from('notes')
        .update(updatePayload)
        .eq('id', targetNote.id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();
      updatedNote = retry.data;
      updateError = retry.error;
    }

    if (updateError || !updatedNote) {
      console.error('Error updating note:', updateError);
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    const noteWithSlug = {
      ...updatedNote,
      slug: updatedNote.slug || newSlug || titleToSlug(updatedNote.title),
      note_type:
        updatedNote.note_type ||
        body.note_type ||
        (typeof updatedNote.content === 'string' &&
        updatedNote.content.trim().startsWith('{') &&
        updatedNote.content.includes('"pages"')
          ? 'handwritten'
          : 'text'),
    };

    return NextResponse.json({ note: noteWithSlug });
  } catch (error) {
    console.error('Note PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const serverClient = await createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    let deleteQuery = serverClient.from('notes').delete().eq('user_id', user.id);

    if (isUuid) {
      deleteQuery = deleteQuery.eq('id', slug);
    } else {
      deleteQuery = deleteQuery.eq('slug', slug);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('Error deleting note:', error);
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Note DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
