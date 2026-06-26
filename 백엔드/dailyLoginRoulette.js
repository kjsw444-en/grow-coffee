import { getTodayKey } from './waterQuota.js'
import { onRitualRouletteSpun } from './dailyRitualMissions.js'
import { applyBrewedCoffeeDeltaFields, grantBrewedCoffeeFields } from './brewedCoffeeReceived.js'



/** @typedef {1 | 5 | 8 | 10 | 15 | 20 | 50} DailyLoginRouletteCups */



export const DAILY_LOGIN_ROULETTE_SEGMENTS = [1, 5, 8, 10, 15, 20, 50]



export const DAILY_LOGIN_ROULETTE_WEIGHTS = [

  { cups: 1, weight: 60 },

  { cups: 5, weight: 20 },

  { cups: 10, weight: 10 },

  { cups: 15, weight: 5 },

  { cups: 20, weight: 3 },

  { cups: 50, weight: 2 },

]



export function pickDailyLoginRouletteCups(random = Math.random()) {

  const pool = DAILY_LOGIN_ROULETTE_WEIGHTS.filter((item) => item.weight > 0)

  const total = pool.reduce((sum, item) => sum + item.weight, 0)

  let roll = random * total



  for (const item of pool) {

    roll -= item.weight

    if (roll <= 0) {

      return item.cups

    }

  }



  return pool[pool.length - 1]?.cups ?? 1

}



export function readDailyLoginRouletteDayKey(raw) {

  return String(raw?.dailyLoginRouletteDayKey ?? raw?.daily_login_roulette_day_key ?? '')

}



export function readDailyLoginRouletteRespinDayKey(raw) {

  return String(raw?.dailyLoginRouletteRespinDayKey ?? raw?.daily_login_roulette_respin_day_key ?? '')

}



export function readDailyLoginRouletteRewardCups(raw) {

  return Math.max(0, Number(raw?.dailyLoginRouletteRewardCups ?? raw?.daily_login_roulette_reward_cups ?? 0))

}



export function applyDailyLoginRouletteClaim(state, dateKey = getTodayKey()) {

  const claimedDayKey = readDailyLoginRouletteDayKey(state)
  const bonusSpins = Math.max(0, Math.floor(Number(state?.ritualBonusRouletteSpins ?? 0)))

  if (claimedDayKey === dateKey) {
    if (bonusSpins <= 0) {
      return { ok: false, reason: 'already-claimed', state }
    }

    const rewardCups = pickDailyLoginRouletteCups()
    let next = {
      ...state,
      ritualBonusRouletteSpins: bonusSpins - 1,
      dailyLoginRouletteRewardCups: readDailyLoginRouletteRewardCups(state) + rewardCups,
      ...applyBrewedCoffeeDeltaFields(state, rewardCups),
    }
    next = onRitualRouletteSpun(next)

    return {
      ok: true,
      rewardCups,
      bonusSpin: true,
      state: next,
    }
  }

  const rewardCups = pickDailyLoginRouletteCups()

  let next = {
    ...state,
    dailyLoginRouletteDayKey: dateKey,
    dailyLoginRouletteRewardCups: rewardCups,
    dailyLoginRouletteRespinDayKey: '',
    ...grantBrewedCoffeeFields(state, rewardCups),
  }
  next = onRitualRouletteSpun(next)

  return {
    ok: true,
    rewardCups,
    bonusSpin: false,
    state: next,
  }
}



export function applyDailyLoginRouletteRespin(state, dateKey = getTodayKey()) {

  const claimedDayKey = readDailyLoginRouletteDayKey(state)



  if (claimedDayKey !== dateKey) {

    return { ok: false, reason: 'not-claimed', state }

  }



  if (readDailyLoginRouletteRespinDayKey(state) === dateKey) {

    return { ok: false, reason: 'respin-used', state }

  }



  const previousRewardCups = readDailyLoginRouletteRewardCups(state)

  if (previousRewardCups <= 0) {
    return { ok: false, reason: 'reward-state-missing', state }
  }

  const rewardCups = pickDailyLoginRouletteCups()
  const delta = rewardCups - previousRewardCups

  return {
    ok: true,
    rewardCups,
    previousRewardCups,
    state: {
      ...state,
      dailyLoginRouletteRewardCups: rewardCups,
      dailyLoginRouletteRespinDayKey: dateKey,
      ...applyBrewedCoffeeDeltaFields(state, delta),
    },
  }
}

export function applyDailyLoginRouletteRespinWithClientReward(
  state,
  { clientDateKey = '', previousRewardCups = 0 } = {},
  dateKey = getTodayKey(),
) {
  const result = applyDailyLoginRouletteRespin(state, dateKey)

  if (
    result.ok ||
    (result.reason !== 'not-claimed' && result.reason !== 'reward-state-missing')
  ) {
    return result
  }

  const safePreviousRewardCups = Math.max(0, Math.floor(Number(previousRewardCups) || 0))

  if (String(clientDateKey) !== dateKey || safePreviousRewardCups <= 0) {
    return result
  }

  return applyDailyLoginRouletteRespin(
    {
      ...state,
      dailyLoginRouletteDayKey: dateKey,
      dailyLoginRouletteRewardCups: safePreviousRewardCups,
    },
    dateKey,
  )
}


