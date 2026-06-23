 -- Supabase SQL Editor에서 실행

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  device_id text unique,
  display_name text not null default '커피 농부',
  source text not null default 'guest',
  toss_user_key text unique,
  toss_refresh_token text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_states (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  growth numeric not null default 0 check (growth >= 0 and growth <= 100),
  money integer not null default 0 check (money >= 0),
  total_coffees integer not null default 0 check (total_coffees >= 0),
  total_waters integer not null default 0 check (total_waters >= 0),
  redeemed boolean not null default false,
  water_day_key text not null default '',
  waters_today integer not null default 0 check (waters_today >= 0),
  ad_water_credits integer not null default 0 check (ad_water_credits >= 0),
  growth_accrual_synced_at timestamptz not null default now(),
  passive_day_key text not null default '',
  daily_passive_growth numeric not null default 0 check (daily_passive_growth >= 0),
  selected_coffee_variant text not null default 'parttime-latte',
  owned_coffee_variants text[] not null default array['parttime-latte']::text[],
  spent_coffee_cups integer not null default 0 check (spent_coffee_cups >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists game_states_money_idx on public.game_states (money desc);

create table if not exists public.rankings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  spent_coffee_cups integer not null default 0 check (spent_coffee_cups >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists rankings_spent_coffee_cups_idx on public.rankings (spent_coffee_cups desc);

alter table public.profiles enable row level security;
alter table public.game_states enable row level security;
alter table public.rankings enable row level security;

-- 기존 total_taps 컬럼이 있다면:
-- alter table public.game_states rename column total_taps to total_waters;

-- 기존 DB 마이그레이션 (이미 테이블이 있는 경우):
-- alter table public.profiles add column if not exists toss_refresh_token text;
-- alter table public.game_states add column if not exists water_day_key text not null default '';
-- alter table public.game_states add column if not exists waters_today integer not null default 0;
-- alter table public.game_states add column if not exists ad_water_credits integer not null default 0;
-- alter table public.game_states add column if not exists growth_accrual_synced_at timestamptz not null default now();
-- alter table public.game_states add column if not exists passive_day_key text not null default '';
-- alter table public.game_states add column if not exists daily_passive_growth numeric not null default 0;
-- alter table public.game_states add column if not exists selected_coffee_variant text not null default 'parttime-latte';
-- alter table public.game_states add column if not exists owned_coffee_variants text[] not null default array['parttime-latte']::text[];
-- alter table public.game_states add column if not exists spent_coffee_cups integer not null default 0 check (spent_coffee_cups >= 0);
-- create index if not exists game_states_emptied_cups_idx on public.game_states (spent_coffee_cups desc);
-- alter table public.game_states alter column growth type numeric using growth::numeric;
