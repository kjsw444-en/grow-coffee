export function getTodayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function normalizeWaterQuota(raw) {
  const today = getTodayKey()
  const dayKey = String(raw?.waterDayKey || '')

  if (dayKey !== today) {
    return { waterDayKey: today, watersToday: 0, adWaterCredits: 0 }
  }

  return {
    waterDayKey: today,
    watersToday: Number(raw?.watersToday ?? 0),
    adWaterCredits: Number(raw?.adWaterCredits ?? 0),
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
