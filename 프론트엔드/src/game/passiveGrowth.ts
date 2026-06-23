import {
  DAILY_PASSIVE_GROWTH_CAP,
  PASSIVE_GROWTH_PER_SECOND,
} from './constants';

export type BalanceRules = {
  passiveGrowthPerSecond: number;
  dailyPassiveGrowthCap: number;
};

export const DEFAULT_BALANCE_RULES: BalanceRules = {
  passiveGrowthPerSecond: PASSIVE_GROWTH_PER_SECOND,
  dailyPassiveGrowthCap: DAILY_PASSIVE_GROWTH_CAP,
};

export function roundGrowth(value: number) {
  return Math.round(value * 1e7) / 1e7;
}

const MIN_SYNC_EPOCH_MS = Date.UTC(2020, 0, 1);

export function repairGrowthAccrualSyncedAt(raw: {
  growthAccrualSyncedAt?: string;
  growth_accrual_synced_at?: string;
}) {
  const value = raw.growthAccrualSyncedAt ?? raw.growth_accrual_synced_at;

  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() < MIN_SYNC_EPOCH_MS) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

export function computePassiveDisplayGrowth(
  state: Pick<
    import('./types').GameState,
    'growth' | 'dailyPassiveGrowth' | 'growthAccrualSyncedAt' | 'redeemed' | 'passiveDayKey'
  >,
  rules: BalanceRules = DEFAULT_BALANCE_RULES,
  now = Date.now(),
) {
  const delta = computePassivePreviewDelta(state, rules, now);
  return roundGrowth(Math.min(100, Math.max(0, state.growth + delta)));
}

export function getPassiveDayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

export function normalizePassiveQuota(
  state: Pick<import('./types').GameState, 'passiveDayKey' | 'dailyPassiveGrowth'>,
) {
  const today = getPassiveDayKey();
  const dayKey = state.passiveDayKey || '';

  if (dayKey !== today) {
    return { passiveDayKey: today, dailyPassiveGrowth: 0 };
  }

  return {
    passiveDayKey: today,
    dailyPassiveGrowth: roundGrowth(state.dailyPassiveGrowth ?? 0),
  };
}

export function canAccruePassiveGrowth(growth: number, redeemed: boolean) {
  return !redeemed && growth < 100;
}

export function getPassiveGrowthDelta({
  elapsedMs,
  baseRatePerSecond,
  dailyPassiveGrowth,
  dailyCap,
  currentGrowth,
  redeemed,
}: {
  elapsedMs: number;
  baseRatePerSecond: number;
  dailyPassiveGrowth: number;
  dailyCap: number;
  currentGrowth: number;
  redeemed: boolean;
}) {
  if (!canAccruePassiveGrowth(currentGrowth, redeemed) || elapsedMs <= 0) {
    return 0;
  }

  const raw = (elapsedMs / 1000) * baseRatePerSecond;
  const roomInDaily = Math.max(0, dailyCap - dailyPassiveGrowth);
  const roomToMax = Math.max(0, 100 - currentGrowth);

  return roundGrowth(Math.min(raw, roomInDaily, roomToMax));
}

/** 서버 previewPassiveGrowth와 동일 — UI 숫자 변경 없이 힌트용 */
export function computePassivePreviewDelta(
  state: Pick<
    import('./types').GameState,
    'growth' | 'dailyPassiveGrowth' | 'growthAccrualSyncedAt' | 'redeemed'
  >,
  rules: BalanceRules,
  now = Date.now(),
) {
  if (!canAccruePassiveGrowth(state.growth, state.redeemed)) {
    return 0;
  }

  const syncedAt = new Date(state.growthAccrualSyncedAt).getTime();
  if (Number.isNaN(syncedAt)) {
    return 0;
  }

  const elapsedMs = Math.max(0, now - syncedAt);
  return getPassiveGrowthDelta({
    elapsedMs,
    baseRatePerSecond: rules.passiveGrowthPerSecond,
    dailyPassiveGrowth: state.dailyPassiveGrowth,
    dailyCap: rules.dailyPassiveGrowthCap,
    currentGrowth: state.growth,
    redeemed: state.redeemed,
  });
}

export function withNormalizedPassive(state: import('./types').GameState) {
  return { ...state, ...normalizePassiveQuota(state) };
}
