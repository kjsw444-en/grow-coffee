import { getPassiveDayKey } from './passiveGrowth.js'

export function hasUsedPassiveReactivateToday(raw) {
  const today = getPassiveDayKey()
  return String(raw?.passiveReactivateDayKey || raw?.passive_reactivate_day_key || '') === today
}

export function markPassiveReactivateUsed(raw) {
  return {
    passiveReactivateDayKey: getPassiveDayKey(),
  }
}
