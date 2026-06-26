import assert from 'node:assert/strict'

function canClaimDailyLoginRouletteToday(dailyLoginRouletteDayKey, dateKey) {
  return String(dailyLoginRouletteDayKey ?? '') !== dateKey
}

function canSpinDailyLoginRouletteToday(state, dateKey) {
  if (canClaimDailyLoginRouletteToday(state.dailyLoginRouletteDayKey, dateKey)) {
    return true
  }
  return Math.max(0, Number(state.ritualBonusRouletteSpins ?? 0)) > 0
}

function hasPendingBonusRouletteSpin(state, dateKey) {
  return (
    String(state.dailyLoginRouletteDayKey ?? '') === dateKey &&
    Math.max(0, Number(state.ritualBonusRouletteSpins ?? 0)) > 0
  )
}

const today = '2025-06-27'

assert.equal(canSpinDailyLoginRouletteToday({ dailyLoginRouletteDayKey: '', ritualBonusRouletteSpins: 0 }, today), true)
assert.equal(
  canSpinDailyLoginRouletteToday({ dailyLoginRouletteDayKey: today, ritualBonusRouletteSpins: 0 }, today),
  false,
)
assert.equal(
  canSpinDailyLoginRouletteToday({ dailyLoginRouletteDayKey: today, ritualBonusRouletteSpins: 1 }, today),
  true,
)
assert.equal(
  hasPendingBonusRouletteSpin({ dailyLoginRouletteDayKey: today, ritualBonusRouletteSpins: 1 }, today),
  true,
)
assert.equal(
  hasPendingBonusRouletteSpin({ dailyLoginRouletteDayKey: '', ritualBonusRouletteSpins: 1 }, today),
  false,
)

console.log('bonus roulette nudge tests passed')
