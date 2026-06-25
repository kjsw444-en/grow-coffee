import assert from 'node:assert/strict'
import {
  applyDailyLoginRouletteClaim,
  applyDailyLoginRouletteRespin,
  applyDailyLoginRouletteRespinWithClientReward,
  pickDailyLoginRouletteCups,
} from '../dailyLoginRoulette.js'

const weights = [1, 5, 10, 15, 20, 50]
const counts = Object.fromEntries(weights.map((cups) => [cups, 0]))
const trials = 100_000

for (let i = 0; i < trials; i += 1) {
  const cups = pickDailyLoginRouletteCups()
  counts[cups] += 1
}

assert.ok(counts[1] / trials > 0.55 && counts[1] / trials < 0.65, `1잔 비율: ${counts[1] / trials}`)
assert.ok(counts[5] / trials > 0.16 && counts[5] / trials < 0.24, `5잔 비율: ${counts[5] / trials}`)
assert.ok(counts[10] / trials > 0.07 && counts[10] / trials < 0.13, `10잔 비율: ${counts[10] / trials}`)

const today = '2026-06-24'
const first = applyDailyLoginRouletteClaim({ totalCoffees: 0, dailyLoginRouletteDayKey: '' }, today)
assert.equal(first.ok, true)
assert.ok(first.rewardCups >= 1)
assert.equal(first.state.dailyLoginRouletteRewardCups, first.rewardCups)

const second = applyDailyLoginRouletteClaim(first.state, today)
assert.equal(second.ok, false)
assert.equal(second.reason, 'already-claimed')

const respin = applyDailyLoginRouletteRespin(first.state, today)
assert.equal(respin.ok, true)
assert.ok(respin.rewardCups >= 1)
assert.equal(
  respin.state.totalCoffees,
  first.state.totalCoffees - first.rewardCups + respin.rewardCups,
)

const respinAgain = applyDailyLoginRouletteRespin(respin.state, today)
assert.equal(respinAgain.ok, false)
assert.equal(respinAgain.reason, 'respin-used')

const missingReward = applyDailyLoginRouletteRespin(
  { totalCoffees: 10, dailyLoginRouletteDayKey: today, dailyLoginRouletteRewardCups: 0 },
  today,
)
assert.equal(missingReward.ok, false)
assert.equal(missingReward.reason, 'reward-state-missing')

const recoveredRespin = applyDailyLoginRouletteRespinWithClientReward(
  { totalCoffees: 15, dailyLoginRouletteDayKey: '', dailyLoginRouletteRewardCups: 0 },
  { clientDateKey: today, previousRewardCups: 5 },
  today,
)
assert.equal(recoveredRespin.ok, true)
assert.equal(recoveredRespin.previousRewardCups, 5)
assert.equal(recoveredRespin.state.totalCoffees, 15 - 5 + recoveredRespin.rewardCups)

console.log('daily login roulette tests passed')
