import { getTodayKey } from './waterQuota.js'

import {
  normalizeDailyRitual,
  resolveDailyRitual,
  applyRitualFortuneReveal,
  applyRitualGiftOpen,
  ritualSeed,
} from './dailyRitual.js'
import { RITUAL_DAILY_FORTUNE_ID } from './dailyRitualFortunes.js'
import { pickRitualGiftId, RITUAL_GIFT_IDS } from './dailyRitualGifts.js'

import {

  markRitualMissionSlotDone,

  onRitualMinigamePlayed,

  onRitualRouletteSpun,

  RITUAL_DAILY_MISSION_SET,

} from './dailyRitualMissions.js'



export function applyDevResetDailyRitual(userId, state) {
  const today = getTodayKey()
  const cleared = {
    ...state,
    ...normalizeDailyRitual(state),
    ritualDayKey: '',
  }

  const resetSalt = `gift-reset-${Date.now()}`
  const giftId = pickRitualGiftId(ritualSeed(userId, today, resetSalt))

  return {
    ok: true,
    state: {
      ...resolveDailyRitual(userId, cleared, today),
      ritualGiftId: giftId,
      ritualFortuneRevealed: false,
      ritualGiftOpened: false,
      ritualFortuneProgress: 0,
      ritualFortuneClaimed: false,
      ritualBonusRouletteSpins: 0,
      ritualFertilizerCharges: 0,
    },
  }
}



export function applyDevSetDailyRitualFortune(userId, state, giftId) {

  const id = String(giftId ?? '').trim()



  if (!RITUAL_GIFT_IDS.includes(id)) {

    return { ok: false, reason: 'invalid-gift', state }

  }



  const today = getTodayKey()

  let next = resolveDailyRitual(userId, state, today)



  next = {

    ...next,

    ritualFortuneId: RITUAL_DAILY_FORTUNE_ID,

    ritualFortuneRevealed: false,

    ritualFortuneProgress: 0,

    ritualFortuneClaimed: false,

    ritualGiftOpened: false,

    ritualGiftId: id,

    ritualBonusRouletteSpins: 0,

    ritualFertilizerCharges: 0,

  }



  return { ok: true, state: next, fortuneId: id, giftId: id }

}



export function applyDevCompleteDailyRitualMission(state, missionKind) {

  const today = getTodayKey()

  const ritual = normalizeDailyRitual(state)



  if (ritual.ritualDayKey !== today) {

    return { ok: false, reason: 'day-mismatch', state }

  }



  let next = { ...state, ...ritual }



  switch (missionKind) {

    case 'harvest': {

      const slot = RITUAL_DAILY_MISSION_SET.indexOf('M_HARVEST_2')

      next = {

        ...next,

        ritualMissionHarvestCount: 2,

      }

      if (slot >= 0) {

        next = markRitualMissionSlotDone(next, slot)

      }

      break

    }

    case 'minigame':

      next = onRitualMinigamePlayed(next)

      break

    case 'roulette':

      next = onRitualRouletteSpun(next)

      break

    default:

      return { ok: false, reason: 'invalid-mission', state: next }

  }



  return { ok: true, state: next, missionKind }

}



export function applyDevAdvanceDailyRitualStep(userId, state, step) {

  const today = getTodayKey()

  let next = resolveDailyRitual(userId, state, today)



  if (step === 'reveal') {

    return applyRitualFortuneReveal(next, userId, today)

  }



  if (step === 'gift') {

    const reveal = applyRitualFortuneReveal(next, userId, today)

    if (!reveal.ok && reveal.reason !== 'already-revealed') {

      return reveal

    }

    next = reveal.state ?? next

    return applyRitualGiftOpen(next, userId, today)

  }



  return { ok: false, reason: 'invalid-step', state: next }

}


