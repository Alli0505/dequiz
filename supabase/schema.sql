-- DeQuiz — Supabase schema.
-- Run this once in your project's SQL Editor (Supabase dashboard → SQL Editor → New query).

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null,
  path       text not null default 'hero' check (path in ('hero', 'royal')),
  correct    integer not null default 0,
  quizzes    integer not null default 0,
  best       integer not null default 0,
  created_at timestamptz not null default now()
);

-- Case-insensitive unique nicknames (so "Abay" and "abay" can't both exist).
create unique index if not exists profiles_nickname_lower_key
  on public.profiles (lower(nickname));

-- Speeds up the leaderboard ordering.
create index if not exists profiles_correct_idx
  on public.profiles (correct desc);

alter table public.profiles enable row level security;

-- Anyone (including logged-out visitors) can read the leaderboard.
drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select using (true);

-- A signed-in user may create their own single profile row.
drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- A signed-in user may update only their own row.
drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
