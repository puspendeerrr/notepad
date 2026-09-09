import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Converts a raw title into a clean URL-friendly slug.
 * Example: "The savior" -> "the-savior"
 * Example: "My First Note!" -> "my-first-note"
 * Example: "" -> "untitled-note"
 */
export function titleToSlug(title?: string): string {
  if (!title || !title.trim()) {
    return 'untitled-note';
  }

  const slug = title
    .trim()
    .toLowerCase()
    .normalize('NFD') // normalize accented characters
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, ''); // trim leading & trailing hyphens

  return slug || 'untitled-note';
}

/**
 * Generates a unique slug for a given user.
 * If "the-savior" already exists, produces "the-savior-2", "the-savior-3", etc.
 */
export async function getUniqueSlug(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  excludeNoteId?: string
): Promise<string> {
  const baseSlug = titleToSlug(title);

  try {
    let query = supabase
      .from('notes')
      .select('id, slug, title')
      .eq('user_id', userId);

    if (excludeNoteId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(excludeNoteId);
      if (isUuid) {
        query = query.neq('id', excludeNoteId);
      } else {
        query = query.neq('slug', excludeNoteId);
      }
    }

    const { data, error } = await query;

    if (error || !data) {
      return baseSlug;
    }

    const existingSlugs = new Set<string>();
    for (const row of data) {
      if (row.slug) {
        existingSlugs.add(row.slug.toLowerCase());
      } else if (row.title) {
        existingSlugs.add(titleToSlug(row.title));
      }
    }

    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let counter = 2;
    while (existingSlugs.has(`${baseSlug}-${counter}`)) {
      counter++;
    }

    return `${baseSlug}-${counter}`;
  } catch {
    return baseSlug;
  }
}
