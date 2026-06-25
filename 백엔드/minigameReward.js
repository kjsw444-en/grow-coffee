import { getTodayKey } from './waterQuota.js'

/** 난이도 클리어 보상 — 내린 커피 (기본) */
export const MINIGAME_REWARD_COFFEE_CUPS = 1

/** 극한 난이도(mission4 · memoryMission4 · pairMission4) 클리어 보상 */
export const MINIGAME_NIGHTMARE_REWARD_COFFEE_CUPS = 3

export const MINIGAME_NIGHTMARE_MISSION_KEYS = ['mission4', 'memoryMission4', 'pairMission4']

export function getMinigameRewardCups(missionKey) {
  if (MINIGAME_NIGHTMARE_MISSION_KEYS.includes(missionKey)) return MINIGAME_NIGHTMARE_REWARD_COFFEE_CUPS
  return MINIGAME_REWARD_COFFEE_CUPS
}

export const MINIGAME_MISSION_BITS = {
  mission1: 1 << 0,
  mission2: 1 << 1,
  mission3: 1 << 2,
  mission4: 1 << 3,
  memoryMission1: 1 << 4,
  memoryMission2: 1 << 5,
  memoryMission3: 1 << 6,
  pairMission1: 1 << 7,
  pairMission2: 1 << 8,
  pairMission3: 1 << 9,
  memoryMission4: 1 << 10,
  pairMission4: 1 << 11,
}

export function normalizeMinigameRewardMask(raw) {
  const dayKey = String(raw?.minigameRewardDayKey ?? raw?.minigame_reward_day_key ?? '')
  const today = getTodayKey()
  if (dayKey !== today) {
    return { minigameRewardDayKey: today, minigameRewardFreeMask: 0, minigameRewardAdMask: 0 }
  }

  const legacyMask = Math.max(0, Math.floor(Number(raw?.minigameRewardMask ?? raw?.minigame_reward_mask ?? 0)))
  const freeMask = Math.max(
    0,
    Math.floor(Number(raw?.minigameRewardFreeMask ?? raw?.minigame_reward_free_mask ?? legacyMask)),
  )
  const adMask = Math.max(
    0,
    Math.floor(Number(raw?.minigameRewardAdMask ?? raw?.minigame_reward_ad_mask ?? 0)),
  )

  return { minigameRewardDayKey: dayKey, minigameRewardFreeMask: freeMask, minigameRewardAdMask: adMask }
}

function getMaskField(slot) {
  return slot === 'ad' ? 'minigameRewardAdMask' : 'minigameRewardFreeMask'
}

export function hasClaimedMinigameRewardToday(state, missionKey, slot = 'free') {
  const bit = MINIGAME_MISSION_BITS[missionKey]
  if (!bit) return false

  const quota = normalizeMinigameRewardMask(state)
  const maskField = getMaskField(slot)
  return (quota[maskField] & bit) !== 0
}

export function applyMinigameReward(state, missionKey, slot = 'free') {
  const bit = MINIGAME_MISSION_BITS[missionKey]
  if (!bit) {
    return { ok: false, reason: 'invalid-mission', state }
  }

  const rewardSlot = slot === 'ad' ? 'ad' : 'free'
  const current = normalizeMinigameRewardMask(state)
  const maskField = getMaskField(rewardSlot)

  if ((current[maskField] & bit) !== 0) {
    return { ok: false, reason: 'already-claimed', state }
  }

  const rewardCups = getMinigameRewardCups(missionKey)

  return {
    ok: true,
    rewardCups,
    state: {
      ...state,
      totalCoffees: Math.max(0, Number(state.totalCoffees ?? 0)) + rewardCups,
      minigameRewardDayKey: current.minigameRewardDayKey,
      minigameRewardFreeMask: current.minigameRewardFreeMask,
      minigameRewardAdMask: current.minigameRewardAdMask,
      [maskField]: current[maskField] | bit,
    },
  }
}
