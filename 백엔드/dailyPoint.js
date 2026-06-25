import { GOAL_AMOUNT } from './constants.js'
import { getPassiveDayKey } from './passiveGrowth.js'

/** 하루 토스 포인트 상한 — 커피 한 잔 값(오류 방지) */
export const DAILY_POINT_CAP = GOAL_AMOUNT

export function normalizePointDayKey(raw) {
  const direct = String(raw?.pointDayKey ?? raw?.point_day_key ?? '').trim()
  if (direct) {
    return direct
  }
  return String(raw?.passiveDayKey ?? raw?.passive_day_key ?? '').trim()
}

export function settleDailyPoint(state, now = new Date()) {
  const today = getPassiveDayKey(now)
  const pointDayKey = normalizePointDayKey(state)

  if (pointDayKey === today) {
    return {
      ...state,
      pointDayKey: today,
      money: Math.max(0, Math.min(DAILY_POINT_CAP, Number(state.money ?? 0))),
    }
  }

  return {
    ...state,
    pointDayKey: today,
    money: 0,
  }
}

export function hasReachedDailyPointCap(state) {
  return Number(state.money ?? 0) >= DAILY_POINT_CAP
}

export function getDailyPointRoom(state) {
  return Math.max(0, DAILY_POINT_CAP - Number(state.money ?? 0))
}
