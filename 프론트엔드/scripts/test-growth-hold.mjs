import assert from 'node:assert/strict';

const GROWTH_PER_WATER = 25;
const DAILY_PASSIVE_GROWTH_CAP = 12;

function roundGrowth(value) {
  return Math.round(value * 1e7) / 1e7;
}

function previewHoldGrowth(startGrowth, holdProgress) {
  const progress = Math.min(100, Math.max(0, holdProgress));
  const start = roundGrowth(startGrowth);
  const raw = Math.min(100, start + GROWTH_PER_WATER * (progress / 100));

  if (raw >= 100 && !isReadyToDrinkGrowth(start)) {
    return PRE_DRINK_DISPLAY_MAX;
  }

  return roundGrowth(raw);
}

function commitWaterGrowth(startGrowth) {
  return roundGrowth(Math.min(100, startGrowth + GROWTH_PER_WATER));
}

function resolveWaterSyncGrowth(holdStartGrowth, serverGrowth) {
  const start = roundGrowth(holdStartGrowth);
  const expected = commitWaterGrowth(start);
  const server = roundGrowth(serverGrowth);

  if (server > expected) return expected;
  return server;
}

const PRE_DRINK_DISPLAY_MAX = 99.9999999;

function maxPassiveDisplayGrowth(authoritativeGrowth) {
  const authoritative = roundGrowth(authoritativeGrowth);
  if (authoritative >= 100) return 100;

  const nextMilestone = commitWaterGrowth(authoritative);
  if (nextMilestone >= 100) {
    return PRE_DRINK_DISPLAY_MAX;
  }

  return roundGrowth(nextMilestone - 0.0000001);
}

function previewPassiveDisplayGrowth(authoritativeGrowth, passivePreviewDelta) {
  const cap = maxPassiveDisplayGrowth(authoritativeGrowth);
  return roundGrowth(Math.min(cap, authoritativeGrowth + passivePreviewDelta));
}

function isReadyToDrinkGrowth(authoritativeGrowth) {
  return roundGrowth(authoritativeGrowth) >= 100;
}

function sanitizeGrowthForWaters(growth, totalWaters) {
  const waters = Math.max(0, Math.floor(Number(totalWaters) || 0));
  const maxAllowed = Math.min(100, waters * GROWTH_PER_WATER);
  const value = roundGrowth(growth);
  const capped = Math.min(value, maxAllowed);
  const milestone = Math.floor(capped / GROWTH_PER_WATER) * GROWTH_PER_WATER;
  return roundGrowth(Math.min(maxAllowed, milestone));
}

function test(name, fn) {
  fn();
  console.log(`ok: ${name}`);
}

test('4번 물주기로만 100% 도달', () => {
  let growth = 0;
  for (let i = 0; i < 4; i += 1) {
    growth = commitWaterGrowth(growth);
  }
  assert.equal(growth, 100);
  assert.equal(isReadyToDrinkGrowth(growth), true);
});

test('3번 물주기만으로는 마시기 불가', () => {
  let growth = 0;
  for (let i = 0; i < 3; i += 1) {
    growth = commitWaterGrowth(growth);
  }
  assert.equal(growth, 75);
  assert.equal(isReadyToDrinkGrowth(growth), false);
});

test('홀드 미리보기는 state 기준 — 75% 홀드 중에도 영상 단계(100%) 미리보기 금지', () => {
  assert.equal(previewHoldGrowth(75, 50), 87.5);
  assert.equal(previewHoldGrowth(75, 100), PRE_DRINK_DISPLAY_MAX);
  assert.equal(previewHoldGrowth(50, 100), 75);
});

test('방치 게이지는 state를 넘어서 확정 단계를 바꾸지 않음', () => {
  const stateGrowth = 50;
  const passivePreview = 24;
  const display = previewPassiveDisplayGrowth(stateGrowth, passivePreview);
  assert.equal(display, 74);
  assert.equal(isReadyToDrinkGrowth(stateGrowth), false);
});

test('display 100 + state 75 조합은 마시기 불가', () => {
  assert.equal(isReadyToDrinkGrowth(75), false);
});

test('방치만으로 state 100 불가 — 물 3번 + 방치 25%', () => {
  let state = 0;
  for (let i = 0; i < 3; i += 1) {
    state = commitWaterGrowth(state);
  }
  assert.equal(state, 75);
  const display = previewPassiveDisplayGrowth(state, 25);
  assert.equal(display, PRE_DRINK_DISPLAY_MAX);
  assert.equal(isReadyToDrinkGrowth(state), false);
});

test('서버 불일치 시 물 1회당 +25%만 반영 — 0%에서 75% 점프 방지', () => {
  assert.equal(resolveWaterSyncGrowth(0, 75), 25);
  assert.equal(resolveWaterSyncGrowth(0, 50), 25);
  assert.equal(resolveWaterSyncGrowth(25, 75), 50);
  assert.equal(resolveWaterSyncGrowth(50, 87), 75);
  assert.equal(resolveWaterSyncGrowth(50, 75), 75);
  assert.equal(resolveWaterSyncGrowth(75, 100), 100);
});

test('방치 게이지는 100% 미만 state에서 100%에 도달하지 않음', () => {
  assert.equal(maxPassiveDisplayGrowth(50), 74.9999999);
  assert.equal(previewPassiveDisplayGrowth(50, 30), 74.9999999);
  assert.equal(maxPassiveDisplayGrowth(75), PRE_DRINK_DISPLAY_MAX);
  assert.equal(previewPassiveDisplayGrowth(75, 25), 99.9999999);
  assert.equal(previewPassiveDisplayGrowth(100, 0), 100);
});

test('물 2회인데 growth 100 — 50%로 보정', () => {
  assert.equal(sanitizeGrowthForWaters(100, 2), 50);
  assert.equal(isReadyToDrinkGrowth(sanitizeGrowthForWaters(100, 2)), false);
});

console.log('growth-hold tests passed');
