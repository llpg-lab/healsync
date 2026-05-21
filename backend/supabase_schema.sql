-- Supabase/Postgres schema matching the local SQLite development database.
-- Run this in the Supabase SQL editor when moving from local development.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  gender text,
  age text,
  height text,
  weight text,
  taste jsonb not null default '[]'::jsonb,
  allergies jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  fitness_goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diet_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredients text,
  mood text,
  note text,
  decision jsonb,
  score integer check (score is null or score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.diet_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_identification jsonb not null default '[]'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  score integer check (score is null or score between 0 and 100),
  model_used text,
  image_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.diet_record_images (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.diet_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_diet_suggestions_user_created
  on public.diet_suggestions(user_id, created_at desc);

create index if not exists idx_diet_records_user_created
  on public.diet_records(user_id, created_at desc);

create index if not exists idx_diet_record_images_record
  on public.diet_record_images(record_id);

alter table public.profiles enable row level security;
alter table public.diet_suggestions enable row level security;
alter table public.diet_records enable row level security;
alter table public.diet_record_images enable row level security;

create policy "profiles own rows" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "diet_suggestions own rows" on public.diet_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "diet_records own rows" on public.diet_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "diet_record_images own rows" on public.diet_record_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
