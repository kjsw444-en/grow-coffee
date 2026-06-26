import { getTodayKey } from './waterQuota.js'

export function normalizeDailyBrewedReceived(raw) {
  return {
    dailyBrewedReceivedDayKey: String(
      raw?.dailyBrewedReceivedDayKey ?? raw?.daily_brewed_received_day_key ?? '',
    ),
    dailyBrewedReceived: Math.max(
      0,
      Math.floor(Number(raw?.dailyBrewedReceived ?? raw?.daily_brewed_received ?? 0)),
    ),
  }
}

export function addDailyBrewedReceived(state, amount, date = new Date()) {
  const cups = Math.max(0, Math.floor(Number(amount) || 0))
  if (cups <= 0) {
    return {}
  }

  const today = getTodayKey(date)
  const currentDaily =
    String(state?.dailyBrewedReceivedDayKey ?? state?.daily_brewed_received_day_key ?? '') === today
      ? Math.max(
          0,
          Math.floor(Number(state?.dailyBrewedReceived ?? state?.daily_brewed_received ?? 0)),
        )
      : 0

  return {
    dailyBrewedReceivedDayKey: today,
    dailyBrewedReceived: currentDaily + cups,
  }
}

/** 내린 커피(totalCoffees) 증가 + 일일 랭킹 누적 */
export function grantBrewedCoffeeFields(state, cups) {
  const amount = Math.max(0, Math.floor(Number(cups) || 0))

  return {
    totalCoffees: Math.max(0, Number(state?.totalCoffees ?? state?.total_coffees ?? 0)) + amount,
    ...addDailyBrewedReceived(state, amount),
  }
}

/** totalCoffees 증감 — 랭킹은 양수 증가분만 반영 */
export function applyBrewedCoffeeDeltaFields(state, deltaCups) {
  const delta = Math.floor(Number(deltaCups) || 0)
  const nextTotal = Math.max(0, Number(state?.totalCoffees ?? state?.total_coffees ?? 0) + delta)

  return {
    totalCoffees: nextTotal,
    ...(delta > 0 ? addDailyBrewedReceived(state, delta) : {}),
  }
}

/** 일일 랭킹 점수 — KST 오늘 받은 내린 커피 잔 수 */
export function getDailyRankingReceived(state, date = new Date()) {
  const today = getTodayKey(date)
  const dayKey = String(
    state?.dailyBrewedReceivedDayKey ?? state?.daily_brewed_received_day_key ?? '',
  )

  if (dayKey !== today) {
    return 0
  }

  return Math.max(
    0,
    Math.floor(Number(state?.dailyBrewedReceived ?? state?.daily_brewed_received ?? 0)),
  )
}

/** 누적 랭킹 참고용 — 일일 랭킹과 동일 기준의 오늘 점수 */
export function getRankingReceived(state, date = new Date()) {
  return getDailyRankingReceived(state, date)
}
