import type { GameState } from './types';
import { getRefillActionLabel, isCoffeeStage, isDrinkStage } from './utils';

export function getTodayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/** 물주기·내리기 — 일일 제한 없음. 1회 → 광고 → 1회 반복. */
export function normalizeWaterQuota(state: Pick<GameState, 'waterDayKey' | 'watersToday' | 'adWaterCredits'>) {
  const today = getTodayKey();
  const dayKey = state.waterDayKey || '';
  const watersToday = Math.max(0, state.watersToday ?? 0);
  const adWaterCredits = Math.max(0, state.adWaterCredits ?? 0);

  return {
    waterDayKey: dayKey || today,
    watersToday,
    adWaterCredits,
  };
}

export function withNormalizedQuota(state: GameState): GameState {
  return { ...state, ...normalizeWaterQuota(state) };
}

/** 오늘 첫 물주기·내리기(광고 없음) 또는 광고 보상 1회분이 남아 있음 */
export function canWaterToday(state: GameState) {
  const quota = normalizeWaterQuota(state);
  return quota.watersToday === 0 || quota.adWaterCredits > 0;
}

/** 물주기·내리기 1회 사용 후, 광고 전 */
export function needsAdForWater(state: GameState) {
  const quota = normalizeWaterQuota(state);
  return quota.watersToday > 0 && quota.adWaterCredits === 0;
}

/** 물주기·내리기 꾹 누르기 가능 — 광고 슬롯이 아닐 때만 */
export function canUseGrowHold(state: GameState) {
  return canWaterToday(state) && !needsAdForWater(state);
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

/** 서버/bootstrap 응답 병합 — 사용한 물주기 횟수가 되돌아가지 않게 */
export function mergeWaterQuotaFromServer(
  local: Pick<GameState, 'waterDayKey' | 'watersToday' | 'adWaterCredits'>,
  incoming: Pick<GameState, 'waterDayKey' | 'watersToday' | 'adWaterCredits'>,
) {
  const localQ = normalizeWaterQuota(local);
  const incomingQ = normalizeWaterQuota(incoming);

  const watersToday = Math.max(localQ.watersToday, incomingQ.watersToday);
  let adWaterCredits = incomingQ.adWaterCredits;
  if (localQ.adWaterCredits > incomingQ.adWaterCredits) {
    adWaterCredits = localQ.adWaterCredits;
  }

  return {
    waterDayKey: incomingQ.waterDayKey || localQ.waterDayKey,
    watersToday,
    adWaterCredits,
  };
}

export function getWaterStatus(state: GameState) {
  const quota = normalizeWaterQuota(state);
  const freeAvailable = quota.watersToday === 0;
  const needsAd = quota.watersToday > 0 && quota.adWaterCredits === 0;

  return {
    ...quota,
    freeAvailable,
    canWater: freeAvailable || quota.adWaterCredits > 0,
    needsAd,
    canUseGrowHold: canUseGrowHold(state),
  };
}

export type GrowActionSlot = 'water' | 'ad' | 'drink';

function getGrowHoldActionLabel(growth: number) {
  return isCoffeeStage(growth) ? '커피 내리기' : '물주기';
}

/** 성장 패널 — 물주기·내리기·보충 안내 (상태별 한 줄) */
export function formatWaterPanelHint({
  growth,
  readyToDrink,
  growActionSlot,
  waterStatus,
}: {
  growth: number;
  readyToDrink: boolean;
  growActionSlot: GrowActionSlot;
  waterStatus: ReturnType<typeof getWaterStatus>;
}) {
  const refillLabel = getRefillActionLabel(growth);
  const actionLabel = getGrowHoldActionLabel(growth);

  if (readyToDrink) {
    if (waterStatus.needsAd) {
      return `100% · 커피 마신 뒤 「${refillLabel}」 필요`;
    }
    return null;
  }

  if (growActionSlot === 'ad') {
    return `1회 완료 · 「${refillLabel}」 누르면 ${actionLabel} 이어갈 수 있어요`;
  }

  if (waterStatus.freeAvailable) {
    return `오늘 첫 ${actionLabel} · 아래 버튼 꾹 누르기 (+25%)`;
  }

  if (waterStatus.adWaterCredits > 0) {
    return `${actionLabel} 가능 · 아래 버튼 꾹 누르기 (+25%)`;
  }

  return null;
}

/** 하단 액션 — 마시기 > 광고 > 물주기·내리기 */
export function getGrowActionSlot({
  readyToDrink,
  isDrinkCommitting,
  state,
  visualGrowth,
}: {
  readyToDrink: boolean;
  isDrinkCommitting: boolean;
  state: GameState;
  visualGrowth?: number;
}): GrowActionSlot {
  if (readyToDrink || isDrinkCommitting) return 'drink';
  const growthForStage = visualGrowth ?? state.growth;
  if (isDrinkStage(growthForStage)) return 'drink';
  if (needsAdForWater(state)) return 'ad';
  return 'water';
}
