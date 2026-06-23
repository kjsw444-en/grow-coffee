import {
  DAILY_PASSIVE_GROWTH_CAP,
  PASSIVE_GROWTH_PER_SECOND,
} from './constants';
import { initialState } from './types';

export type BalanceRules = {
  passiveGrowthPerSecond: number;
  dailyPassiveGrowthCap: number;
};

export const DEFAULT_BALANCE_RULES: BalanceRules = {
  passiveGrowthPerSecond: PASSIVE_GROWTH_PER_SECOND,
  dailyPassiveGrowthCap: DAILY_PASSIVE_GROWTH_CAP,
};

export const PASSIVE_GROWTH_RESET_NOTE = '방치 커피는 20분(100%)마다 받기 · 하루 2잔 · 재활성(광고)은 하루 1회';

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
  _rules: BalanceRules = DEFAULT_BALANCE_RULES,
  _now = Date.now(),
) {
  return roundGrowth(Math.min(100, Math.max(0, state.growth)));
}

export function getPassiveDayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/** 서버 applyReset과 동일 — 진행 데이터 초기화용 */
export function buildResetState() {
  const now = new Date().toISOString();
  return {
    ...initialState,
    growthAccrualSyncedAt: now,
    passiveDayKey: getPassiveDayKey(),
    passiveReactivateDayKey: '',
  };
}

export function normalizePassiveQuota(
  state: Pick<
    import('./types').GameState,
    'passiveDayKey' | 'dailyPassiveGrowth' | 'passiveCoffeesClaimed'
  >,
) {
  const today = getPassiveDayKey();
  const dayKey = state.passiveDayKey || '';
  const dailyPassiveGrowth = roundGrowth(Math.max(0, state.dailyPassiveGrowth ?? 0));
  const passiveCoffeesClaimed = Math.max(0, Math.floor(state.passiveCoffeesClaimed ?? 0));

  if (!dayKey) {
    return { passiveDayKey: today, dailyPassiveGrowth, passiveCoffeesClaimed };
  }

  if (dayKey !== today) {
    return { passiveDayKey: today, dailyPassiveGrowth: 0, passiveCoffeesClaimed: 0 };
  }

  return {
    passiveDayKey: today,
    dailyPassiveGrowth,
    passiveCoffeesClaimed,
  };
}

/** 방치 누적 — 성장 게이지 100%·마시기와 별도, 일일 캡까지 계속 */
export function canAccruePassiveGrowth(
  _growth: number,
  redeemed: boolean,
  dailyPassiveGrowth = 0,
  dailyCap = DAILY_PASSIVE_GROWTH_CAP,
) {
  return !redeemed && dailyPassiveGrowth < dailyCap;
}

export function getPassiveGrowthDelta({
  elapsedMs,
  baseRatePerSecond,
  dailyPassiveGrowth,
  dailyCap,
  redeemed,
}: {
  elapsedMs: number;
  baseRatePerSecond: number;
  dailyPassiveGrowth: number;
  dailyCap: number;
  redeemed: boolean;
}) {
  if (redeemed || dailyPassiveGrowth >= dailyCap || elapsedMs <= 0) {
    return { quotaDelta: 0, growthDelta: 0 };
  }

  const raw = (elapsedMs / 1000) * baseRatePerSecond;
  const roomInDaily = Math.max(0, dailyCap - dailyPassiveGrowth);
  const quotaDelta = roundGrowth(Math.min(raw, roomInDaily));

  return { quotaDelta, growthDelta: 0 };
}

/** 서버 previewPassiveGrowth와 동일 — UI 힌트·게이지용 */
export function computePassivePreviewDeltas(
  state: Pick<
    import('./types').GameState,
    'growth' | 'dailyPassiveGrowth' | 'growthAccrualSyncedAt' | 'redeemed' | 'passiveDayKey'
  >,
  rules: BalanceRules,
  now = Date.now(),
) {
  const passiveQuota = normalizePassiveQuota(state);

  if (
    !canAccruePassiveGrowth(
      state.growth,
      state.redeemed,
      passiveQuota.dailyPassiveGrowth,
      rules.dailyPassiveGrowthCap,
    )
  ) {
    return { quotaDelta: 0, growthDelta: 0 };
  }

  const syncedAt = new Date(state.growthAccrualSyncedAt).getTime();
  if (Number.isNaN(syncedAt)) {
    return { quotaDelta: 0, growthDelta: 0 };
  }

  const elapsedMs = Math.max(0, now - syncedAt);
  return getPassiveGrowthDelta({
    elapsedMs,
    baseRatePerSecond: rules.passiveGrowthPerSecond,
    dailyPassiveGrowth: passiveQuota.dailyPassiveGrowth,
    dailyCap: rules.dailyPassiveGrowthCap,
    redeemed: state.redeemed,
  });
}

