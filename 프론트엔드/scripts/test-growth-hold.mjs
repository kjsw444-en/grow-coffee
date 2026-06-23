import assert from 'node:assert/strict';



const GROWTH_PER_WATER = 25;



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



test('서버 불일치 시 물 1회당 +25%만 반영 — 0%에서 75% 점프 방지', () => {

  assert.equal(resolveWaterSyncGrowth(0, 75), 25);

  assert.equal(resolveWaterSyncGrowth(0, 50), 25);

  assert.equal(resolveWaterSyncGrowth(25, 75), 50);

  assert.equal(resolveWaterSyncGrowth(50, 87), 75);

  assert.equal(resolveWaterSyncGrowth(50, 75), 75);

  assert.equal(resolveWaterSyncGrowth(75, 100), 100);

});



test('방치는 커피나무 growth를 올리지 않음', () => {

  assert.equal(previewPassiveDisplayGrowth(50, 50), 50);

  assert.equal(previewPassiveDisplayGrowth(100, 0), 100);

});



test('growth 100은 물주기 횟수와 무관하게 유지', () => {

  assert.equal(sanitizeGrowthForWaters(100), 100);

  assert.equal(isReadyToDrinkGrowth(sanitizeGrowthForWaters(100)), true);

});



console.log('growth-hold tests passed');

