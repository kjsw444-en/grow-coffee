import { DAILY_PASSIVE_GROWTH_CAP, PASSIVE_GROWTH_PER_SECOND } from './constants.js'

export function getPassiveDayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function roundGrowth(value) {
  return Math.round(Number(value) * 1e7) / 1e7
}

/** 현재 잔 충전 상한 — 받기 전에는 100%에서 멈춤 */
export function getPassiveGrowthAccrualCap(
  passiveCoffeesClaimed = 0,
  dailyCap = DAILY_PASSIVE_GROWTH_CAP,
) {
  const maxCups = Math.max(1, Math.floor(dailyCap / 100))
  const claimed = Math.min(maxCups, Math.max(0, Math.floor(passiveCoffeesClaimed)))

  if (claimed >= maxCups) {
    return roundGrowth(claimed * 100)
  }

  return Math.min(dailyCap, (claimed + 1) * 100)
}

export function normalizePassiveQuota(raw) {
  const today = getPassiveDayKey()
  const dayKey = String(raw?.passiveDayKey || '')
  let dailyPassiveGrowth = roundGrowth(Math.max(0, Number(raw?.dailyPassiveGrowth ?? 0)))
  const passiveCoffeesClaimed = Math.max(0, Math.floor(Number(raw?.passiveCoffeesClaimed ?? 0)))

  if (!dayKey) {
    return {
      passiveDayKey: today,
      dailyPassiveGrowth: roundGrowth(
        Math.min(dailyPassiveGrowth, getPassiveGrowthAccrualCap(passiveCoffeesClaimed)),
      ),
      passiveCoffeesClaimed,
    }
  }

  if (dayKey !== today) {
    return { passiveDayKey: today, dailyPassiveGrowth: 0, passiveCoffeesClaimed: 0 }
  }

  dailyPassiveGrowth = roundGrowth(
    Math.min(dailyPassiveGrowth, getPassiveGrowthAccrualCap(passiveCoffeesClaimed)),
  )

  return {
    passiveDayKey: today,
    dailyPassiveGrowth,
    passiveCoffeesClaimed,
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

/** 방치 누적 — 현재 잔 100%까지만, 받기 후 다음 잔 충전 */
export function canAccruePassiveGrowth(state) {
  const passive = normalizePassiveQuota(state)
  const accrualCap = getPassiveGrowthAccrualCap(passive.passiveCoffeesClaimed)

  return !state.redeemed && passive.dailyPassiveGrowth < accrualCap
}

export function calculatePassiveGrowthDelta({
  from,
  to,
  dailyPassiveGrowth,
  passiveCoffeesClaimed = 0,
  redeemed,
}) {
  const accrualCap = getPassiveGrowthAccrualCap(passiveCoffeesClaimed)

  if (redeemed || dailyPassiveGrowth >= accrualCap) {
    return { quotaDelta: 0, growthDelta: 0 }
  }

  const fromMs = from instanceof Date ? from.getTime() : new Date(from).getTime()
  const toMs = to instanceof Date ? to.getTime() : new Date(to).getTime()

  if (toMs <= fromMs) {
    return { quotaDelta: 0, growthDelta: 0 }
  }

  const seconds = (toMs - fromMs) / 1000
  const raw = seconds * PASSIVE_GROWTH_PER_SECOND
  const roomInDaily = Math.max(0, accrualCap - dailyPassiveGrowth)
  const quotaDelta = roundGrowth(Math.min(raw, roomInDaily))

  return { quotaDelta, growthDelta: 0 }
}

export function settlePassiveGrowth(state, now = new Date()) {
  const current = { ...state }
  const passiveQuota = normalizePassiveQuota(current)
  const syncedAt = parseGrowthAccrualSyncedAt(current)

  const { quotaDelta } = calculatePassiveGrowthDelta({
    from: syncedAt,
    to: now,
    dailyPassiveGrowth: passiveQuota.dailyPassiveGrowth,
    passiveCoffeesClaimed: passiveQuota.passiveCoffeesClaimed,
    redeemed: current.redeemed,
  })

  return {
    ...current,
    ...passiveQuota,
    dailyPassiveGrowth: roundGrowth(passiveQuota.dailyPassiveGrowth + quotaDelta),
    growthAccrualSyncedAt: now.toISOString(),
  }
}

export function previewPassiveGrowth(state, now = new Date()) {
  const passiveQuota = normalizePassiveQuota(state)
  const syncedAt = parseGrowthAccrualSyncedAt(state)

  const { quotaDelta } = calculatePassiveGrowthDelta({
    from: syncedAt,
    to: now,
    dailyPassiveGrowth: passiveQuota.dailyPassiveGrowth,
    passiveCoffeesClaimed: passiveQuota.passiveCoffeesClaimed,
    redeemed: state.redeemed,
  })

  return {
    delta: 0,
    quotaDelta,
    from: syncedAt.toISOString(),
    to: now.toISOString(),
    projectedGrowth: roundGrowth(Math.min(100, Math.max(0, state.growth))),
    projectedDailyPassiveGrowth: roundGrowth(passiveQuota.dailyPassiveGrowth + quotaDelta),
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
