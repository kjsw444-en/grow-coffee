-- Supabase SQL Editor에서 실행

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  device_id text unique,
  display_name text not null default '커피 농부',
  source text not null default 'guest',
  toss_user_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.game_states (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  growth integer not null default 0 check (growth >= 0 and growth <= 100),
  money integer not null default 0 check (money >= 0),
  total_coffees integer not null default 0 check (total_coffees >= 0),
  total_waters integer not null default 0 check (total_waters >= 0),
  redeemed boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists game_states_money_idx on public.game_states (money desc);

alter table public.profiles enable row level security;
alter table public.game_states enable row level security;

-- 기존 total_taps 컬럼이 있다면:
-- alter table public.game_states rename column total_taps to total_waters;