/** @deprecated growth 게이지 미리보기만 — computePassivePreviewDeltas 사용 */
export function computePassivePreviewDelta(
  state: Pick<
    import('./types').GameState,
    'growth' | 'dailyPassiveGrowth' | 'growthAccrualSyncedAt' | 'redeemed' | 'passiveDayKey'
  >,
  rules: BalanceRules,
  now = Date.now(),
) {
  return computePassivePreviewDeltas(state, rules, now).growthDelta;
}

export function computePassiveQuotaPreview(
  state: Pick<
    import('./types').GameState,
    'growth' | 'dailyPassiveGrowth' | 'growthAccrualSyncedAt' | 'redeemed' | 'passiveDayKey'
  >,
  rules: BalanceRules = DEFAULT_BALANCE_RULES,
  now = Date.now(),
) {
  const passiveQuota = normalizePassiveQuota(state);
  const { quotaDelta } = computePassivePreviewDeltas(state, rules, now);
  return roundGrowth(passiveQuota.dailyPassiveGrowth + quotaDelta);
}

export function withNormalizedPassive(state: import('./types').GameState) {
  return { ...state, ...normalizePassiveQuota(state) };
}

export function hasUsedPassiveReactivateToday(passiveReactivateDayKey = '') {
  return passiveReactivateDayKey === getPassiveDayKey();
}

/** 서버/bootstrap 응답 병합 — 방치 수령·누적치가 되돌아가지 않게 */
export function mergePassiveQuotaFromServer(
  local: Pick<
    import('./types').GameState,
    'passiveDayKey' | 'dailyPassiveGrowth' | 'passiveCoffeesClaimed' | 'passiveReactivateDayKey'
  >,
  incoming: Pick<
    import('./types').GameState,
    'passiveDayKey' | 'dailyPassiveGrowth' | 'passiveCoffeesClaimed' | 'passiveReactivateDayKey'
  >,
) {
  const localQ = normalizePassiveQuota(local);
  const incomingQ = normalizePassiveQuota(incoming);
  const today = getPassiveDayKey();
  const localReactivate = String(local.passiveReactivateDayKey || '');
  const incomingReactivate = String(incoming.passiveReactivateDayKey || '');

  const incomingIsFreshReset =
    incomingQ.passiveCoffeesClaimed === 0 &&
    incomingQ.dailyPassiveGrowth === 0 &&
    !incomingReactivate &&
    (localQ.passiveCoffeesClaimed > 0 || localQ.dailyPassiveGrowth > 0);

  if (incomingIsFreshReset) {
    return {
      passiveDayKey: incomingQ.passiveDayKey || localQ.passiveDayKey,
      dailyPassiveGrowth: incomingQ.dailyPassiveGrowth,
      passiveCoffeesClaimed: 0,
      passiveReactivateDayKey: '',
    };
  }

  return {
    passiveDayKey: incomingQ.passiveDayKey || localQ.passiveDayKey,
    dailyPassiveGrowth:
      incomingQ.passiveCoffeesClaimed > localQ.passiveCoffeesClaimed ||
      incomingQ.dailyPassiveGrowth < localQ.dailyPassiveGrowth
        ? incomingQ.dailyPassiveGrowth
        : roundGrowth(Math.max(localQ.dailyPassiveGrowth, incomingQ.dailyPassiveGrowth)),
    passiveCoffeesClaimed: Math.max(localQ.passiveCoffeesClaimed, incomingQ.passiveCoffeesClaimed),
    passiveReactivateDayKey:
      localReactivate === today || incomingReactivate === today
        ? today
        : incomingReactivate || localReactivate,
  };
}

export function getPassiveCupStats(
  dailyPassiveGrowth: number,
  passiveCoffeesClaimed = 0,
  dailyCap = DAILY_PASSIVE_GROWTH_CAP,
  passiveReactivateDayKey = '',
) {
  const maxCups = Math.max(1, Math.floor(dailyCap / 100));
  const claimedCups = Math.min(maxCups, Math.max(0, Math.floor(passiveCoffeesClaimed)));
  const unclaimedGrowth = roundGrowth(Math.max(0, dailyPassiveGrowth - claimedCups * 100));
  const claimableCups = Math.min(maxCups - claimedCups, Math.floor(unclaimedGrowth / 100));
  const canClaim = claimableCups >= 1;
  const chargingPercent = roundGrowth(Math.min(100, unclaimedGrowth));
  const complete = claimedCups >= maxCups;
  const reactivateUsedToday = hasUsedPassiveReactivateToday(passiveReactivateDayKey);
  const canReactivate = complete && !reactivateUsedToday;
  const cupFillPercent = complete && !canClaim ? (canReactivate ? 100 : chargingPercent) : chargingPercent;
  const remainder = complete && !canClaim ? 0 : chargingPercent;

  return {
    maxCups,
    cupsReceived: claimedCups,
    cupsEarned: claimedCups,
    claimableCups,
    canClaim,
    canReactivate,
    reactivateUsedToday,
    remainder,
    cupFillPercent,
    complete,
    dailyPassiveGrowth,
    unclaimedGrowth,
  };
}

