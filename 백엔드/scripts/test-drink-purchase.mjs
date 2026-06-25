import assert from 'node:assert/strict'
import { COFFEE_VARIANT_PURCHASE_COST } from '../coffeeVariants.js'
import { initialGameState } from '../constants.js'
import { applyDrink, applyPurchaseCoffeeVariant } from '../gameLogic.js'
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
  const result = applyDrink({ ...readyToDrink, totalCoffees: 3, spentCoffeeCups: 1, lifetimeDrunkCoffees: 1 })

  assert.equal(result.ok, true)
  assert.equal(result.state.totalCoffees, 4)
  assert.equal(result.state.spentCoffeeCups, 1)
  assert.equal(result.state.lifetimeDrunkCoffees, 1)
  assert.equal(result.state.growth, 0)
})

test('마시기 — 내린 커피 0이어도 수확 가능', () => {
  const result = applyDrink(readyToDrink)

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

console.log('drink-purchase tests passed')
