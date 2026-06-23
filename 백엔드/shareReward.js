import { getTodayKey } from './waterQuota.js'

export function hasClaimedShareRewardToday(raw) {
  const today = getTodayKey()
  return String(raw?.shareRewardDayKey || '') === today
}

export function markShareRewardClaimed(raw) {
  return {
    shareRewardDayKey: getTodayKey(),
  }
}
