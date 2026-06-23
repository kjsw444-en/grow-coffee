import type { GameState } from './types';

export function getTodayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

export function normalizeWaterQuota(state: Pick<GameState, 'waterDayKey' | 'watersToday' | 'adWaterCredits'>) {
  const today = getTodayKey();
  const dayKey = state.waterDayKey || '';

  if (dayKey !== today) {
    return { waterDayKey: today, watersToday: 0, adWaterCredits: 0 };
  }

  return {
    waterDayKey: today,
    watersToday: state.watersToday ?? 0,
    adWaterCredits: state.adWaterCredits ?? 0,
  };
}

export function withNormalizedQuota(state: GameState): GameState {
  return { ...state, ...normalizeWaterQuota(state) };
}

export function canWaterToday(state: GameState) {
  const quota = normalizeWaterQuota(state);
  return quota.watersToday === 0 || quota.adWaterCredits > 0;
}

export function needsAdForWater(state: GameState) {
  const quota = normalizeWaterQuota(state);
  return quota.watersToday > 0 && quota.adWaterCredits === 0;
}

export function consumeWaterQuota(state: GameState): GameState {
  const quota = normalizeWaterQuota(state);

  if (quota.watersToday === 0) {
    return { ...state, ...quota, watersToday: 1 };
  }

  if (quota.adWaterCredits > 0) {
    return {
      ...state,
      ...quota,
      watersToday: quota.watersToday + 1,
      adWaterCredits: quota.adWaterCredits - 1,
    };
  }

  return { ...state, ...quota };
}

export function grantAdWaterCredit(state: GameState): GameState {
  const quota = normalizeWaterQuota(state);
  return { ...state, ...quota, adWaterCredits: quota.adWaterCredits + 1 };
}

export function getWaterStatus(state: GameState) {
  const quota = normalizeWaterQuota(state);
  const freeAvailable = quota.watersToday === 0;

  return {
    ...quota,
    freeAvailable,
    canWater: freeAvailable || quota.adWaterCredits > 0,
    needsAd: quota.watersToday > 0 && quota.adWaterCredits === 0,
  };
}

export type GrowActionSlot = 'water' | 'ad' | 'drink';

/** 하단 액션 슬롯 — 마시기 > 광고 > 물주기 */
export function getGrowActionSlot({
  readyToDrink,
  isDrinkCommitting,
  state,
}: {
  readyToDrink: boolean;
  isDrinkCommitting: boolean;
  state: GameState;
}): GrowActionSlot {
  if (readyToDrink || isDrinkCommitting) return 'drink';
  if (needsAdForWater(state)) return 'ad';
  return 'water';
}