/** UI용 — 서버·틱 사이 elapsed 미리보기를 반영한 게이지 */
export function getPassiveUiStats(
  state: Pick<
    import('./types').GameState,
    | 'growth'
    | 'dailyPassiveGrowth'
    | 'passiveCoffeesClaimed'
    | 'passiveReactivateDayKey'
    | 'growthAccrualSyncedAt'
    | 'redeemed'
    | 'passiveDayKey'
  >,
  rules: BalanceRules = DEFAULT_BALANCE_RULES,
  now = Date.now(),
) {
  const previewDaily = computePassiveQuotaPreview(state, rules, now);
  return getPassiveCupStats(
    previewDaily,
    state.passiveCoffeesClaimed,
    rules.dailyPassiveGrowthCap,
    state.passiveReactivateDayKey,
  );
}

export function buildPassiveCoffeeClaim(state: import('./types').GameState) {
  const passiveQuota = normalizePassiveQuota(state);
  const current = { ...state, ...passiveQuota };
  const previewDaily = computePassiveQuotaPreview(current, DEFAULT_BALANCE_RULES);

  if (current.redeemed) {
    return { ok: false as const, reason: 'already-redeemed' as const, state: current };
  }

  const stats = getPassiveCupStats(
    previewDaily,
    current.passiveCoffeesClaimed,
    DEFAULT_BALANCE_RULES.dailyPassiveGrowthCap,
    current.passiveReactivateDayKey,
  );

  if (!stats.canClaim) {
    return { ok: false as const, reason: 'not-ready' as const, state: current };
  }

  const now = new Date().toISOString();

  return {
    ok: true as const,
    state: {
      ...current,
      passiveCoffeesClaimed: current.passiveCoffeesClaimed + 1,
      totalCoffees: current.totalCoffees + 1,
      dailyPassiveGrowth: roundGrowth(Math.max(0, previewDaily - 100)),
      growthAccrualSyncedAt: now,
    },
    lastEarned: 1,
  };
}

export function buildPassiveReactivate(state: import('./types').GameState) {
  const passiveQuota = normalizePassiveQuota(state);
  const current = { ...state, ...passiveQuota };

  if (current.redeemed) {
    return { ok: false as const, reason: 'already-redeemed' as const, state: current };
  }

  const stats = getPassiveCupStats(
    current.dailyPassiveGrowth,
    current.passiveCoffeesClaimed,
    DAILY_PASSIVE_GROWTH_CAP,
    current.passiveReactivateDayKey,
  );

  if (!stats.complete) {
    return { ok: false as const, reason: 'not-complete' as const, state: current };
  }

  if (stats.reactivateUsedToday) {
    return { ok: false as const, reason: 'already-reactivated' as const, state: current };
  }

  const today = getPassiveDayKey();
  const now = new Date().toISOString();

  return {
    ok: true as const,
    state: {
      ...current,
      passiveDayKey: today,
      dailyPassiveGrowth: 0,
      passiveCoffeesClaimed: 0,
      passiveReactivateDayKey: today,
      growthAccrualSyncedAt: now,
    },
  };
}

/** 클라이언트 방치 틱 — dailyPassiveGrowth만 반영 (커피나무 growth와 분리) */
export function accrueClientPassivePreview(
  state: Pick<
    import('./types').GameState,
    | 'growth'
    | 'dailyPassiveGrowth'
    | 'growthAccrualSyncedAt'
    | 'redeemed'
    | 'passiveDayKey'
  > &
    Partial<import('./types').GameState>,
  rules: BalanceRules = DEFAULT_BALANCE_RULES,
  now = Date.now(),
) {
  const passiveQuota = normalizePassiveQuota(state);
  const base = { ...state, ...passiveQuota };
  const { quotaDelta } = computePassivePreviewDeltas(base, rules, now);

  if (quotaDelta <= 0) {
    return {
      changed: false as const,
      next: base as import('./types').GameState,
      displayGrowth: roundGrowth(Math.min(100, Math.max(0, base.growth))),
    };
  }

  const next = {
    ...base,
    dailyPassiveGrowth: roundGrowth(passiveQuota.dailyPassiveGrowth + quotaDelta),
    growthAccrualSyncedAt: new Date(now).toISOString(),
  } as import('./types').GameState;

  return {
    changed: true as const,
    next,
    displayGrowth: next.growth,
  };
}
