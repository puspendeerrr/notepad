-- ==============================================================================
-- Migration: Add unique per-user slug index to notes table
-- ==============================================================================

-- 1. Ensure slug column is not null with default
alter table public.notes
  alter column slug set default 'untitled-note';

update public.notes
set slug = 'untitled-note'
where slug is null or trim(slug) = '';

alter table public.notes
  alter column slug set not null;

-- 2. Create unique index per user
create unique index if not exists notes_user_slug_unique
on public.notes (user_id, slug);
