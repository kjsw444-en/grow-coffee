import assert from 'node:assert/strict';

const GROWTH_PER_WATER = 25;

function roundGrowth(value) {
  return Math.round(value * 1e7) / 1e7;
}

function normalizeHybridServerGrowth(serverGrowth) {
  return roundGrowth(serverGrowth) >= 100 ? 100 : 0;
}

function serverGrowthForPending(holdStartGrowth, serverGrowth) {
  const hold = roundGrowth(holdStartGrowth);
  const server = roundGrowth(serverGrowth);
  if (server >= 100 && hold < 100) return 0;
  return normalizeHybridServerGrowth(server);
}

function getPendingLocalWaters(holdStartGrowth, serverGrowth, options = {}) {
  const holdWaters = Math.floor(roundGrowth(holdStartGrowth) / GROWTH_PER_WATER);
  const serverWaters = Math.floor(
    serverGrowthForPending(holdStartGrowth, serverGrowth) / GROWTH_PER_WATER,
  );
  let pending = Math.max(0, holdWaters - serverWaters);
  if (options.finalStroke && roundGrowth(holdStartGrowth + GROWTH_PER_WATER) >= 100) {
    pending = Math.max(pending, holdWaters);
  }
  return pending;
}

function test(name, fn) {
  fn();
  console.log(`ok: ${name}`);
}

test('serverGrowthForPending — ref 100%·hold 75% → 미동기화(0%)', () => {
  assert.equal(serverGrowthForPending(75, 100), 0);
});

test('getPendingLocalWaters — 75%→100% finalize는 pending 3', () => {
  assert.equal(getPendingLocalWaters(75, 0), 3);
  assert.equal(getPendingLocalWaters(75, 100, { finalStroke: true }), 3);
  assert.equal(getPendingLocalWaters(75, 100), 3);
});

console.log('local-tree-growth tests passed');
