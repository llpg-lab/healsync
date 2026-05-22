-- HealSync production schema for Supabase Postgres.
-- This keeps the app's current custom username/password login system.
-- Run this in the Supabase SQL Editor before deploying the backend.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id text primary key,
  username text not null unique,
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.auth_sessions (
  token text primary key,
  user_id text not null references public.users(id) on delete cascade,
  created_at text not null
);

create table if not exists public.profiles (
  user_id text primary key references public.users(id) on delete cascade,
  gender text,
  age text,
  height text,
  weight text,
  taste text not null default '[]',
  allergies text not null default '[]',
  conditions text not null default '[]',
  fitness_goal text,
  created_at text not null,
  updated_at text not null
);

create table if not exists public.diet_suggestions (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  ingredients text,
  mood text,
  note text,
  decision text,
  score integer check (score is null or score between 0 and 100),
  request_payload text,
  created_at text not null
);

create table if not exists public.diet_records (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  food_identification text not null default '[]',
  analysis text not null default '{}',
  score integer check (score is null or score between 0 and 100),
  model_used text,
  image_count integer not null default 0,
  created_at text not null
);

create table if not exists public.diet_record_images (
  id text primary key,
  record_id text not null references public.diet_records(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  image_url text not null,
  created_at text not null
);

create index if not exists idx_suggestions_user_created
  on public.diet_suggestions(user_id, created_at);

create index if not exists idx_records_user_created
  on public.diet_records(user_id, created_at);

create index if not exists idx_record_images_record
  on public.diet_record_images(record_id);
