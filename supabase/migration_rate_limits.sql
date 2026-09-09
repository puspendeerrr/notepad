-- ==============================================================================
-- Migration: Add rate_limits table for persistent serverless rate limiting
-- ==============================================================================

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  action text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Compound index for fast sliding window queries
create index if not exists idx_rate_limits_key_action_created 
on public.rate_limits (key, action, created_at desc);

-- Enable Row Level Security
alter table public.rate_limits enable row level security;

-- IMPORTANT: No public RLS policies are created for public.rate_limits.
-- This ensures anonymous/client requests cannot read or tamper with rate limits.
-- All rate limit queries and insertions execute server-side using Supabase Admin / Service Role client.
