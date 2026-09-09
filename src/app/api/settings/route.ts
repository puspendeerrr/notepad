import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: initialSettings, error } = await serverClient
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    let settings = initialSettings;

    if (error) {
      console.error('Error fetching settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    if (!settings) {
      // Create defaults if not found
      const defaultSettings = {
        user_id: user.id,
        theme: 'system',
        font_size: 16,
        font_family: 'sans',
        word_wrap: true,
        line_numbers: false,
      };

      const { data: created, error: createError } = await serverClient
        .from('user_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (!createError && created) {
        settings = created;
      }
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const serverClient = await createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (['light', 'dark', 'system'].includes(body.theme)) {
      updatePayload.theme = body.theme;
    }

    if (typeof body.font_size === 'number' && body.font_size >= 12 && body.font_size <= 28) {
      updatePayload.font_size = body.font_size;
    }

    if (['sans', 'mono'].includes(body.font_family)) {
      updatePayload.font_family = body.font_family;
    }

    if (typeof body.word_wrap === 'boolean') {
      updatePayload.word_wrap = body.word_wrap;
    }

    if (typeof body.line_numbers === 'boolean') {
      updatePayload.line_numbers = body.line_numbers;
    }

    const { data: settings, error } = await serverClient
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...updatePayload,
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
