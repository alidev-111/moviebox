-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Movies & Series Table
create table if not exists movies (
  id text primary key,
  title text not null,
  stream_url text not null,
  poster_url text default '',
  backdrop_url text default '',
  description text default '',
  genre text default 'Sci-Fi',
  release_year integer default 2024,
  duration text default '2h 10m',
  rating text default 'PG-13',
  subtitles jsonb default '[]'::jsonb,
  is_featured boolean default false,
  type text default 'movie',
  episodes jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Migration for existing installations:
alter table movies add column if not exists type text default 'movie';
alter table movies add column if not exists episodes jsonb default '[]'::jsonb;

-- Enable Row Level Security on movies
alter table movies enable row level security;

-- Policy 1: Everyone can read movies
drop policy if exists "Allow public read" on movies;
create policy "Allow public read"
  on movies for select
  using (true);

-- Policy 2: Allow service role full access to movies
drop policy if exists "Allow service role full access" on movies;
create policy "Allow service role full access"
  on movies for all
  using (auth.role() = 'service_role');


-- 2. Multi-Account Storage Buckets Table (Backblaze B2 / S3)
create table if not exists storage_buckets (
  id text primary key,
  label text not null,
  bucket_name text not null,
  key_id text not null,
  application_key text not null,
  endpoint text not null,
  is_active boolean default true,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security on storage_buckets
alter table storage_buckets enable row level security;

-- Policy 1: Service role has full access (Keys are never read by anonymous public)
drop policy if exists "Allow service role full access on storage_buckets" on storage_buckets;
create policy "Allow service role full access on storage_buckets"
  on storage_buckets for all
  using (auth.role() = 'service_role');
