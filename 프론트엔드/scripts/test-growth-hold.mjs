import assert from 'node:assert/strict';

const GROWTH_PER_WATER = 25;
const COFFEE_STAGE_MIN = 75;

function roundGrowth(value) {
  return Math.round(value * 1e7) / 1e7;
}

function previewSeedHoldGrowth(startGrowth, holdProgress) {
  const progress = Math.min(100, Math.max(0, holdProgress)) / 100;
  const start = roundGrowth(startGrowth);
  if (start >= COFFEE_STAGE_MIN) {
    return roundGrowth(start);
  }
  return roundGrowth(start + (COFFEE_STAGE_MIN - start) * progress);
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

function commitSeedHoldGrowth(startGrowth) {
  const start = roundGrowth(startGrowth);
  if (start >= COFFEE_STAGE_MIN) {
    return roundGrowth(Math.min(100, start + GROWTH_PER_WATER));
  }
  return COFFEE_STAGE_MIN;
}

function commitWaterGrowth(startGrowth) {
  return roundGrowth(Math.min(100, startGrowth + GROWTH_PER_WATER));
}

function resolveWaterSyncGrowth(holdStartGrowth, serverGrowth) {
  const start = roundGrowth(holdStartGrowth);
  const expected = start < COFFEE_STAGE_MIN ? COFFEE_STAGE_MIN : commitWaterGrowth(start);
  const server = roundGrowth(serverGrowth);

  if (server > expected) return expected;
  return server;
}

function reconcileMilestoneServerGrowth(holdStart, previewGrowth, serverGrowth) {
  const expected = roundGrowth(previewGrowth);
  const server = roundGrowth(serverGrowth);
  const start = roundGrowth(holdStart);

  if (server >= expected - 0.01) {
    return server;
  }

  if (start < COFFEE_STAGE_MIN && expected >= COFFEE_STAGE_MIN) {
    return expected;
  }

  if (start >= COFFEE_STAGE_MIN && expected >= 100) {
    return expected;
  }

  return server;
}

function preserveGrowthOnQuotaResponse(localGrowth, serverGrowth) {
  const local = roundGrowth(localGrowth);
  const server = roundGrowth(serverGrowth);
  if (server < local - 0.01) {
    return local;
  }
  return server;
}

function isStaleMilestoneSyncJob(currentGrowth, previewGrowth) {
  return roundGrowth(currentGrowth) > roundGrowth(previewGrowth) + 0.01;
}

function mergeMilestoneAuthoritativeGrowth(currentGrowth, reconciledGrowth) {
  return Math.max(roundGrowth(currentGrowth), roundGrowth(reconciledGrowth));
}

function snapAuthoritativeTreeGrowth(growth) {
  const value = roundGrowth(Math.min(100, Math.max(0, growth)));
  if (value >= 100) return 100;
  if (value >= COFFEE_STAGE_MIN) return COFFEE_STAGE_MIN;
  if (value <= 0) return 0;
  return Math.round(value / GROWTH_PER_WATER) * GROWTH_PER_WATER;
}

const PRE_DRINK_DISPLAY_MAX = 99.9999999;

function previewPassiveDisplayGrowth(authoritativeGrowth, _passivePreviewDelta) {
  return roundGrowth(Math.min(100, Math.max(0, authoritativeGrowth)));
}

function previewHoldDisplayGrowth(authStartGrowth, _displayStartGrowth, holdProgress) {
  return previewHoldGrowth(authStartGrowth, holdProgress);
}

function isReadyToDrinkGrowth(authoritativeGrowth) {
  return roundGrowth(authoritativeGrowth) >= 100;
}

function sanitizeGrowthForWaters(growth) {
  return roundGrowth(Math.min(100, Math.max(0, growth)));
}

function test(name, fn) {
  fn();
  console.log(`ok: ${name}`);
}

test('0% 홀드 완료 → 75%', () => {
  assert.equal(commitSeedHoldGrowth(0), 75);
  assert.equal(isReadyToDrinkGrowth(75), false);
});

test('75% 홀드 완료 → 100%', () => {
  assert.equal(commitWaterGrowth(75), 100);
  assert.equal(isReadyToDrinkGrowth(100), true);
});

test('0% 홀드 미리보기 — 단계 이미지·성장률 비례', () => {
  assert.equal(previewSeedHoldGrowth(0, 0), 0);
  assert.ok(Math.abs(previewSeedHoldGrowth(0, 33.33) - 25) < 0.1);
  assert.ok(Math.abs(previewSeedHoldGrowth(0, 66.67) - 50) < 0.1);
  assert.equal(previewSeedHoldGrowth(0, 100), 75);
});

test('75% 홀드 미리보기 — 100% 미리보기는 PRE_DRINK_DISPLAY_MAX', () => {
  assert.equal(previewHoldGrowth(75, 50), 87.5);
  assert.equal(previewHoldGrowth(75, 100), PRE_DRINK_DISPLAY_MAX);
});

test('방치는 커피나무 게이지와 분리', () => {
  assert.equal(previewPassiveDisplayGrowth(50, 24), 50);
  assert.equal(previewPassiveDisplayGrowth(75, 25), 75);
  assert.equal(isReadyToDrinkGrowth(75), false);
});

test('display 100 + state 75 조합은 마시기 불가', () => {
  assert.equal(isReadyToDrinkGrowth(75), false);
});

test('홀드 미리보기는 방치 headroom 없이 state 기준만', () => {
  assert.equal(previewHoldDisplayGrowth(75, 99, 50), 87.5);
  assert.equal(previewHoldDisplayGrowth(75, 99, 100), PRE_DRINK_DISPLAY_MAX);
});

test('서버 동기화 — seed hold는 75%, brew hold는 +25%', () => {
  assert.equal(resolveWaterSyncGrowth(0, 75), 75);
  assert.equal(resolveWaterSyncGrowth(0, 25), 25);
  assert.equal(resolveWaterSyncGrowth(75, 100), 100);
  assert.equal(resolveWaterSyncGrowth(75, 87), 87);
});

test('마일스톤 동기화 — 구서버 25% 응답은 75%로 보정', () => {
  assert.equal(reconcileMilestoneServerGrowth(0, 75, 25), 75);
  assert.equal(reconcileMilestoneServerGrowth(0, 75, 75), 75);
  assert.equal(reconcileMilestoneServerGrowth(75, 100, 87), 100);
  assert.equal(reconcileMilestoneServerGrowth(75, 100, 100), 100);
});

test('광고 응답 — growth 미변경, 서버가 낮으면 로컬 유지', () => {
  assert.equal(preserveGrowthOnQuotaResponse(75, 25), 75);
  assert.equal(preserveGrowthOnQuotaResponse(75, 75), 75);
  assert.equal(preserveGrowthOnQuotaResponse(25, 75), 75);
});

test('늦은 마일스톤 동기화 — 이미 100%면 75% job 스킵', () => {
  assert.equal(isStaleMilestoneSyncJob(100, 75), true);
  assert.equal(isStaleMilestoneSyncJob(75, 75), false);
  assert.equal(mergeMilestoneAuthoritativeGrowth(100, 75), 100);
});

test('확정 성장률 — 마일스톤 스냅', () => {
  assert.equal(snapAuthoritativeTreeGrowth(0), 0);
  assert.equal(snapAuthoritativeTreeGrowth(24), 25);
  assert.equal(snapAuthoritativeTreeGrowth(74), 75);
  assert.equal(snapAuthoritativeTreeGrowth(87), 75);
  assert.equal(snapAuthoritativeTreeGrowth(100), 100);
});

test('방치는 커피나무 growth를 올리지 않음', () => {
  assert.equal(previewPassiveDisplayGrowth(50, 50), 50);
  assert.equal(previewPassiveDisplayGrowth(100, 0), 100);
});

test('growth 100은 물주기 횟수와 무관하게 유지', () => {
  assert.equal(sanitizeGrowthForWaters(100), 100);
});

console.log('growth-hold tests passed');
