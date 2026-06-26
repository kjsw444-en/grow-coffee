import { getTodayKey } from './waterQuota.js'
import { grantBrewedCoffeeFields } from './brewedCoffeeReceived.js'
import { getRitualFortuneDefinition, RITUAL_DAILY_FORTUNE_ID } from './dailyRitualFortunes.js'
import {
  pickRitualGiftId,
  applyRitualGiftReward,
  getRitualGiftDefinition,
  getRitualFortuneRevealCopy,
} from './dailyRitualGifts.js'
import {
  RITUAL_DAILY_MISSION_SET,
  RITUAL_MISSION_REWARD_CUPS,
  allRitualMissionsComplete,
  buildMissionProgress,
  readMissionIdForSlot,
} from './dailyRitualMissions.js'

export function ritualSeed(userId, dayKey, salt = '') {
  const input = `${String(userId)}:${dayKey}:${salt}`
  let hash = 2166136261

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function normalizeDailyRitual(raw) {
  return {
    ritualDayKey: String(raw?.ritualDayKey ?? raw?.ritual_day_key ?? ''),
    ritualFortuneId: String(raw?.ritualFortuneId ?? raw?.ritual_fortune_id ?? ''),
    ritualFortuneRevealed: Boolean(raw?.ritualFortuneRevealed ?? raw?.ritual_fortune_revealed),
    ritualFortuneProgress: Math.max(
      0,
      Math.floor(Number(raw?.ritualFortuneProgress ?? raw?.ritual_fortune_progress ?? 0)),
    ),
    ritualFortuneClaimed: Boolean(raw?.ritualFortuneClaimed ?? raw?.ritual_fortune_claimed),
    ritualGiftOpened: Boolean(raw?.ritualGiftOpened ?? raw?.ritual_gift_opened),
    ritualGiftId: String(raw?.ritualGiftId ?? raw?.ritual_gift_id ?? ''),
    ritualMission1Id: String(raw?.ritualMission1Id ?? raw?.ritual_mission_1_id ?? ''),
    ritualMission2Id: String(raw?.ritualMission2Id ?? raw?.ritual_mission_2_id ?? ''),
    ritualMission3Id: String(raw?.ritualMission3Id ?? raw?.ritual_mission_3_id ?? ''),
    ritualMission1Done: Boolean(raw?.ritualMission1Done ?? raw?.ritual_mission_1_done),
    ritualMission2Done: Boolean(raw?.ritualMission2Done ?? raw?.ritual_mission_2_done),
    ritualMission3Done: Boolean(raw?.ritualMission3Done ?? raw?.ritual_mission_3_done),
    ritualMissionClaimed: Boolean(raw?.ritualMissionClaimed ?? raw?.ritual_mission_claimed),
    ritualMissionHarvestCount: Math.max(
      0,
      Math.floor(Number(raw?.ritualMissionHarvestCount ?? raw?.ritual_mission_harvest_count ?? 0)),
    ),
    ritualMissionMinigameDone: Boolean(
      raw?.ritualMissionMinigameDone ?? raw?.ritual_mission_minigame_done,
    ),
    ritualMissionRouletteDone: Boolean(
      raw?.ritualMissionRouletteDone ?? raw?.ritual_mission_roulette_done,
    ),
    ritualFertilizerCharges: Math.max(
      0,
      Math.floor(Number(raw?.ritualFertilizerCharges ?? raw?.ritual_fertilizer_charges ?? 0)),
    ),
    ritualBonusRouletteSpins: Math.max(
      0,
      Math.floor(Number(raw?.ritualBonusRouletteSpins ?? raw?.ritual_bonus_roulette_spins ?? 0)),
    ),
  }
}

function ensureMissionIds(state) {
  const next = { ...state }

  for (let i = 0; i < RITUAL_DAILY_MISSION_SET.length; i++) {
    const key = `ritualMission${i + 1}Id`
    if (!next[key]) {
      next[key] = RITUAL_DAILY_MISSION_SET[i]
    }
  }

  return next
}

function createFreshDailyRitual(userId, state, today) {
  const giftId = pickRitualGiftId(ritualSeed(userId, today, 'gift'))

  return {
    ...state,
    ...normalizeDailyRitual(state),
    ritualDayKey: today,
    ritualFortuneId: RITUAL_DAILY_FORTUNE_ID,
    ritualFortuneRevealed: false,
    ritualFortuneProgress: 0,
    ritualFortuneClaimed: false,
    ritualGiftOpened: false,
    ritualGiftId: giftId,
    ritualMission1Id: RITUAL_DAILY_MISSION_SET[0],
    ritualMission2Id: RITUAL_DAILY_MISSION_SET[1],
    ritualMission3Id: RITUAL_DAILY_MISSION_SET[2],
    ritualMission1Done: false,
    ritualMission2Done: false,
    ritualMission3Done: false,
    ritualMissionClaimed: false,
    ritualMissionHarvestCount: 0,
    ritualMissionMinigameDone: false,
    ritualMissionRouletteDone: false,
    ritualFertilizerCharges: 0,
    ritualBonusRouletteSpins: 0,
  }
}

export function resolveDailyRitual(userId, state, today = getTodayKey()) {
  const merged = { ...state, ...normalizeDailyRitual(state) }

  if (merged.ritualDayKey === today && merged.ritualGiftId) {
    return ensureMissionIds(merged)
  }

  return createFreshDailyRitual(userId, state, today)
}

export function ritualDayChanged(before, after) {
  return normalizeDailyRitual(before).ritualDayKey !== normalizeDailyRitual(after).ritualDayKey
}

export function buildRitualTodayView(state) {
  const ritual = normalizeDailyRitual(state)
  const giftDef = getRitualGiftDefinition(ritual.ritualGiftId)
  const missions = buildMissionProgress(state)
  const today = getTodayKey()
  const dailyRoulettePending = String(state?.dailyLoginRouletteDayKey ?? '') !== today

  return {
    dayKey: ritual.ritualDayKey,
    fortune: {
      id: ritual.ritualFortuneId,
      revealed: ritual.ritualFortuneRevealed,
      copy: getRitualFortuneRevealCopy(ritual.ritualGiftId),
      progress: ritual.ritualFortuneProgress,
      goal: 0,
      rewardCups: 0,
      claimed: ritual.ritualFortuneClaimed,
      canClaimFortuneReward: false,
    },
    gift: {
      id: ritual.ritualGiftId,
      opened: ritual.ritualGiftOpened,
      label: giftDef?.label ?? '',
      canOpen: ritual.ritualFortuneRevealed && !ritual.ritualGiftOpened,
    },
    missions: {
      items: missions,
      allDone: allRitualMissionsComplete(state),
      claimed: ritual.ritualMissionClaimed,
      rewardCups: RITUAL_MISSION_REWARD_CUPS,
      canClaim: allRitualMissionsComplete(state) && !ritual.ritualMissionClaimed,
    },
    bonusRouletteSpins: ritual.ritualBonusRouletteSpins,
    fertilizerCharges: ritual.ritualFertilizerCharges,
    ritualComplete: ritual.ritualFortuneRevealed && ritual.ritualGiftOpened,
    showRouletteNudge: dailyRoulettePending || ritual.ritualBonusRouletteSpins > 0,
  }
}

export function applyRitualFortuneReveal(state, userId, today = getTodayKey()) {
  let ritual = normalizeDailyRitual(state)

  if (ritual.ritualDayKey !== today) {
    return { ok: false, reason: 'day-mismatch', state }
  }

  if (ritual.ritualFortuneRevealed) {
    return { ok: false, reason: 'already-revealed', state }
  }

  if (!ritual.ritualFortuneId) {
    return { ok: false, reason: 'fortune-missing', state }
  }

  if (!ritual.ritualGiftId && userId) {
    ritual = {
      ...ritual,
      ritualGiftId: pickRitualGiftId(ritualSeed(userId, today, 'gift')),
    }
  }

  const next = {
    ...state,
    ...ritual,
    ritualFortuneRevealed: true,
  }

  return {
    ok: true,
    fortuneId: ritual.ritualFortuneId,
    giftId: ritual.ritualGiftId,
    copy: getRitualFortuneRevealCopy(ritual.ritualGiftId),
    state: next,
  }
}

export function applyRitualGiftOpen(state, userId, today = getTodayKey()) {
  let ritual = normalizeDailyRitual(state)

  if (ritual.ritualDayKey !== today) {
    return { ok: false, reason: 'day-mismatch', state }
  }

  if (!ritual.ritualFortuneRevealed) {
    return { ok: false, reason: 'fortune-not-revealed', state }
  }

  if (ritual.ritualGiftOpened) {
    return { ok: false, reason: 'already-opened', state }
  }

  if (!ritual.ritualGiftId && userId && ritual.ritualFortuneId) {
    ritual = {
      ...ritual,
      ritualGiftId: pickRitualGiftId(ritualSeed(userId, today, 'gift')),
    }
  }

  if (!ritual.ritualGiftId) {
    return { ok: false, reason: 'gift-missing', state: { ...state, ...ritual } }
  }

  const giftDef = getRitualGiftDefinition(ritual.ritualGiftId)
  let next = {
    ...state,
    ...ritual,
    ritualGiftOpened: true,
  }

  next = applyRitualGiftReward(next, ritual.ritualGiftId)

  return {
    ok: true,
    giftId: ritual.ritualGiftId,
    label: giftDef?.label ?? '',
    copy: giftDef?.copyOpened ?? '',
    state: next,
  }
}

export function applyRitualFortuneClaim(state, today = getTodayKey()) {
  const ritual = normalizeDailyRitual(state)

  if (ritual.ritualDayKey !== today) {
    return { ok: false, reason: 'day-mismatch', state }
  }

  if (ritual.ritualFortuneId !== 'HARVEST_GOAL_2') {
    return { ok: false, reason: 'not-harvest-fortune', state }
  }

  if (!ritual.ritualFortuneRevealed) {
    return { ok: false, reason: 'fortune-not-revealed', state }
  }

  if (ritual.ritualFortuneClaimed) {
    return { ok: false, reason: 'already-claimed', state }
  }

  const fortuneDef = getRitualFortuneDefinition('HARVEST_GOAL_2')
  const goal = fortuneDef?.harvestGoal ?? 2

  if (ritual.ritualFortuneProgress < goal) {
    return { ok: false, reason: 'progress-incomplete', state }
  }

  const rewardCups = fortuneDef?.harvestRewardCups ?? 3

  return {
    ok: true,
    rewardCups,
    state: {
      ...state,
      ...ritual,
      ritualFortuneClaimed: true,
      ...grantBrewedCoffeeFields(state, rewardCups),
    },
  }
}

export function applyRitualMissionClaim(state, today = getTodayKey()) {
  const ritual = normalizeDailyRitual(state)

  if (ritual.ritualDayKey !== today) {
    return { ok: false, reason: 'day-mismatch', state }
  }

  if (ritual.ritualMissionClaimed) {
    return { ok: false, reason: 'already-claimed', state }
  }

  if (!allRitualMissionsComplete(state)) {
    return { ok: false, reason: 'missions-incomplete', state }
  }

  return {
    ok: true,
    rewardCups: RITUAL_MISSION_REWARD_CUPS,
    state: {
      ...state,
      ...ritual,
      ritualMissionClaimed: true,
      ...grantBrewedCoffeeFields(state, RITUAL_MISSION_REWARD_CUPS),
    },
  }
}

export function readRitualMissionIds(state) {
  return [0, 1, 2].map((index) => readMissionIdForSlot(state, index))
}
