import assert from 'node:assert/strict'
import { applyDevTestWater, applyDrink, applySellBatch, applyWater, sanitizeLoadedGameState } from '../gameLogic.js'
import { initialGameState, SELL_BATCH_REWARD } from '../constants.js'

function test(name, fn) {
  fn()
  console.log(`ok: ${name}`)
}

test('물 1회당 growth +25% — 방치 settle과 함께 동작', () => {
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

test('커피 마시기 — totalCoffees +1, growth 0, money 변화 없음', () => {
  const state = {
    ...initialGameState,
    growth: 100,
    money: 100,
    totalCoffees: 2,
  }
  const result = applyDrink(state)
  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 3)
  assert.equal(result.state.money, 100)
  assert.equal(result.lastEarned, null)
})

test('10잔 판매 — totalCoffees -10, money +47', () => {
  const state = {
    ...initialGameState,
    totalCoffees: 12,
    money: 0,
  }
  const result = applySellBatch(state)
  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 2)
  assert.equal(result.state.money, SELL_BATCH_REWARD)
})

test('방치로 100% — 물주기 없이도 로드·마시기 가능', () => {
  const state = sanitizeLoadedGameState({
    ...initialGameState,
    growth: 100,
    totalWaters: 0,
  })
  assert.equal(state.growth, 100)
  assert.equal(applyDrink(state).ok, true)
})

console.log('apply-water tests passed')
