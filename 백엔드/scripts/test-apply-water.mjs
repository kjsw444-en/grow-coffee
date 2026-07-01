import assert from 'node:assert/strict'
import {
  applyClaimPassiveCoffee,
  applyDevTestWater,
  applyDrink,
  applyPurchaseCoffeeVariant,
  applySellBatch,
  applyWater,
  applyWaterFinalizeCycle,
  sanitizeLoadedGameState,
} from '../gameLogic.js'
import { COFFEE_VARIANT_PURCHASE_COST, DEFAULT_COFFEE_VARIANT_SLUG } from '../coffeeVariants.js'
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

test('하이브리드 — pending 3 + finalize 1회로 growth 100%', () => {
  const state = { ...initialGameState, growth: 0, adWaterCredits: 3 }
  const finalize = applyWaterFinalizeCycle(state, 3)
  assert.equal(finalize.ok, true, finalize.reason)
  assert.equal(finalize.state.growth, 100)
  assert.equal(finalize.state.totalWaters, 4)
})

test('커피 마시기 — 내린 커피 +1, spentCoffeeCups·lifetimeDrunkCoffees 유지', () => {
  const state = {
    ...initialGameState,
    growth: 100,
    money: 100,
    totalCoffees: 2,
    spentCoffeeCups: 5,
    lifetimeDrunkCoffees: 5,
    dailyPassiveGrowth: 130,
    passiveDayKey: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
  }
  const result = applyDrink(state, { randomValue: 0 })
  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 3)
  assert.equal(result.state.spentCoffeeCups, 5)
  assert.equal(result.state.lifetimeDrunkCoffees, 5)
  assert.equal(result.state.money, 100)
  assert.equal(result.state.growth, 0)
  assert.equal(result.lastEarned, 1)
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

test('50잔 마시기 — totalCoffees -50, spentCoffeeCups +50, money +100', () => {
  const state = {
    ...initialGameState,
    totalCoffees: 52,
    money: 0,
  }
  const result = applySellBatch(state, 50)
  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 2)
  assert.equal(result.state.spentCoffeeCups, 50)
  assert.equal(result.state.lifetimeDrunkCoffees, 50)
  assert.equal(result.state.money, SELL_BATCH_REWARD)
})

test('1000잔 마시기 — money +2000', () => {
  const state = {
    ...initialGameState,
    totalCoffees: 1000,
    money: 0,
  }
  const result = applySellBatch(state, 1000)
  assert.equal(result.ok, true)
  assert.equal(result.state.money, 2000)
  assert.equal(result.dailyCapJustReached, false)
  assert.equal(result.state.redeemed, false)
})

test('2350잔 마시기 — money +4700', () => {
  const state = {
    ...initialGameState,
    totalCoffees: 2350,
    money: 0,
  }
  const result = applySellBatch(state, 2350)
  assert.equal(result.ok, true)
  assert.equal(result.state.money, 4700)
  assert.equal(result.dailyCapJustReached, true)
  assert.equal(result.state.redeemed, false)
})

test('캐릭터 구매 — spentCoffeeCups -100, lifetimeDrunkCoffees 유지', () => {
  const slug = 'student-coldbrew'
  const state = {
    ...initialGameState,
    spentCoffeeCups: COFFEE_VARIANT_PURCHASE_COST,
    lifetimeDrunkCoffees: COFFEE_VARIANT_PURCHASE_COST,
    totalCoffees: 50,
    ownedCoffeeVariants: [DEFAULT_COFFEE_VARIANT_SLUG],
  }
  const result = applyPurchaseCoffeeVariant(state, slug)
  assert.equal(result.ok, true, result.reason)
  assert.equal(result.state.spentCoffeeCups, 0)
  assert.equal(result.state.lifetimeDrunkCoffees, COFFEE_VARIANT_PURCHASE_COST)
  assert.equal(result.state.totalCoffees, 50)
  assert.ok(result.state.ownedCoffeeVariants.includes(slug))
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
  assert.equal(applyDrink(state, { randomValue: 0 }).ok, false, 'tree drink requires watering, not passive')
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

  const unclaimed = Math.max(0, claim.state.dailyPassiveGrowth - claim.state.passiveCoffeesClaimed * 100)
  assert.ok(unclaimed < 100, `gauge should reset after claim, unclaimed=${unclaimed}`)
})

console.log('apply-water tests passed')
