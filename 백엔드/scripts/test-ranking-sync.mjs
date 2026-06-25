import assert from 'node:assert/strict'
import { applyPurchaseCoffeeVariant, applySellBatch } from '../gameLogic.js'
import { initialGameState } from '../constants.js'
import { COFFEE_VARIANT_PURCHASE_COST, getPurchasableCoffeeVariantSlugs } from '../coffeeVariants.js'
import { getRankingBrewedSpend } from '../gameLogic.js'
import { submitRanking, syncRankingFromGameState } from '../ranking.js'

async function test(name, fn) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`fail - ${name}`)
    throw error
  }
}

const userId = 'test-ranking-user'

await test('랭킹 점수 — sell-batch만 누적, 상점 구매는 차감 안 됨', () => {
  const sold = applySellBatch({ ...initialGameState, totalCoffees: 100 }, 100)
  assert.equal(sold.ok, true)
  assert.equal(getRankingBrewedSpend(sold.state), 100)

  const purchased = applyPurchaseCoffeeVariant(sold.state, getPurchasableCoffeeVariantSlugs()[0])
  assert.equal(purchased.ok, true)
  assert.equal(purchased.state.spentCoffeeCups, 0)
  assert.equal(getRankingBrewedSpend(purchased.state), 100)
})

await test('점수 감소 — 초기화 후 0잔으로 랭킹 동기화', async () => {
  await submitRanking(userId, 50, '커피 농부')
  const synced = await syncRankingFromGameState(userId, { lifetimeBrewedSpent: 0 }, '커피 농부')

  assert.equal(synced.playerSpentCoffeeCups, 0)
  const playerRow = synced.top50.find((entry) => entry.isPlayer)
  assert.equal(playerRow?.spentCoffeeCups, 0)
})

await test('목록·요약 점수 일치', async () => {
  const result = await submitRanking(userId, 12, '커피 농부')

  assert.equal(result.playerSpentCoffeeCups, 12)
  const playerRow = result.top50.find((entry) => entry.isPlayer)
  assert.equal(playerRow?.spentCoffeeCups, 12)
})

console.log('ranking-sync tests passed')
