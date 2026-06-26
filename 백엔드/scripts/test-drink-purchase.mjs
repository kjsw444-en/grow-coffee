import assert from 'node:assert/strict'
import { COFFEE_VARIANT_PURCHASE_COST } from '../coffeeVariants.js'
import { BREWED_COFFEE_FINISH_BONUS_AMOUNT, BREWED_COFFEE_FINISH_BONUS_THRESHOLD, initialGameState } from '../constants.js'
import { applyClaimBrewedCoffeeFinishBonus, applyDrink, applyPurchaseCoffeeVariant, pickTreeHarvestRewardCups } from '../gameLogic.js'
import { getAvailableCoffeeCups } from '../coffeeVariants.js'

function test(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`fail - ${name}`)
    throw error
  }
}

const readyToDrink = {
  ...initialGameState,
  growth: 100,
}

test('마시기 — 내린 커피 +1, spentCoffeeCups·lifetimeDrunkCoffees 유지', () => {
  const result = applyDrink(
    { ...readyToDrink, totalCoffees: 3, spentCoffeeCups: 1, lifetimeDrunkCoffees: 1 },
    { randomValue: 0 },
  )

  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 4)
  assert.equal(result.state.spentCoffeeCups, 1)
  assert.equal(result.state.lifetimeDrunkCoffees, 1)
  assert.equal(result.state.growth, 0)
})

test('마시기 — 내린 커피 0이어도 수확 가능', () => {
  const result = applyDrink(readyToDrink, { randomValue: 0 })

  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 1)
  assert.equal(result.state.spentCoffeeCups, 0)
  assert.equal(result.state.lifetimeDrunkCoffees, 0)
})

test('getAvailableCoffeeCups — spentCoffeeCups 잔고 반환', () => {
  assert.equal(getAvailableCoffeeCups({ spentCoffeeCups: 42, totalCoffees: 999 }), 42)
})

test('캐릭터 구매 — spentCoffeeCups -100, totalCoffees 유지', () => {
  const rich = {
    ...readyToDrink,
    spentCoffeeCups: COFFEE_VARIANT_PURCHASE_COST,
    totalCoffees: 50,
  }

  const result = applyPurchaseCoffeeVariant(rich, 'student-coldbrew')

  assert.equal(result.ok, true)
  assert.equal(result.state.spentCoffeeCups, 0)
  assert.equal(result.state.totalCoffees, 50)
  assert.ok(result.state.ownedCoffeeVariants.includes('student-coldbrew'))
})

test('캐릭터 구매 — 마신 커피 부족', () => {
  const poor = {
    ...readyToDrink,
    spentCoffeeCups: COFFEE_VARIANT_PURCHASE_COST - 1,
  }

  const result = applyPurchaseCoffeeVariant(poor, 'student-coldbrew')

  assert.equal(result.ok, false)
  assert.equal(result.reason, 'not-enough-cups')
})

test('50잔 직전 부스트 — 48잔부터 +2잔', () => {
  const tooEarly = applyClaimBrewedCoffeeFinishBonus({
    ...initialGameState,
    totalCoffees: BREWED_COFFEE_FINISH_BONUS_THRESHOLD - 1,
  })
  assert.equal(tooEarly.ok, false)
  assert.equal(tooEarly.reason, 'not-close-enough')

  const result = applyClaimBrewedCoffeeFinishBonus({
    ...initialGameState,
    totalCoffees: BREWED_COFFEE_FINISH_BONUS_THRESHOLD,
  })
  assert.equal(result.ok, true)
  assert.equal(result.rewardCups, BREWED_COFFEE_FINISH_BONUS_AMOUNT)
  assert.equal(result.state.totalCoffees, 50)
})

test('커피나무 수확 랜덤 보상 — 1~5잔 가중치', () => {
  assert.equal(pickTreeHarvestRewardCups(0), 1)
  assert.equal(pickTreeHarvestRewardCups(0.6999), 1)
  assert.equal(pickTreeHarvestRewardCups(0.7), 2)
  assert.equal(pickTreeHarvestRewardCups(0.8999), 2)
  assert.equal(pickTreeHarvestRewardCups(0.9), 3)
  assert.equal(pickTreeHarvestRewardCups(0.9699), 3)
  assert.equal(pickTreeHarvestRewardCups(0.97), 4)
  assert.equal(pickTreeHarvestRewardCups(0.9899), 4)
  assert.equal(pickTreeHarvestRewardCups(0.99), 5)
  assert.equal(pickTreeHarvestRewardCups(0.9999), 5)
})

console.log('drink-purchase tests passed')
