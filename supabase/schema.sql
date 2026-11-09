-- ============================================================================
-- RUNDOWNKU (Stippl-Style Multi-Day Itinerary Planner) - Supabase SQL Schema
-- Cara Pakai:
-- 1. Buka dashboard Supabase project Anda -> menu "SQL Editor"
-- 2. Klik "New Query", tempel seluruh isi file ini, lalu klik "Run"
-- ============================================================================

-- 1. Tabel Trips (Daftar Perjalanan / Rundown)
create table if not exists public.trips (
  id text primary key,
  title text not null default 'Rundown Baru',
  description text not null default '',
  start_date text not null default '',
  end_date text not null default '',
  days_count integer not null default 1,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- 2. Tabel Events (Titik Destinasi & Agenda per Hari)
create table if not exists public.events (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  day_number integer not null default 1,
  title text not null,
  start_time text not null,
  end_time text not null default '',
  category text not null default 'wisata',
  location_name text not null default '',
  lat double precision,
  lng double precision,
  notes text not null default '',
  estimated_cost numeric not null default 0,
  completed boolean not null default false,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Index untuk mempercepat query berdasarkan trip_id dan urutan hari/waktu
create index if not exists idx_events_trip_id on public.events(trip_id);
create index if not exists idx_events_trip_day_time on public.events(trip_id, day_number, start_time);
create index if not exists idx_trips_updated_at on public.trips(updated_at desc);

-- Aktifkan Row Level Security (RLS)
alter table public.trips enable row level security;
alter table public.events enable row level security;

-- Policy akses publik (agar bisa langsung digunakan dengan VITE_SUPABASE_ANON_KEY tanpa wajib login)
-- Jika ke depannya menggunakan Supabase Auth, Anda dapat mengganti `using (true)` dengan `using (auth.uid() = user_id)`
drop policy if exists "Allow public access to trips" on public.trips;
create policy "Allow public access to trips"
  on public.trips
  for all
  using (true)
  with check (true);

drop policy if exists "Allow public access to events" on public.events;
create policy "Allow public access to events"
  on public.events
  for all
  using (true)
  with check (true);
