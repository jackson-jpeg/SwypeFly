-- ============================================================
-- SoGoJet — Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── User Preferences ─────────────────────────────────────────
create table if not exists user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  traveler_type text check (traveler_type in ('beach', 'city', 'adventure', 'culture')),
  budget_level text check (budget_level in ('budget', 'comfortable', 'luxury')),
  departure_city text default 'Tampa',
  departure_code text default 'TPA',
  currency text default 'USD',
  has_completed_onboarding boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Swipe History ────────────────────────────────────────────
create table if not exists swipe_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  destination_id text not null,
  action text check (action in ('viewed', 'skipped', 'saved')) not null,
  created_at timestamptz default now()
);

create index if not exists idx_swipe_history_user on swipe_history(user_id);
create index if not exists idx_swipe_history_dest on swipe_history(destination_id);

-- ── Saved Trips ──────────────────────────────────────────────
create table if not exists saved_trips (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  destination_id text not null,
  saved_at timestamptz default now(),
  unique(user_id, destination_id)
);

create index if not exists idx_saved_trips_user on saved_trips(user_id);

-- ── Cached Prices ────────────────────────────────────────────
create table if not exists cached_prices (
  id uuid primary key default uuid_generate_v4(),
  origin text not null,
  destination_iata text not null,
  price numeric not null,
  currency text default 'USD',
  airline text,
  duration text,
  fetched_at timestamptz default now(),
  unique(origin, destination_iata)
);

create index if not exists idx_cached_prices_origin on cached_prices(origin);

-- ── Row Level Security ───────────────────────────────────────

-- user_preferences: users can only read/write their own row
alter table user_preferences enable row level security;

create policy "Users can read own preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on user_preferences for update
  using (auth.uid() = user_id);

-- swipe_history: users can only read/write their own history
alter table swipe_history enable row level security;

create policy "Users can read own swipe history"
  on swipe_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own swipe history"
  on swipe_history for insert
  with check (auth.uid() = user_id);

-- saved_trips: users can only manage their own saved trips
alter table saved_trips enable row level security;

create policy "Users can read own saved trips"
  on saved_trips for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved trips"
  on saved_trips for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saved trips"
  on saved_trips for delete
  using (auth.uid() = user_id);

-- cached_prices: readable by anyone (public cache)
alter table cached_prices enable row level security;

create policy "Anyone can read cached prices"
  on cached_prices for select
  using (true);

-- Only service role can write prices (via server/proxy)
create policy "Service role can manage cached prices"
  on cached_prices for all
  using (auth.role() = 'service_role');

-- ── Updated-at trigger ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_preferences_updated_at
  before update on user_preferences
  for each row execute function update_updated_at();
