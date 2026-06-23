import { DAILY_PASSIVE_GROWTH_CAP, PASSIVE_GROWTH_PER_SECOND } from './constants.js'

export function getPassiveDayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function roundGrowth(value) {
  return Math.round(Number(value) * 1e7) / 1e7
}

export function normalizePassiveQuota(raw) {
  const today = getPassiveDayKey()
  const dayKey = String(raw?.passiveDayKey || '')

  if (dayKey !== today) {
    return { passiveDayKey: today, dailyPassiveGrowth: 0 }
  }

  return {
    passiveDayKey: today,
    dailyPassiveGrowth: roundGrowth(raw?.dailyPassiveGrowth ?? 0),
  }
}

const MIN_SYNC_EPOCH_MS = Date.UTC(2020, 0, 1)

export function repairGrowthAccrualSyncedAt(raw) {
  const value = raw?.growthAccrualSyncedAt

  if (!value) {
    return new Date().toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() < MIN_SYNC_EPOCH_MS) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

export function parseGrowthAccrualSyncedAt(raw) {
  const repaired = repairGrowthAccrualSyncedAt(raw)
  return new Date(repaired)
}

export function canAccruePassiveGrowth(state) {
  return !state.redeemed && Number(state.growth) < 100
}

export function calculatePassiveGrowthDelta({
  from,
  to,
  growth,
  dailyPassiveGrowth,
  redeemed,
}) {
  if (!canAccruePassiveGrowth({ growth, redeemed })) {
    return 0
  }

  const fromMs = from instanceof Date ? from.getTime() : new Date(from).getTime()
  const toMs = to instanceof Date ? to.getTime() : new Date(to).getTime()

  if (toMs <= fromMs) {
    return 0
  }

  const seconds = (toMs - fromMs) / 1000
  const raw = seconds * PASSIVE_GROWTH_PER_SECOND
  const roomInDaily = Math.max(0, DAILY_PASSIVE_GROWTH_CAP - dailyPassiveGrowth)
  const roomToMax = Math.max(0, 100 - growth)

  return roundGrowth(Math.min(raw, roomInDaily, roomToMax))
}

export function settlePassiveGrowth(state, now = new Date()) {
  const current = { ...state }
  const passiveQuota = normalizePassiveQuota(current)
  const syncedAt = parseGrowthAccrualSyncedAt(current)

  const delta = calculatePassiveGrowthDelta({
    from: syncedAt,
    to: now,
    growth: current.growth,
    dailyPassiveGrowth: passiveQuota.dailyPassiveGrowth,
    redeemed: current.redeemed,
  })

  return {
    ...current,
    ...passiveQuota,
    growth: roundGrowth(Math.min(100, current.growth + delta)),
    dailyPassiveGrowth: roundGrowth(passiveQuota.dailyPassiveGrowth + delta),
    growthAccrualSyncedAt: now.toISOString(),
  }
}

/** 방치 시간·일일 캡만 갱신 — growth 수치는 물주기(+25%)로만 변경 */
export function syncPassiveQuota(state, now = new Date()) {
  const current = {
    ...state,
    growth: roundGrowth(state?.growth ?? 0),
    redeemed: Boolean(state?.redeemed),
  }
  const passiveQuota = normalizePassiveQuota(current)
  const syncedAt = parseGrowthAccrualSyncedAt(current)

  const delta = calculatePassiveGrowthDelta({
    from: syncedAt,
    to: now,
    growth: current.growth,
    dailyPassiveGrowth: passiveQuota.dailyPassiveGrowth,
    redeemed: current.redeemed,
  })

  return {
    ...current,
    ...passiveQuota,
    dailyPassiveGrowth: roundGrowth(passiveQuota.dailyPassiveGrowth + delta),
    growthAccrualSyncedAt: now.toISOString(),
  }
}

export function previewPassiveGrowth(state, now = new Date()) {
  const passiveQuota = normalizePassiveQuota(state)
  const syncedAt = parseGrowthAccrualSyncedAt(state)

  const delta = calculatePassiveGrowthDelta({
    from: syncedAt,
    to: now,
    growth: state.growth,
    dailyPassiveGrowth: passiveQuota.dailyPassiveGrowth,
    redeemed: state.redeemed,
  })

  return {
    delta,
    from: syncedAt.toISOString(),
    to: now.toISOString(),
    projectedGrowth: roundGrowth(Math.min(100, state.growth + delta)),
    canAccrue: canAccruePassiveGrowth(state),
  }
}

export const BALANCE_RULES = {
  passiveGrowthPerSecond: PASSIVE_GROWTH_PER_SECOND,
  dailyPassiveGrowthCap: DAILY_PASSIVE_GROWTH_CAP,
}

export function getBalanceRules() {
  return BALANCE_RULES
}
