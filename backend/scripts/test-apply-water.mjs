import assert from 'node:assert/strict'
import { applyDevTestWater, applyDrink, applyWater, sanitizeLoadedGameState } from '../gameLogic.js'
import { initialGameState, SELL_PRICE } from '../constants.js'

function test(name, fn) {
  fn()
  console.log(`ok: ${name}`)
}

test('물 1회당 growth +25%만 — 방치는 growth에 미반영', () => {
  let state = { ...initialGameState, growth: 0 }
  for (let i = 0; i < 4; i += 1) {
    if (i > 0) {
      state = { ...state, adWaterCredits: 1 }
    }
    const result = applyWater(state)
    assert.equal(result.ok, true, `water ${i + 1} failed: ${result.reason}`)
    state = result.state
  }
  assert.equal(state.growth, 100)
})

test('50%에서 물 1회 → 75% (87% 점프 없음)', () => {
  const state = {
    ...initialGameState,
    growth: 50,
    growthAccrualSyncedAt: new Date(0).toISOString(),
  }
  const result = applyWater(state)
  assert.equal(result.ok, true)
  assert.equal(result.state.growth, 75)
})

test('커피 마시기 시 totalCoffees +1, growth 0, money +47', () => {
  const state = {
    ...initialGameState,
    growth: 100,
    money: 0,
    totalCoffees: 2,
  }
  const result = applyDrink(state)
  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 3)
  assert.equal(result.state.growth, 0)
  assert.equal(result.state.money, SELL_PRICE)
  assert.equal(result.lastEarned, SELL_PRICE)
})

test('물주기 4회 후 마시기 — growth 0으로 새 사이클', () => {
  let state = { ...initialGameState, growth: 0 }
  for (let i = 0; i < 4; i += 1) {
    if (i > 0) {
      state = { ...state, adWaterCredits: 1 }
    }
    const water = applyWater(state)
    assert.equal(water.ok, true)
    state = water.state
  }
  assert.equal(state.growth, 100)

  const drink = applyDrink(state)
  assert.equal(drink.ok, true)
  assert.equal(drink.state.growth, 0)
  assert.equal(drink.state.totalCoffees, 1)
})

test('물 2회인데 growth 100 — 로드 시 50%로 보정', () => {
  const state = sanitizeLoadedGameState({
    ...initialGameState,
    growth: 100,
    totalWaters: 2,
  })
  assert.equal(state.growth, 50)
})

test('보정된 50%에서는 마시기 불가', () => {
  const state = sanitizeLoadedGameState({
    ...initialGameState,
    growth: 100,
    totalWaters: 2,
  })
  const drink = applyDrink(state)
  assert.equal(drink.ok, false)
  assert.equal(drink.reason, 'not-ready')
})

test('DEV 테스트 bump — 연속 4회로 100%, 일일 quota 무시', () => {
  let state = { ...initialGameState, growth: 0 }
  for (let i = 0; i < 4; i += 1) {
    const result = applyDevTestWater(state)
    assert.equal(result.ok, true, `dev bump ${i + 1} failed`)
    state = result.state
  }
  assert.equal(state.growth, 100)
  assert.equal(state.totalWaters, 4)
})

console.log('apply-water tests passed')
