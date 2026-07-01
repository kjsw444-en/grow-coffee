export function getTodayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function getYesterdayKey(date = new Date()) {
  const todayStart = new Date(`${getTodayKey(date)}T00:00:00+09:00`)
  todayStart.setTime(todayStart.getTime() - 24 * 60 * 60 * 1000)
  return getTodayKey(todayStart)
}

function readQuotaCount(raw, camel, snake) {
  const value = raw?.[camel] ?? raw?.[snake]
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

/** 물주기·내리기 — 일일 제한 없음. 1회 → 광고 → 1회 반복. */
export function normalizeWaterQuota(raw) {
  const today = getTodayKey()
  const dayKey = String(raw?.waterDayKey ?? raw?.water_day_key ?? '')
  const watersToday = readQuotaCount(raw, 'watersToday', 'waters_today')
  const adWaterCredits = readQuotaCount(raw, 'adWaterCredits', 'ad_water_credits')

  return {
    waterDayKey: dayKey || today,
    watersToday,
    adWaterCredits,
  }
}

export function canWaterToday(raw) {
  const quota = normalizeWaterQuota(raw)
  return quota.watersToday === 0 || quota.adWaterCredits > 0
}

export function needsAdForWater(raw) {
  const quota = normalizeWaterQuota(raw)
  return quota.watersToday > 0 && quota.adWaterCredits === 0
}

export function consumeWaterQuota(raw) {
  const quota = normalizeWaterQuota(raw)

  if (quota.watersToday === 0) {
    return { ...quota, watersToday: 1 }
  }

  if (quota.adWaterCredits > 0) {
    return {
      ...quota,
      watersToday: quota.watersToday + 1,
      adWaterCredits: quota.adWaterCredits - 1,
    }
  }

  return quota
}

export function grantAdWaterCredit(raw) {
  const quota = normalizeWaterQuota(raw)
  return { ...quota, adWaterCredits: quota.adWaterCredits + 1 }
}

/** 하이브리드 — 프론트 로컬 물주기 quota를 서버에 반영 (growth는 그대로) */
export function syncHybridClientWaterQuota(raw, clientWatersToday, maxLocalAhead = 3) {
  const quota = normalizeWaterQuota(raw)
  const client = Math.max(0, Math.floor(Number(clientWatersToday ?? 0)))
  if (client <= quota.watersToday) return quota

  const capped = Math.min(client, quota.watersToday + Math.max(0, Math.floor(maxLocalAhead)))
  return { ...quota, watersToday: capped }
}

/** 하이브리드 — watersToday 동기화 + 로컬에서 이미 쓴 광고 크레딧 제거 */
export function mergeHybridClientQuota(raw, clientWatersToday, maxLocalAhead = 3) {
  const quota = normalizeWaterQuota(raw)
  const client = Math.max(0, Math.floor(Number(clientWatersToday ?? 0)))
  if (client <= 0) return quota

  const synced = syncHybridClientWaterQuota(raw, client, maxLocalAhead)
  return {
    ...synced,
    adWaterCredits: client > quota.watersToday ? 0 : quota.adWaterCredits,
  }
}
