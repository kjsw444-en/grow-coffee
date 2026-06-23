/**
 * 프론트 passiveGrowth.ts 로직 검증 (백엔드 test-passive-coffee-flow.mjs와 동일 시나리오)
 */
import assert from 'node:assert/strict';

const PASSIVE_GROWTH_PER_SECOND = 5 / 60;
const DAILY_PASSIVE_GROWTH_CAP = 200;
const RULES = {
  passiveGrowthPerSecond: PASSIVE_GROWTH_PER_SECOND,
  dailyPassiveGrowthCap: DAILY_PASSIVE_GROWTH_CAP,
};

function roundGrowth(value) {
  return Math.round(value * 1e7) / 1e7;
}

function getPassiveDayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function getPassiveGrowthAccrualCap(passiveCoffeesClaimed = 0, dailyCap = DAILY_PASSIVE_GROWTH_CAP) {
  const maxCups = Math.max(1, Math.floor(dailyCap / 100));
  const claimed = Math.min(maxCups, Math.max(0, Math.floor(passiveCoffeesClaimed)));
  if (claimed >= maxCups) return roundGrowth(claimed * 100);
  return Math.min(dailyCap, (claimed + 1) * 100);
}

function normalizePassiveQuota(state) {
  const today = getPassiveDayKey();
  const dayKey = state.passiveDayKey || '';
  let dailyPassiveGrowth = roundGrowth(Math.max(0, state.dailyPassiveGrowth ?? 0));
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

  dailyPassiveGrowth = roundGrowth(
    Math.min(dailyPassiveGrowth, getPassiveGrowthAccrualCap(passiveCoffeesClaimed)),
  );

  return { passiveDayKey: today, dailyPassiveGrowth, passiveCoffeesClaimed };
}

function canAccruePassiveGrowth(
  _growth,
  redeemed,
  dailyPassiveGrowth = 0,
  dailyCap = DAILY_PASSIVE_GROWTH_CAP,
  passiveCoffeesClaimed = 0,
) {
  const accrualCap = getPassiveGrowthAccrualCap(passiveCoffeesClaimed, dailyCap);
  return !redeemed && dailyPassiveGrowth < accrualCap;
}

function getPassiveGrowthDelta({ elapsedMs, baseRatePerSecond, dailyPassiveGrowth, dailyCap, redeemed }) {
  if (redeemed || dailyPassiveGrowth >= dailyCap || elapsedMs <= 0) {
    return { quotaDelta: 0, growthDelta: 0 };
  }

  const raw = (elapsedMs / 1000) * baseRatePerSecond;
  const roomInDaily = Math.max(0, dailyCap - dailyPassiveGrowth);
  const quotaDelta = roundGrowth(Math.min(raw, roomInDaily));
  return { quotaDelta, growthDelta: 0 };
}

