import assert from 'node:assert/strict'
import { applyDevTestWater, applyClaimPassiveCoffee, applyDrink, applyReactivatePassiveCoffee, applyReset, applySellBatch, applyWater, sanitizeLoadedGameState } from '../gameLogic.js'
import { initialGameState, SELL_BATCH_REWARD } from '../constants.js'
import { settlePassiveGrowth } from '../passiveGrowth.js'

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
    dailyPassiveGrowth: 130,
    passiveDayKey: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
  }
  const result = applyDrink(state)
  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 3)
  assert.equal(result.state.money, 100)
  assert.equal(result.state.growth, 0)
  assert.ok(result.state.dailyPassiveGrowth >= 130)
  assert.equal(result.lastEarned, null)
})

test('성장 100%여도 방치 누적(dailyPassiveGrowth)은 계속 증가', () => {
  const dayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const past = new Date(Date.now() - 20 * 60 * 1000)
  const state = {
    ...initialGameState,
    growth: 100,
    dailyPassiveGrowth: 0,
    passiveDayKey: dayKey,
    growthAccrualSyncedAt: past.toISOString(),
  }
  const next = settlePassiveGrowth(state)
  assert.equal(next.growth, 100)
  assert.ok(next.dailyPassiveGrowth >= 99, `expected ~100 passive, got ${next.dailyPassiveGrowth}`)
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

test('방치는 커피나무 growth와 분리 — dailyPassiveGrowth만 증가', () => {
  const dayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const past = new Date(Date.now() - 21 * 60 * 1000)
  let state = {
    ...initialGameState,
    growth: 0,
    totalWaters: 0,
    dailyPassiveGrowth: 0,
    passiveCoffeesClaimed: 0,
    passiveDayKey: dayKey,
    growthAccrualSyncedAt: past.toISOString(),
  }

  state = settlePassiveGrowth(state)
  assert.ok(state.dailyPassiveGrowth >= 100, 'passive should accrue to 100%+')
  assert.equal(state.growth, 0, 'passive must not change tree growth')
  assert.equal(applyDrink(state).ok, false, 'tree drink requires watering, not passive')
})

test('방치 커피 — 100% 충전 후 받기 버튼으로만 내린 커피 +1', () => {
  const dayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const past = new Date(Date.now() - 21 * 60 * 1000)
  let state = {
    ...initialGameState,
    growth: 0,
    totalCoffees: 3,
    dailyPassiveGrowth: 0,
    passiveCoffeesClaimed: 0,
    passiveDayKey: dayKey,
    growthAccrualSyncedAt: past.toISOString(),
  }

  state = settlePassiveGrowth(state)
  assert.ok(state.dailyPassiveGrowth >= 100, 'passive should accrue to 100%+')
  assert.equal(state.growth, 0, 'passive must not change tree growth')
  assert.equal(state.totalCoffees, 3, 'passive must not auto-add brewed coffee')

  const claim = applyClaimPassiveCoffee(state)
  assert.equal(claim.ok, true, `claim failed: ${claim.reason}`)
  assert.equal(claim.state.totalCoffees, 4)
  assert.equal(claim.state.passiveCoffeesClaimed, 1)
  assert.ok(claim.state.dailyPassiveGrowth < 100, 'claim should consume 100% growth')

  const unclaimed = Math.max(0, claim.state.dailyPassiveGrowth - claim.state.passiveCoffeesClaimed * 100)
  assert.ok(unclaimed < 100, `gauge should reset after claim, unclaimed=${unclaimed}`)
})

test('방치 커피 — 200% 누적 상태에서 받아도 게이지 초기화', () => {
  const dayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const state = {
    ...initialGameState,
    totalCoffees: 3,
    dailyPassiveGrowth: 200,
    passiveCoffeesClaimed: 0,
    passiveDayKey: dayKey,
  }

  const claim = applyClaimPassiveCoffee(state)
  assert.equal(claim.ok, true)
  assert.equal(claim.state.passiveCoffeesClaimed, 1)
  assert.equal(claim.state.totalCoffees, 4)
  assert.equal(claim.state.dailyPassiveGrowth, 100)

  const unclaimed = Math.max(0, claim.state.dailyPassiveGrowth - claim.state.passiveCoffeesClaimed * 100)
  assert.equal(unclaimed, 0, `expected 0 unclaimed after buffered claim, got ${unclaimed}`)
})

test('방치 커피 재활성 — 2/2 후 광고 사이클 리셋', () => {
  const dayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const state = {
    ...initialGameState,
    dailyPassiveGrowth: 200,
    passiveCoffeesClaimed: 2,
    passiveDayKey: dayKey,
    passiveReactivateDayKey: '',
  }

  const reactivate = applyReactivatePassiveCoffee(state)
  assert.equal(reactivate.ok, true, `reactivate failed: ${reactivate.reason}`)
  assert.equal(reactivate.state.passiveCoffeesClaimed, 0)
  assert.equal(reactivate.state.dailyPassiveGrowth, 0)
  assert.equal(reactivate.state.passiveReactivateDayKey, dayKey)

  const again = applyReactivatePassiveCoffee(reactivate.state)
  assert.equal(again.ok, false)
  assert.equal(again.reason, 'not-complete')
})

test('진행 데이터 초기화 — 방치·성장·재화 모두 0으로', () => {
  const dayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const dirty = {
    ...initialGameState,
    growth: 100,
    money: 940,
    totalCoffees: 20,
    totalWaters: 40,
    dailyPassiveGrowth: 200,
    passiveCoffeesClaimed: 2,
    passiveDayKey: dayKey,
    passiveReactivateDayKey: dayKey,
    spentCoffeeCups: 15,
    watersToday: 3,
    adWaterCredits: 2,
  }

  const reset = applyReset()
  assert.equal(reset.ok, true)
  assert.equal(reset.state.growth, 0)
  assert.equal(reset.state.money, 0)
  assert.equal(reset.state.totalCoffees, 0)
  assert.equal(reset.state.totalWaters, 0)
  assert.equal(reset.state.dailyPassiveGrowth, 0)
  assert.equal(reset.state.passiveCoffeesClaimed, 0)
  assert.equal(reset.state.passiveReactivateDayKey, '')
  assert.equal(reset.state.spentCoffeeCups, 0)
  assert.equal(reset.state.watersToday, 0)
  assert.equal(reset.state.adWaterCredits, 0)
})

console.log('apply-water tests passed')
