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
  passive_coffees_claimed integer not null default 0 check (passive_coffees_claimed >= 0 and passive_coffees_claimed <= 2),
  selected_coffee_variant text not null default 'parttime-latte',
  owned_coffee_variants text[] not null default array['parttime-latte']::text[],
  spent_coffee_cups integer not null default 0 check (spent_coffee_cups >= 0),
  daily_brewed_spent_day_key text not null default '',
  daily_brewed_spent integer not null default 0 check (daily_brewed_spent >= 0),
  daily_brewed_received_day_key text not null default '',
  daily_brewed_received integer not null default 0 check (daily_brewed_received >= 0),
  share_reward_day_key text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists game_states_money_idx on public.game_states (money desc);

create table if not exists public.rankings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  spent_coffee_cups integer not null default 0 check (spent_coffee_cups >= 0),
  day_key text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists rankings_spent_coffee_cups_idx on public.rankings (spent_coffee_cups desc);
create index if not exists rankings_day_score_idx on public.rankings (day_key, spent_coffee_cups desc);

create table if not exists public.ranking_daily_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_key text not null,
  display_name text not null,
  spent_coffee_cups integer not null default 0 check (spent_coffee_cups >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day_key)
);

create index if not exists ranking_daily_entries_day_score_idx on public.ranking_daily_entries (day_key, spent_coffee_cups desc);

create table if not exists public.promotion_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  claim_type text not null,
  day_key text not null,
  reward_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, claim_type, day_key)
);

alter table public.profiles enable row level security;
alter table public.game_states enable row level security;
alter table public.rankings enable row level security;
alter table public.promotion_claims enable row level security;

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
-- alter table public.game_states add column if not exists daily_brewed_spent_day_key text not null default '';
-- alter table public.game_states add column if not exists daily_brewed_spent integer not null default 0 check (daily_brewed_spent >= 0);
-- alter table public.rankings add column if not exists day_key text not null default '';
-- create index if not exists rankings_day_score_idx on public.rankings (day_key, spent_coffee_cups desc);
-- create index if not exists game_states_emptied_cups_idx on public.game_states (spent_coffee_cups desc);
-- alter table public.game_states alter column growth type numeric using growth::numeric;
-- alter table public.game_states add column if not exists share_reward_day_key text not null default '';
-- alter table public.game_states add column if not exists passive_coffees_claimed integer not null default 0 check (passive_coffees_claimed >= 0 and passive_coffees_claimed <= 2);

alter table public.game_states add column if not exists share_reward_day_key text not null default '';

alter table public.game_states add column if not exists passive_coffees_claimed integer not null default 0 check (passive_coffees_claimed >= 0 and passive_coffees_claimed <= 2);

alter table public.game_states add column if not exists passive_reactivate_day_key text not null default '';

alter table public.game_states add column if not exists lifetime_drunk_coffees integer not null default 0 check (lifetime_drunk_coffees >= 0);

alter table public.game_states add column if not exists lifetime_brewed_spent integer not null default 0 check (lifetime_brewed_spent >= 0);

-- 일일 랭킹 (KST en-CA)
alter table public.game_states add column if not exists daily_brewed_spent_day_key text not null default '';
alter table public.game_states add column if not exists daily_brewed_spent integer not null default 0 check (daily_brewed_spent >= 0);
alter table public.game_states add column if not exists daily_brewed_received_day_key text not null default '';
alter table public.game_states add column if not exists daily_brewed_received integer not null default 0 check (daily_brewed_received >= 0);
alter table public.rankings add column if not exists day_key text not null default '';
create index if not exists rankings_day_score_idx on public.rankings (day_key, spent_coffee_cups desc);

-- 일별 랭킹 히스토리 (자정 마감 순위 보존)
create table if not exists public.ranking_daily_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_key text not null,
  display_name text not null,
  spent_coffee_cups integer not null default 0 check (spent_coffee_cups >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day_key)
);
create index if not exists ranking_daily_entries_day_score_idx on public.ranking_daily_entries (day_key, spent_coffee_cups desc);

-- 프로모션 지급 중복 방지
create table if not exists public.promotion_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  claim_type text not null,
  day_key text not null,
  reward_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, claim_type, day_key)
);
alter table public.promotion_claims enable row level security;

alter table public.game_states add column if not exists attendance_day_key text not null default '';
alter table public.game_states add column if not exists attendance_cups_today integer not null default 0 check (attendance_cups_today >= 0);
alter table public.game_states add column if not exists attendance_streak integer not null default 0 check (attendance_streak >= 0);
alter table public.game_states add column if not exists attendance_last_goal_day_key text not null default '';
alter table public.game_states add column if not exists attendance_daily_claim_day_key text not null default '';
alter table public.game_states add column if not exists attendance_streak_bonus_pending boolean not null default false;

-- 오늘 포인트 적립일 (money는 당일 4,700원 상한용)
alter table public.game_states add column if not exists point_day_key text not null default '';

-- 1일 1접속 룰렛 (KST en-CA)
alter table public.game_states add column if not exists daily_login_roulette_day_key text not null default '';
alter table public.game_states add column if not exists daily_login_roulette_reward_cups integer not null default 0 check (daily_login_roulette_reward_cups >= 0);
alter table public.game_states add column if not exists daily_login_roulette_respin_day_key text not null default '';

-- 오늘의 커피 운세 (Daily Ritual)
alter table public.game_states add column if not exists ritual_day_key text not null default '';
alter table public.game_states add column if not exists ritual_fortune_id text not null default '';
alter table public.game_states add column if not exists ritual_fortune_revealed boolean not null default false;
alter table public.game_states add column if not exists ritual_fortune_progress integer not null default 0 check (ritual_fortune_progress >= 0);
alter table public.game_states add column if not exists ritual_fortune_claimed boolean not null default false;
alter table public.game_states add column if not exists ritual_gift_opened boolean not null default false;
alter table public.game_states add column if not exists ritual_gift_id text not null default '';
alter table public.game_states add column if not exists ritual_mission_1_id text not null default '';
alter table public.game_states add column if not exists ritual_mission_2_id text not null default '';
alter table public.game_states add column if not exists ritual_mission_3_id text not null default '';
alter table public.game_states add column if not exists ritual_mission_1_done boolean not null default false;
alter table public.game_states add column if not exists ritual_mission_2_done boolean not null default false;
alter table public.game_states add column if not exists ritual_mission_3_done boolean not null default false;
alter table public.game_states add column if not exists ritual_mission_claimed boolean not null default false;
alter table public.game_states add column if not exists ritual_mission_harvest_count integer not null default 0 check (ritual_mission_harvest_count >= 0);
alter table public.game_states add column if not exists ritual_mission_minigame_done boolean not null default false;
alter table public.game_states add column if not exists ritual_mission_roulette_done boolean not null default false;
alter table public.game_states add column if not exists ritual_fertilizer_charges integer not null default 0 check (ritual_fertilizer_charges >= 0);
alter table public.game_states add column if not exists ritual_bonus_roulette_spins integer not null default 0 check (ritual_bonus_roulette_spins >= 0);

-- 오늘의 커피/저녁 추천 — 「한번 더」 사용일만 저장 (메뉴 ID는 서버에서 계산)
alter table public.game_states add column if not exists recommend_coffee_reroll_day_key text not null default '';
alter table public.game_states add column if not exists recommend_dinner_reroll_day_key text not null default '';