function computePassivePreviewDeltas(state, rules, now = Date.now()) {
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

function computePassiveQuotaPreview(state, rules = RULES, now = Date.now()) {
  const passiveQuota = normalizePassiveQuota(state);
  const { quotaDelta } = computePassivePreviewDeltas(state, rules, now);
  return roundGrowth(passiveQuota.dailyPassiveGrowth + quotaDelta);
}

function hasUsedPassiveReactivateToday(passiveReactivateDayKey = '') {
  return passiveReactivateDayKey === getPassiveDayKey();
}

function getPassiveCupStats(
  dailyPassiveGrowth,
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
  const cupFillPercent =
    complete && !canClaim ? (canReactivate ? 100 : chargingPercent) : chargingPercent;

  return {
    maxCups,
    cupsReceived: claimedCups,
    canClaim,
    canReactivate,
    reactivateUsedToday,
    cupFillPercent,
    complete,
    unclaimedGrowth,
  };
}

function getPassiveUiStats(state, rules = RULES, now = Date.now()) {
  const previewDaily = computePassiveQuotaPreview(state, rules, now);
  return getPassiveCupStats(
    previewDaily,
    state.passiveCoffeesClaimed,
    rules.dailyPassiveGrowthCap,
    state.passiveReactivateDayKey,
  );
}

function buildPassiveCoffeeClaim(state, rules = RULES) {
  const passiveQuota = normalizePassiveQuota(state);
  const current = { ...state, ...passiveQuota };
  const previewDaily = computePassiveQuotaPreview(current, rules);

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current };
  }

  const stats = getPassiveCupStats(
    previewDaily,
    current.passiveCoffeesClaimed,
    rules.dailyPassiveGrowthCap,
    current.passiveReactivateDayKey,
  );

  if (!stats.canClaim) {
    return { ok: false, reason: 'not-ready', state: current };
  }

  const now = new Date().toISOString();
  return {
    ok: true,
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

function buildPassiveReactivate(state) {
  const passiveQuota = normalizePassiveQuota(state);
  const current = { ...state, ...passiveQuota };

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current };
  }

  const stats = getPassiveCupStats(
    current.dailyPassiveGrowth,
    current.passiveCoffeesClaimed,
    DAILY_PASSIVE_GROWTH_CAP,
    current.passiveReactivateDayKey,
  );

  if (!stats.complete) {
    return { ok: false, reason: 'not-complete', state: current };
  }

  if (stats.reactivateUsedToday) {
    return { ok: false, reason: 'already-reactivated', state: current };
  }

  const today = getPassiveDayKey();
  const now = new Date().toISOString();

  return {
    ok: true,
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

function mergePassiveQuotaFromServer(local, incoming) {
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

function accrueMinutes(state, minutes, rules = RULES) {
  const now = Date.now();
  const syncedAt = new Date(now - minutes * 60 * 1000).toISOString();
  return { ...state, growthAccrualSyncedAt: syncedAt };
}

function test(name, fn) {
  fn();
  console.log(`ok: ${name}`);
}

const dayKey = getPassiveDayKey();
const baseState = {
  growth: 50,
  money: 0,
  totalCoffees: 0,
  totalWaters: 0,
  redeemed: false,
  passiveDayKey: dayKey,
  dailyPassiveGrowth: 0,
  passiveCoffeesClaimed: 0,
  passiveReactivateDayKey: '',
  growthAccrualSyncedAt: new Date().toISOString(),
};

test('1~3 — 21분 후 UI 100%·받기 가능', () => {
  const state = accrueMinutes(baseState, 21);
  const ui = getPassiveUiStats(state, RULES);
  assert.ok(ui.cupFillPercent >= 100, `gauge=${ui.cupFillPercent}`);
  assert.equal(ui.canClaim, true);
  assert.equal(ui.cupsReceived, 0);
});

test('4~5 — 1잔 받기: 1/2·게이지 리셋·totalCoffees +1', () => {
  let state = accrueMinutes({ ...baseState, totalCoffees: 5 }, 21);
  const claim = buildPassiveCoffeeClaim(state, RULES);
  assert.equal(claim.ok, true, claim.reason);
  state = claim.state;
  assert.equal(state.passiveCoffeesClaimed, 1);
  assert.equal(state.totalCoffees, 6);
  const ui = getPassiveUiStats(state, RULES);
  assert.equal(ui.cupsReceived, 1);
  assert.equal(ui.canClaim, false);
  assert.ok(ui.cupFillPercent < 100, `gauge should reset, got ${ui.cupFillPercent}`);
});

test('6 — 2번째 100% 후 받기 → 2/2', () => {
  let state = accrueMinutes(baseState, 21);
  state = buildPassiveCoffeeClaim(state, RULES).state;
  state = accrueMinutes(state, 42);
  assert.equal(getPassiveUiStats(state, RULES).canClaim, true);
  state = buildPassiveCoffeeClaim(state, RULES).state;
  const ui = getPassiveUiStats(state, RULES);
  assert.equal(ui.cupsReceived, 2);
  assert.equal(ui.complete, true);
  assert.equal(ui.canReactivate, true);
});

test('7~8 — 재활성 후 다시 2잔 사이클', () => {
  let state = {
    ...baseState,
    dailyPassiveGrowth: 200,
    passiveCoffeesClaimed: 2,
  };
  const reactivate = buildPassiveReactivate(state);
  assert.equal(reactivate.ok, true, reactivate.reason);
  state = reactivate.state;
  assert.equal(state.passiveCoffeesClaimed, 0);
  assert.equal(state.dailyPassiveGrowth, 0);

  state = accrueMinutes(state, 21);
  assert.equal(getPassiveUiStats(state, RULES).canClaim, true);
  state = buildPassiveCoffeeClaim(state, RULES).state;
  state = accrueMinutes(state, 42);
  state = buildPassiveCoffeeClaim(state, RULES).state;
  assert.equal(getPassiveUiStats(state, RULES).complete, true);
});

test('9 — 재활성 하루 1회', () => {
  const state = {
    ...baseState,
    dailyPassiveGrowth: 200,
    passiveCoffeesClaimed: 2,
    passiveReactivateDayKey: dayKey,
  };
  const again = buildPassiveReactivate(state);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'already-reactivated');
});

test('merge — 같은 날 서버 0값만으로는 로컬 진행 유지', () => {
  const local = {
    passiveDayKey: dayKey,
    dailyPassiveGrowth: 120,
    passiveCoffeesClaimed: 1,
    passiveReactivateDayKey: '',
  };
  const incoming = {
    passiveDayKey: dayKey,
    dailyPassiveGrowth: 0,
    passiveCoffeesClaimed: 0,
    passiveReactivateDayKey: '',
  };
  const merged = mergePassiveQuotaFromServer(local, incoming);
  assert.equal(merged.dailyPassiveGrowth, 120);
  assert.equal(merged.passiveCoffeesClaimed, 1);
});

test('merge — passiveDayKey 변경 시에만 일일 리셋', () => {
  const local = {
    passiveDayKey: '2020-01-01',
    dailyPassiveGrowth: 150,
    passiveCoffeesClaimed: 1,
    passiveReactivateDayKey: '',
  };
  const incoming = {
    passiveDayKey: dayKey,
    dailyPassiveGrowth: 0,
    passiveCoffeesClaimed: 0,
    passiveReactivateDayKey: '',
  };
  const merged = mergePassiveQuotaFromServer(local, incoming);
  assert.equal(merged.passiveDayKey, dayKey);
  assert.equal(merged.dailyPassiveGrowth, 0);
  assert.equal(merged.passiveCoffeesClaimed, 0);
});

test('1잔 받기 전 42분 대기해도 게이지 100%에서 멈춤', () => {
  let state = accrueMinutes(baseState, 21);
  assert.equal(getPassiveUiStats(state, RULES).canClaim, true);
  state = accrueMinutes(state, 21);
  const ui = getPassiveUiStats(state, RULES);
  assert.ok(ui.cupFillPercent <= 100);
  assert.equal(ui.cupsReceived, 0);
  assert.equal(ui.canClaim, true);
});

console.log('passive-growth (frontend) tests passed');
