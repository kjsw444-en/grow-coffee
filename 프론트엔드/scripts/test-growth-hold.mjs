import assert from 'node:assert/strict';

const GROWTH_PER_WATER = 25;
const PRE_DRINK_DISPLAY_MAX = 99.9999999;

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

function resolveWaterSyncGrowth(holdStartGrowth, serverGrowth, options = {}) {
  const start = roundGrowth(holdStartGrowth);
  const server = roundGrowth(serverGrowth);

  if (server >= 100) return 100;

  const maxDelta = options.maxDelta ?? GROWTH_PER_WATER;
  const maxExpected = roundGrowth(Math.min(100, start + maxDelta));
  const minExpected = commitWaterGrowth(start);

  if (server < start) return start;
  if (server < minExpected) return minExpected;
  if (server > maxExpected) return minExpected;
  return server;
}

function isReadyToDrinkGrowth(authoritativeGrowth) {
  return roundGrowth(authoritativeGrowth) >= 100;
}

function test(name, fn) {
  fn();
  console.log(`ok: ${name}`);
}

test('물 1회당 +25% 미리보기', () => {
  assert.equal(previewHoldGrowth(0, 0), 0);
  assert.equal(previewHoldGrowth(0, 50), 12.5);
  assert.equal(previewHoldGrowth(0, 100), 25);
  assert.equal(previewHoldGrowth(25, 100), 50);
  assert.equal(previewHoldGrowth(75, 100), PRE_DRINK_DISPLAY_MAX);
});

test('물 1회당 +25% 확정', () => {
  assert.equal(commitWaterGrowth(0), 25);
  assert.equal(commitWaterGrowth(25), 50);
  assert.equal(commitWaterGrowth(50), 75);
  assert.equal(commitWaterGrowth(75), 100);
});

test('구서버 75% 점프 응답은 +25%로 보정', () => {
  assert.equal(resolveWaterSyncGrowth(0, 75), 25);
  assert.equal(resolveWaterSyncGrowth(25, 75), 50);
  assert.equal(resolveWaterSyncGrowth(50, 75), 75);
});

test('finalize 100% 응답은 holdStart와 무관하게 100%', () => {
  assert.equal(resolveWaterSyncGrowth(0, 100), 100);
  assert.equal(resolveWaterSyncGrowth(75, 100), 100);
});

test('비료 버프(+32.5%)까지 허용', () => {
  assert.equal(resolveWaterSyncGrowth(0, 32.5, { maxDelta: 32.5 }), 32.5);
  assert.equal(resolveWaterSyncGrowth(0, 75, { maxDelta: 32.5 }), 25);
});

function reconcileLegacyServerGrowth(growth, totalWaters) {
  const value = roundGrowth(Math.min(100, Math.max(0, growth)));
  if (value <= 0 || value >= 100) return value;
  const waters = Math.max(0, Math.floor(totalWaters));
  if (waters <= 0) return value;
  const cycleGrowth = (((waters - 1) % 4) + 1) * GROWTH_PER_WATER;
  if (value > cycleGrowth + 0.01) return cycleGrowth;
  return value;
}

test('구서버 DB — totalWaters 1·growth 75% → 25%', () => {
  assert.equal(reconcileLegacyServerGrowth(75, 1), 25);
  assert.equal(reconcileLegacyServerGrowth(75, 3), 75);
  assert.equal(reconcileLegacyServerGrowth(0, 4), 0);
});

console.log('growth-hold tests passed');
