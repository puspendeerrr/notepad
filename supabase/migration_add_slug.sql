-- ==============================================================================
-- Migration: Add slug column to notes table & create index
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Add slug column
alter table public.notes add column if not exists slug text not null default 'untitled-note';

-- 2. Backfill slugs from existing note titles
update public.notes 
set slug = lower(regexp_replace(trim(title), '[^a-zA-Z0-9]+', '-', 'g'))
where slug = 'untitled-note' and title != 'Untitled Note';

update public.notes
set slug = 'untitled-note'
where slug is null or slug = '' or slug = '-';

-- 3. Create index for fast per-user slug lookups
create index if not exists idx_notes_user_slug on public.notes (user_id, slug);
