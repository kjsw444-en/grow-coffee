import { GROWTH_PER_WATER } from './constants.js'
import { getRitualGiftPassiveMultiplier } from './dailyRitualGifts.js'

/** @deprecated 운세 버프는 선물 보상으로 통합됨 — 호환용 ID만 유지 */
export const RITUAL_FORTUNE_DEFINITIONS = {}

export const RITUAL_FORTUNE_IDS = ['DAILY_GIFT']

export const RITUAL_DAILY_FORTUNE_ID = 'DAILY_GIFT'

export function getRitualFortuneDefinition(fortuneId) {
  if (String(fortuneId ?? '') === RITUAL_DAILY_FORTUNE_ID) {
    return { copyRevealed: null }
  }

  return null
}

export function pickRitualFortuneId(_seed) {
  return RITUAL_DAILY_FORTUNE_ID
}

export function getRitualWaterGrowthDelta(state, baseDelta = GROWTH_PER_WATER) {
  let delta = baseDelta

  const fertilizerCharges = Math.max(0, Number(state?.ritualFertilizerCharges ?? 0))
  if (fertilizerCharges > 0) {
    delta *= 1.3
  }

  return delta
}

export function consumeRitualFertilizerCharge(state) {
  const charges = Math.max(0, Number(state?.ritualFertilizerCharges ?? 0))
  if (charges <= 0) {
    return state
  }

  return {
    ...state,
    ritualFertilizerCharges: charges - 1,
  }
}

export function getRitualPassiveRateMultiplier(state) {
  return getRitualGiftPassiveMultiplier(state)
}

export function getRitualPassiveGrowthDelta(state, quotaDelta) {
  return quotaDelta * getRitualPassiveRateMultiplier(state)
}
