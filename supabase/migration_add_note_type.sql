-- ==============================================================================
-- Migration: Add note_type column to notes table
-- Supports: 'text' (default) and 'handwritten' (iPad Apple Pencil notebook)
-- ==============================================================================

alter table public.notes
  add column if not exists note_type text not null default 'text' check (note_type in ('text', 'handwritten'));
