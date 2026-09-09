-- ==============================================================================
-- Supabase Schema for Notepad (notepad.puspender.in)
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ==============================================================================

-- 1. Enable pgcrypto extension for UUID generation if not enabled
create extension if not exists "pgcrypto";

-- 2. Clean up any existing objects (if re-running in dev)
-- drop table if exists public.notes cascade;
-- drop table if exists public.user_settings cascade;
-- drop table if exists public.user_accounts cascade;

-- ==============================================================================
-- Table: user_accounts
-- Stores mapping between Supabase auth users, internal User ID (username), and
-- the HMAC-SHA-256 hashed recovery key.
-- ==============================================================================
create table if not exists public.user_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  recovery_key_hash text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint username_length_check check (char_length(username) >= 3 and char_length(username) <= 32),
  constraint username_format_check check (username ~ '^[a-z0-9_]+$')
);

-- ==============================================================================
-- Table: user_settings
-- Stores user editor preferences and appearance settings.
-- ==============================================================================
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  font_size integer not null default 16 check (font_size >= 12 and font_size <= 28),
  font_family text not null default 'sans' check (font_family in ('sans', 'mono')),
  word_wrap boolean not null default true,
  line_numbers boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- ==============================================================================
-- Table: notes
-- Stores individual plain-text notes created by authenticated users.
-- ==============================================================================
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Note',
  slug text not null default 'untitled-note',
  content text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  last_opened_at timestamptz not null default timezone('utc'::text, now())
);

-- Index for fast user notes listing sorted by last updated
create index if not exists idx_notes_user_updated on public.notes (user_id, updated_at desc);
create unique index if not exists notes_user_slug_unique on public.notes (user_id, slug);
create index if not exists idx_user_accounts_username on public.user_accounts (username);

-- ==============================================================================
-- Function: Auto-update updated_at timestamp
-- ==============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers
drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row
  execute function public.handle_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row
  execute function public.handle_updated_at();

drop trigger if exists set_user_accounts_updated_at on public.user_accounts;
create trigger set_user_accounts_updated_at
  before update on public.user_accounts
  for each row
  execute function public.handle_updated_at();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================
alter table public.notes enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_accounts enable row level security;

-- Policies for notes:
-- Users can only view, insert, update, and delete their own notes
drop policy if exists "Users can select their own notes" on public.notes;
create policy "Users can select their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own notes" on public.notes;
create policy "Users can insert their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notes" on public.notes;
create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notes" on public.notes;
create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Policies for user_settings:
-- Users can only view, insert, and update their own settings
drop policy if exists "Users can select their own settings" on public.user_settings;
create policy "Users can select their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own settings" on public.user_settings;
create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policies for user_accounts:
-- Users can only select their own id and username (NEVER recovery_key_hash via client)
-- Inserts, updates to recovery key, and admin verification happen exclusively
-- via server-side API routes using the Supabase Service Role Key or protected functions.
drop policy if exists "Users can read their own account info" on public.user_accounts;
create policy "Users can read their own account info"
  on public.user_accounts for select
  using (auth.uid() = id);

-- Note: In public schema, clients should select id, username, created_at only.
-- Service role bypasses RLS for password reset and key generation operations.

-- ==============================================================================
-- Table: rate_limits
-- Stores rate limit events for persistent rate limiting on serverless platforms (Vercel)
-- ==============================================================================
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  action text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_rate_limits_key_action_created 
on public.rate_limits (key, action, created_at desc);

-- Enable RLS (No public policies: only Service Role client can query or insert)
alter table public.rate_limits enable row level security;

