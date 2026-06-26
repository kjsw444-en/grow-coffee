import assert from 'node:assert/strict'
import { applyPurchaseCoffeeVariant, applySellBatch } from '../gameLogic.js'
import { initialGameState } from '../constants.js'
import { getPurchasableCoffeeVariantSlugs } from '../coffeeVariants.js'
import { getDailyRankingBrewedSpend, getRankingBrewedSpend } from '../gameLogic.js'
import { grantBrewedCoffeeFields } from '../brewedCoffeeReceived.js'
import { submitRanking, syncRankingFromGameState, getRankingTop3RewardStatus } from '../ranking.js'
import { patchLocalDb } from '../store.js'
import { getTodayKey, getYesterdayKey } from '../waterQuota.js'

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

await test('랭킹 점수 — 내린 커피 수령만 누적, sell-batch·상점 구매는 반영 안 됨', () => {
  let state = { ...initialGameState, ...grantBrewedCoffeeFields(initialGameState, 100) }
  assert.equal(getRankingBrewedSpend(state), 100)
  assert.equal(getDailyRankingBrewedSpend(state), 100)

  const sold = applySellBatch({ ...state, totalCoffees: 100 }, 100)
  assert.equal(sold.ok, true)
  assert.equal(getDailyRankingBrewedSpend(sold.state), 100)

  const purchased = applyPurchaseCoffeeVariant(sold.state, getPurchasableCoffeeVariantSlugs()[0])
  assert.equal(purchased.ok, true)
  assert.equal(purchased.state.spentCoffeeCups, 0)
  assert.equal(getDailyRankingBrewedSpend(purchased.state), 100)
})

await test('점수 감소 — 초기화 후 0잔으로 랭킹 동기화', async () => {
  await submitRanking(userId, 50, '커피 농부')
  const synced = await syncRankingFromGameState(
    userId,
    { dailyBrewedReceivedDayKey: getTodayKey(), dailyBrewedReceived: 0 },
    '커피 농부',
  )

  assert.equal(synced.playerSpentCoffeeCups, 0)
  const playerRow = synced.top50.find((entry) => entry.isPlayer)
  assert.equal(playerRow?.spentCoffeeCups, 0)
})

await test('목록·요약 점수 일치', async () => {
  const result = await submitRanking(userId, 12, '커피 농부')

  assert.equal(result.playerSpentCoffeeCups, 12)
  assert.equal(result.dayKey, getTodayKey())
  const playerRow = result.top50.find((entry) => entry.isPlayer)
  assert.equal(playerRow?.spentCoffeeCups, 12)
})

await test('일일 랭킹 — 어제 점수는 오늘 랭킹에서 0으로 동기화', async () => {
  const synced = await syncRankingFromGameState(
    userId,
    { dailyBrewedReceivedDayKey: '2020-01-01', dailyBrewedReceived: 999 },
    '커피 농부',
  )

  assert.equal(synced.playerSpentCoffeeCups, 0)
})

await test('마감 랭킹 — 어제 TOP3만 보상 대상', async () => {
  const yesterday = getYesterdayKey()
  const winnerId = 'test-ranking-winner'
  const runnerId = 'test-ranking-runner'

  patchLocalDb((db) => {
    db.rankingDailyEntries ??= {}
    db.rankingDailyEntries[`${winnerId}:${yesterday}`] = {
      userId: winnerId,
      dayKey: yesterday,
      displayName: '1등',
      spentCoffeeCups: 500,
      updatedAt: `${yesterday}T23:59:00+09:00`,
    }
    db.rankingDailyEntries[`rank-2:${yesterday}`] = {
      userId: 'rank-2',
      dayKey: yesterday,
      displayName: '2등',
      spentCoffeeCups: 400,
      updatedAt: `${yesterday}T23:59:00+09:00`,
    }
    db.rankingDailyEntries[`rank-3:${yesterday}`] = {
      userId: 'rank-3',
      dayKey: yesterday,
      displayName: '3등',
      spentCoffeeCups: 300,
      updatedAt: `${yesterday}T23:59:00+09:00`,
    }
    db.rankingDailyEntries[`${runnerId}:${yesterday}`] = {
      userId: runnerId,
      dayKey: yesterday,
      displayName: '4등',
      spentCoffeeCups: 10,
      updatedAt: `${yesterday}T23:59:00+09:00`,
    }
  })

  const winnerStatus = await getRankingTop3RewardStatus(winnerId)
  assert.equal(winnerStatus.rewardDayKey, yesterday)
  assert.equal(winnerStatus.playerRank, 1)
  assert.equal(winnerStatus.canClaim, true)

  const runnerStatus = await getRankingTop3RewardStatus(runnerId)
  assert.equal(runnerStatus.canClaim, false)
})

console.log('ranking-sync tests passed')
