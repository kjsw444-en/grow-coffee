import { GOAL_AMOUNT } from './constants';
import { getPassiveDayKey } from './passiveGrowth';

/** 하루 토스 포인트 상한 — 커피 한 잔 값(오류 방지) */
export const DAILY_POINT_CAP = GOAL_AMOUNT;

export function normalizePointDayKey(raw: { pointDayKey?: string; passiveDayKey?: string }): string {
  const direct = String(raw.pointDayKey ?? '').trim();
  if (direct) {
    return direct;
  }
  return String(raw.passiveDayKey ?? '').trim();
}

export function settleDailyPoint<T extends { money: number; pointDayKey: string }>(
  state: T,
  now = new Date(),
): T {
  const today = getPassiveDayKey(now);
  if (state.pointDayKey === today) {
    return {
      ...state,
      pointDayKey: today,
      money: Math.max(0, Math.min(DAILY_POINT_CAP, state.money)),
    };
  }

  return {
    ...state,
    pointDayKey: today,
    money: 0,
  };
}

export function hasReachedDailyPointCap(state: Pick<GameStateLike, 'money'>) {
  return state.money >= DAILY_POINT_CAP;
}

export function getDailyPointRoom(state: Pick<GameStateLike, 'money'>) {
  return Math.max(0, DAILY_POINT_CAP - state.money);
}

type GameStateLike = { money: number };
