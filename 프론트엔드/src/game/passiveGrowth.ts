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
    return {
      passiveDayKey: today,
      dailyPassiveGrowth: roundGrowth(
        Math.min(dailyPassiveGrowth, getPassiveGrowthAccrualCap(passiveCoffeesClaimed)),
      ),
      passiveCoffeesClaimed,
    };
  }

  if (dayKey !== today) {
    return { passiveDayKey: today, dailyPassiveGrowth: 0, passiveCoffeesClaimed: 0 };
  }

  return {
    passiveDayKey: today,
    dailyPassiveGrowth: roundGrowth(
      Math.min(dailyPassiveGrowth, getPassiveGrowthAccrualCap(passiveCoffeesClaimed)),
    ),
    passiveCoffeesClaimed,
  };
}

/** 현재 잔 충전 상한 — 0잔 받음→100%, 1잔 받음→200%, 2잔 완료→더 이상 없음 */
export function getPassiveGrowthAccrualCap(
  passiveCoffeesClaimed = 0,
  dailyCap = DAILY_PASSIVE_GROWTH_CAP,
) {
  const maxCups = Math.max(1, Math.floor(dailyCap / 100));
  const claimed = Math.min(maxCups, Math.max(0, Math.floor(passiveCoffeesClaimed)));

  if (claimed >= maxCups) {
    return roundGrowth(claimed * 100);
  }

  return Math.min(dailyCap, (claimed + 1) * 100);
}

/** 방치 누적 — 현재 잔 100%까지만, 받기 후 다음 잔 충전 */
export function canAccruePassiveGrowth(
  _growth: number,
  redeemed: boolean,
  dailyPassiveGrowth = 0,
  dailyCap = DAILY_PASSIVE_GROWTH_CAP,
  passiveCoffeesClaimed = 0,
) {
  const accrualCap = getPassiveGrowthAccrualCap(passiveCoffeesClaimed, dailyCap);
  return !redeemed && dailyPassiveGrowth < accrualCap;
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
    | 'growth'
    | 'dailyPassiveGrowth'
    | 'passiveCoffeesClaimed'
    | 'growthAccrualSyncedAt'
    | 'redeemed'
    | 'passiveDayKey'
  >,
  rules: BalanceRules,
  now = Date.now(),
) {
  const passiveQuota = normalizePassiveQuota(state);
  const accrualCap = getPassiveGrowthAccrualCap(
    passiveQuota.passiveCoffeesClaimed,
    rules.dailyPassiveGrowthCap,
  );

  if (
    !canAccruePassiveGrowth(
      state.growth,
      state.redeemed,
      passiveQuota.dailyPassiveGrowth,
      rules.dailyPassiveGrowthCap,
      passiveQuota.passiveCoffeesClaimed,
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
    dailyCap: accrualCap,
    redeemed: state.redeemed,
  });
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
    incomingQ.passiveDayKey &&
    incomingQ.passiveDayKey !== localQ.passiveDayKey &&
    incomingQ.passiveCoffeesClaimed === 0 &&
    incomingQ.dailyPassiveGrowth === 0;

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
      incomingQ.passiveCoffeesClaimed > localQ.passiveCoffeesClaimed
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
  const claimableCups = unclaimedGrowth >= 100 ? Math.min(1, maxCups - claimedCups) : 0;
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

/** 성장 패널 하단 — 한 줄 요약 */
export function formatPassivePanelHint(
  stats: ReturnType<typeof getPassiveUiStats>,
  passiveGrowthPerSecond: number,
) {
  const { cupsReceived, maxCups, cupFillPercent, canClaim, complete, canReactivate } = stats;

  if (canClaim) {
    return `방치 커피 ${cupsReceived}/${maxCups}잔 · 100% · 받기 가능`;
  }

  if (complete && canReactivate) {
    return `방치 커피 ${maxCups}/${maxCups}잔 · 재활성하면 다시 충전`;
  }

  if (complete) {
    return `방치 커피 ${maxCups}/${maxCups}잔 · 오늘 수령 완료`;
  }

  const parts = [`방치 커피 ${cupsReceived}/${maxCups}잔`, `${cupFillPercent.toFixed(1)}%`];

  if (cupFillPercent < 100 && passiveGrowthPerSecond > 0) {
    const remaining = 100 - cupFillPercent;
    const seconds = Math.ceil(remaining / passiveGrowthPerSecond);
    if (seconds > 0) {
      parts.push(seconds < 60 ? `약 ${seconds}초 후 1잔` : `약 ${Math.ceil(seconds / 60)}분 후 1잔`);
    }
  }

  return parts.join(' · ');
}

export function buildPassiveCoffeeClaim(
  state: import('./types').GameState,
  rules: BalanceRules = DEFAULT_BALANCE_RULES,
) {
  const passiveQuota = normalizePassiveQuota(state);
  const current = { ...state, ...passiveQuota };
  const previewDaily = computePassiveQuotaPreview(current, rules);

  if (current.redeemed) {
    return { ok: false as const, reason: 'already-redeemed' as const, state: current };
  }

  const stats = getPassiveCupStats(
    previewDaily,
    current.passiveCoffeesClaimed,
    rules.dailyPassiveGrowthCap,
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
      dailyPassiveGrowth: roundGrowth(previewDaily),
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
    | 'passiveCoffeesClaimed'
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
